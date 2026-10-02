import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIONS, writeAuditLog, writeAuditLogs } from "@/lib/auditLog";
import { renderQuotePdfBuffer } from "@/lib/pdf/quote-document";
import { uploadPdfToCloudinary } from "@/lib/cloudinary";
import { notifyUser, notifyRoles } from "@/lib/services/notification.service";
import { getStageMeta } from "@/lib/production-constants";
import {
  computeOrderLineMaterialNeeds,
  computePaperCost,
  describePaperSizing,
  findBestPaperRoll,
  findBestStockMatch,
  loadStockCatalog,
} from "@/lib/material-suggestion";
import { computePaperWeightKg, formatWeight, planSlitting } from "@/lib/paper-sizing";
import { MATERIAL_SUGGESTION_CONSTANTS as C } from "@/lib/material-constants";
import { assignMaterialSources, recheckMaterialSources } from "@/lib/services/material-sourcing.service";
import {
  DRAFTABLE_ORDER_STATUSES,
  EDITABLE_ORDER_STATUSES,
  computeOrderTotals,
  lineClicheCharge,
} from "@/lib/validations/sales-order";
import {
  clicheCreatedLogs,
  deleteUnusedOrderCliches,
  planOrderLineCliches,
  writeOrderLineCliches,
} from "@/lib/services/cliche.service";
import { lineNeedsCliche } from "@/lib/order-labels";

const { Decimal } = Prisma;

function dec(v) {
  if (v == null || v === "") return new Decimal(0);
  return new Decimal(v.toString());
}

/**
 * The "best match" material suggestions for one order line, matched against
 * a stock snapshot (loadStockCatalog): paper roll, hot melt glue, rope and
 * ink from stock, plus cold and core glue as a per-bag cost. Every row's
 * `reason` spells out the rule used, and a stock need with no match is still
 * listed (no material, zero cost) so the shortfall is visible.
 */
function suggestionsForLine(line, catalog) {
  const needs = computeOrderLineMaterialNeeds(line);
  const bags = needs.quantity.toLocaleString();
  const rows = [];

  const { bestMatch: roll, reason: rollReason } = findBestPaperRoll(catalog, {
    paperType: line.paperType,
    paperColor: line.paperColor,
    rollWidthCm: needs.rollWidthCm,
    paperLengthNeededM: needs.paperLengthNeededM,
  });
  const sizing = describePaperSizing(line, needs);
  const paperCost = roll ? computePaperCost(roll, needs.paperLengthNeededM) : null;
  const kwd = (n) => `${n.toFixed(3)} KWD`;
  const slit = roll ? planSlitting(roll.paperWidthCm, needs.rollWidthCm) : null;
  const slitKg = (widthCm) => formatWeight(computePaperWeightKg(needs.paperLengthNeededM, widthCm, roll.gsm), "kg");
  const slitPlan =
    slit?.leftoverCm > 0
      ? `Slitting plan: ${Number(roll.paperWidthCm)}cm → ${needs.rollWidthCm}cm for the bags` +
        (slit.stripCount ? ` + ${slit.stripCount} × ${slit.stripWidthCm}cm recycled rolls (${slitKg(slit.stripCount * slit.stripWidthCm)})` : "") +
        (slit.wasteCm > 0 ? ` + ${slit.wasteCm}cm waste (${slitKg(slit.wasteCm)})` : "") +
        ". "
      : "";
  rows.push({
    materialId: roll?.id ?? null,
    role: "ROLL",
    suggestedQty: needs.paperLengthNeededM,
    unit: "METER",
    suggestedCost: paperCost?.average ?? 0,
    reason: roll
      ? `${sizing} ${rollReason} ` +
        `Cost by length: ${Number(needs.paperLengthNeededM.toFixed(2))}m × ${paperCost.costPerM.toFixed(4)} = ${kwd(paperCost.byLength)}. ` +
        `By weight: ${formatWeight(paperCost.weightKg, "kg")} (${Number(roll.paperWidthCm)}cm × ${roll.gsm}gsm) × ${paperCost.costPerKg.toFixed(4)} per kg = ${kwd(paperCost.byWeight)}. ` +
        `Average: ${kwd(paperCost.average)}. ${slitPlan}`.trim()
      : `${sizing} No ${line.paperType} ${line.paperColor} roll in stock is at least ${needs.rollWidthCm}cm wide with ${Number(needs.paperLengthNeededM.toFixed(2))}m remaining.`,
  });

  const stockNeeds = [
    {
      role: "HOT_GLUE",
      materialType: "GLUE",
      spec: { glueType: "HOT" },
      qty: needs.hotGlueNeededKg,
      unit: "KG",
      rule: `Hot melt glue for handles: 25kg per 10,000 bags = ${needs.perBag.hotGlueKg}kg × ${bags} bags.`,
    },
    { role: "ROPE", materialType: "ROPE", qty: needs.ropeNeededM, unit: "METER", rule: "Handle rope (estimated rate)." },
    {
      role: "INK",
      materialType: "INK",
      qty: needs.inkNeededKg,
      unit: "KG",
      // Picked from stock like the rest, but costed at the fixed per-area rate
      fixedCost: needs.inkCostKwd,
      rule:
        `Ink over the full paper area: ${needs.bagHeightCm} × ${needs.rollWidthCm} = ${(needs.bagHeightCm * needs.rollWidthCm).toLocaleString()} cm², once whatever the color count. ` +
        `Cost: ${Number((C.INK_KWD_PER_CM2 * 1000).toFixed(6))} fils per cm² = ${(needs.perBag.inkKwd * 1000).toFixed(3)} fils per bag × ${bags} bags. ` +
        `Quantity to pick: ${C.INK_G_PER_CM2} g per cm² (estimated rate).`,
    },
  ];

  for (const { role, materialType, spec, qty, unit, rule, fixedCost } of stockNeeds) {
    if (qty <= 0) continue;
    const { bestMatch, reason } = findBestStockMatch(catalog, { materialType, spec, quantityNeeded: qty, unit });
    rows.push({
      materialId: bestMatch?.id ?? null,
      role,
      suggestedQty: qty,
      unit,
      suggestedCost: fixedCost ?? (bestMatch ? qty * Number(bestMatch.averageCostKwd || 0) : 0),
      reason: `${rule} ${bestMatch ? reason : `No stock with ${qty.toFixed(2)} ${unit} available.`}`,
    });
  }

  rows.push(
    {
      materialId: null,
      role: "COLD_GLUE",
      suggestedQty: needs.quantity,
      unit: "BAG",
      suggestedCost: needs.coldGlueCostKwd,
      reason: line.withHandle
        ? `Fixed cost: ${C.COLD_GLUE_KWD_PER_BAG} KWD per bag + ${C.COLD_GLUE_HANDLE_EXTRA * 100}% for handles = ${needs.perBag.coldGlueKwd} KWD × ${bags} bags.`
        : `Fixed cost: ${C.COLD_GLUE_KWD_PER_BAG} KWD per bag × ${bags} bags.`,
    },
    {
      materialId: null,
      role: "CORE_GLUE",
      suggestedQty: needs.quantity,
      unit: "BAG",
      suggestedCost: needs.coreGlueCostKwd,
      reason: `Fixed cost: ${needs.perBag.coreGlueKwd} KWD per bag × ${bags} bags.`,
    },
  );

  return rows;
}

/**
 * Suggestion rows per line for an order being saved (`lines` are
 * formatOrderLineData rows, in line order), matched against one stock
 * snapshot. Best-effort: if stock can't be read the order still saves,
 * just without suggestions (null).
 */
async function planOrderMaterialSuggestions(lines) {
  try {
    const catalog = await loadStockCatalog();
    return lines.map((line) => suggestionsForLine(line, catalog));
  } catch (err) {
    console.error("Material suggestion generation failed", err);
    return null;
  }
}

/** Saves planned suggestions against the order's newly written lines (matched by lineNo). */
async function writeOrderMaterialSuggestions(plannedRows, savedLines, tx) {
  if (!plannedRows) return;
  const lineIdByNo = new Map(savedLines.map((l) => [l.lineNo, l.id]));
  const data = plannedRows.flatMap((rows, i) => rows.map((r) => ({ orderLineId: lineIdByNo.get(i + 1), ...r })));
  if (data.length) await tx.orderLineMaterial.createMany({ data });
}

/**
 * Next sequential order number PO-YYYY-NNNN: one past the highest number
 * already used this year (not a row count, which repeats a number after
 * any delete). Two simultaneous creates can still pick the same number —
 * orderNo is @unique, so createSalesOrder retries on that collision.
 */
export async function generateOrderNo() {
  const prefix = `PO-${new Date().getFullYear()}-`;
  const existing = await prisma.productionOrder.findMany({
    where: { orderNo: { startsWith: prefix } },
    select: { orderNo: true },
  });
  const highest = existing.reduce((max, { orderNo }) => {
    const seq = parseInt(orderNo.slice(prefix.length), 10);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

const ORDER_NO_ATTEMPTS = 3;

function isOrderNoCollision(error) {
  if (error?.code !== "P2002") return false;
  const target = error.meta?.target;
  return (Array.isArray(target) ? target.join(" ") : String(target || "")).includes("orderNo");
}

/**
 * Fetch active Sales Rep users for dropdown selector
 */
export async function getSalesRepresentatives() {
  return prisma.user.findMany({
    where: {
      role: "SALES",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Formats order line data cleanly for DB creation/updates
 */
export function formatOrderLineData(line, index) {
  const qty = dec(line.quantity || line.plannedQty || 1);
  // Blank means "no price entered" (null), never 0 — dec("") would be 0.
  const hasValue = (v) => v !== undefined && v !== null && v !== "";
  let lineTotal = hasValue(line.lineTotal) ? dec(line.lineTotal) : null;
  let unitPrice = hasValue(line.unitPrice) ? dec(line.unitPrice) : null;

  // Derive whichever of unit price / line total is missing from the other
  if (unitPrice == null && lineTotal != null && qty.gt(0)) {
    unitPrice = lineTotal.div(qty).toDecimalPlaces(4);
  } else if (lineTotal == null && unitPrice != null) {
    lineTotal = unitPrice.mul(qty).toDecimalPlaces(4);
  }

  // Dimensions in cm
  const widthCm = line.widthCm != null ? dec(line.widthCm) : null;
  const heightCm = line.heightCm != null ? dec(line.heightCm) : null;
  const baseCm = line.baseCm != null ? dec(line.baseCm) : null;

  // Convert to mm for backward compatibility with existing production stage math if present
  const widthMm = widthCm ? widthCm.mul(10) : line.widthMm != null ? dec(line.widthMm) : null;
  const heightMm = heightCm ? heightCm.mul(10) : line.heightMm != null ? dec(line.heightMm) : null;
  const baseMm = baseCm ? baseCm.mul(10) : line.baseMm != null ? dec(line.baseMm) : null;

  // Parse reference files (array of up to 5 uploaded file objects or string URLs)
  let referenceFiles = null;
  if (Array.isArray(line.referenceFiles)) {
    referenceFiles = line.referenceFiles.slice(0, 5);
  } else if (typeof line.referenceFiles === "string") {
    try {
      const parsed = JSON.parse(line.referenceFiles);
      if (Array.isArray(parsed)) referenceFiles = parsed.slice(0, 5);
    } catch {
      referenceFiles = [{ url: line.referenceFiles, name: line.fileName || "Reference File" }];
    }
  }

  const clicheCharge = lineClicheCharge(line);

  return {
    lineNo: index + 1,
    widthCm,
    heightCm,
    baseCm,
    widthMm,
    heightMm,
    baseMm,
    quantity: qty,
    plannedQty: qty,
    withHandle: Boolean(line.withHandle),
    paperType: line.paperType || "VIRGIN",
    paperColor: line.paperColor || "WHITE",
    colorCount: parseInt(line.colorCount || 0, 10),
    referenceFiles,
    unitPrice,
    lineTotal,
    fileUrl: line.fileUrl || (Array.isArray(referenceFiles) && referenceFiles[0]?.url) || null,
    fileName: line.fileName || (Array.isArray(referenceFiles) && referenceFiles[0]?.name) || null,
    clicheCharge: clicheCharge > 0 ? dec(clicheCharge) : null,
  };
}

/**
 * Resolves an optional sales rep id to an active SALES user; an id that
 * isn't one is rejected rather than stored dangling.
 */
async function resolveSalesRep(salesRepId) {
  if (!salesRepId) return null;
  const rep = await prisma.user.findFirst({
    where: { id: salesRepId, role: "SALES", isActive: true },
    select: { id: true, name: true },
  });
  if (!rep) throw new Error("Selected sales rep isn't an active sales user");
  return rep;
}

/**
 * Creates a new order proposal in DRAFT or PENDING_APPROVAL status.
 * `data` is salesOrderSchema output. Totals are always recomputed here from
 * the lines — client-sent totals are never trusted.
 */
export async function createSalesOrder({
  customerId,
  salesRepId,
  priority = "NORMAL",
  deliveryDate,
  notes,
  discount = 0,
  lines = [],
  status = "PENDING_APPROVAL", // "DRAFT" or "PENDING_APPROVAL"
  createdById,
}) {
  if (!customerId) throw new Error("Customer is required");
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("At least one order line is required");
  }

  // Independent lookups run together — each is a full database round trip.
  const lineData = lines.map(formatOrderLineData);
  const [customer, salesRepUser, clichePlans, suggestionRows, firstOrderNo] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    resolveSalesRep(salesRepId),
    planOrderLineCliches(lines, { customerId }),
    planOrderMaterialSuggestions(lineData),
    generateOrderNo(),
  ]);
  if (!customer) throw new Error("Customer not found");

  const totals = computeOrderTotals(lines, discount);
  const subTotalDec = dec(totals.subtotal);
  const discountDec = dec(totals.discount);
  const totalDec = dec(totals.total);
  const proposedTotalDec = totalDec;

  const targetStatus = status === "DRAFT" ? "DRAFT" : "PENDING_APPROVAL";

  const insertSalesOrder = (orderNo) =>
    prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.create({
        data: {
          orderNo,
          customerId,
          salesRepId: salesRepUser?.id || null,
          salesRep: salesRepUser?.name || null,
          priority: priority || "NORMAL",
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          notes: notes?.trim() || null,
          status: targetStatus,
          subtotal: subTotalDec,
          discount: discountDec,
          total: totalDec,
          proposedTotal: proposedTotalDec,
          approvedTotal: null,
        },
      });

      const { clicheIds, created } = await writeOrderLineCliches(clichePlans, order.id, tx);
      const savedLines = await tx.orderLine.createManyAndReturn({
        data: lineData.map((line, i) => ({ orderId: order.id, ...line, clicheId: clicheIds[i] })),
        select: { id: true, lineNo: true },
      });
      await writeOrderMaterialSuggestions(suggestionRows, savedLines, tx);

      // If order submitted for approval, create initial OrderApproval history entry
      if (targetStatus === "PENDING_APPROVAL") {
        await tx.orderApproval.create({
          data: {
            orderId: order.id,
            requestedById: createdById || null,
            status: "PENDING",
            proposedTotal: proposedTotalDec,
            remarks: "Initial order submission for manager approval",
          },
        });
      }

      return { orderId: order.id, createdCliches: created };
    }, { timeout: 15000 });

  // orderNo is @unique: on a same-moment collision, take the next number and retry
  let orderNo;
  let orderId;
  let createdCliches;
  for (let attempt = 1; ; attempt++) {
    orderNo = attempt === 1 ? firstOrderNo : await generateOrderNo();
    try {
      ({ orderId, createdCliches } = await insertSalesOrder(orderNo));
      break;
    } catch (error) {
      if (attempt < ORDER_NO_ATTEMPTS && isOrderNoCollision(error)) continue;
      throw error;
    }
  }

  // Audit, notifications and reading the order back are independent; both
  // writers log their own failures rather than throw.
  const [order] = await Promise.all([
    getOrderDetails(orderId),
    createdById &&
      writeAuditLogs([
        ...clicheCreatedLogs(createdCliches, createdById),
        {
          userId: createdById,
          action: ACTIONS.PRODUCTION_ORDER_CREATED || "ORDER_CREATED",
          model: "ProductionOrder",
          recordId: orderId,
          newValue: {
            orderNo,
            status: targetStatus,
            proposedTotal: Number(proposedTotalDec),
            linesCount: lines.length,
          },
        },
      ]),
    targetStatus === "PENDING_APPROVAL" &&
      notifyRoles(["MANAGER", "ADMIN"], {
        type: "ORDER_PENDING_APPROVAL",
        title: "New order awaiting approval",
        message: `Order ${orderNo} for ${customer.name} needs your review`,
        link: "/dashboard/manager",
        entityType: "ProductionOrder",
        entityId: orderId,
      }),
  ]);
  return order;
}

/**
 * Saves an edited proposal (`data` is salesOrderSchema output — the full
 * form). Editing only ever moves an order *back* in the workflow: it's saved
 * as DRAFT (only from DRAFT/REJECTED) or re-submitted as PENDING_APPROVAL,
 * clearing any previously approved price so it must be re-approved and
 * re-quoted. Approval, customer confirmation and send-to-production are
 * never reachable through an edit — only via their own actions.
 */
export async function updateSalesOrder(orderId, data, userId) {
  const lineData = data.lines.map(formatOrderLineData);
  const [existingOrder, clichePlans, suggestionRows] = await Promise.all([
    prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: { approvals: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    planOrderLineCliches(data.lines, { customerId: data.customerId, orderId }),
    planOrderMaterialSuggestions(lineData),
  ]);

  if (!existingOrder) throw new Error("Order not found");
  if (!EDITABLE_ORDER_STATUSES.includes(existingOrder.status)) {
    throw new Error(`Order can't be edited once it's in production (status: ${existingOrder.status})`);
  }

  const newStatus =
    data.status === "DRAFT" && DRAFTABLE_ORDER_STATUSES.includes(existingOrder.status)
      ? "DRAFT"
      : "PENDING_APPROVAL";
  const wasPastApproval = ["APPROVED", "PENDING_CUSTOMER_APPROVAL", "CUSTOMER_APPROVED"].includes(
    existingOrder.status,
  );

  const salesRepUser =
    data.salesRepId === undefined
      ? { id: existingOrder.salesRepId, name: existingOrder.salesRep }
      : await resolveSalesRep(data.salesRepId);

  const totals = computeOrderTotals(data.lines, data.discount);
  const subTotalDec = dec(totals.subtotal);
  const discountDec = dec(totals.discount);
  const totalDec = dec(totals.total);
  const proposedTotalDec = totalDec;

  // Re-saving an order that's already waiting for review refreshes that
  // pending request instead of stacking a duplicate one.
  const latestApproval = existingOrder.approvals[0];
  const pendingApproval =
    existingOrder.status === "PENDING_APPROVAL" && latestApproval?.status === "PENDING"
      ? latestApproval
      : null;

  const createdCliches = await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        customerId: data.customerId,
        salesRepId: salesRepUser?.id || null,
        salesRep: salesRepUser?.name || null,
        priority: data.priority || existingOrder.priority,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes?.trim() || null,
        status: newStatus,
        subtotal: subTotalDec,
        discount: discountDec,
        total: totalDec,
        proposedTotal: proposedTotalDec,
        approvedTotal: null,
      },
    });

    // Replace lines; clichés this order added and no longer uses go with them
    await tx.orderLine.deleteMany({ where: { orderId } });
    const { clicheIds, created } = await writeOrderLineCliches(clichePlans, orderId, tx);
    const savedLines = await tx.orderLine.createManyAndReturn({
      data: lineData.map((line, i) => ({ orderId, ...line, clicheId: clicheIds[i] })),
      select: { id: true, lineNo: true },
    });
    await writeOrderMaterialSuggestions(suggestionRows, savedLines, tx);
    await deleteUnusedOrderCliches(orderId, tx);

    if (newStatus === "PENDING_APPROVAL") {
      if (pendingApproval) {
        await tx.orderApproval.update({
          where: { id: pendingApproval.id },
          data: { proposedTotal: proposedTotalDec, requestedById: userId || pendingApproval.requestedById },
        });
      } else {
        await tx.orderApproval.create({
          data: {
            orderId,
            requestedById: userId || null,
            status: "PENDING",
            proposedTotal: proposedTotalDec,
            remarks: wasPastApproval
              ? "Order edited after approval; re-submitted for approval"
              : "Order revised & submitted for approval",
          },
        });
      }
    }

    return created;
  }, { timeout: 15000 });

  const [order] = await Promise.all([
    getOrderDetails(orderId),
    userId &&
      writeAuditLogs([
        ...clicheCreatedLogs(createdCliches, userId),
        {
          userId,
          action: "ORDER_UPDATED",
          model: "ProductionOrder",
          recordId: orderId,
          oldValue: { status: existingOrder.status, total: Number(existingOrder.total || 0) },
          newValue: { status: newStatus, total: Number(totalDec || 0) },
        },
      ]),
  ]);
  return order;
}

/**
 * Manager approves or rejects an order.
 */
export async function reviewOrderApproval({
  orderId,
  action, // "APPROVE" | "REJECT"
  approvedTotal,
  remarks,
  reviewedById,
  materialSources = {}, // suggestion id -> "FACTORY" | "WAREHOUSE"
}) {
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: { approvals: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING_APPROVAL" && order.status !== "DRAFT" && order.status !== "REJECTED") {
    throw new Error(`Order cannot be reviewed in current status: ${order.status}`);
  }

  const latestApproval = order.approvals[0];
  const isApprove = action === "APPROVE";
  // Approving only generates the quote — it stays "APPROVED" (not yet sent)
  // until someone explicitly marks it sent via markQuoteSent().
  const nextStatus = isApprove ? "APPROVED" : "REJECTED";
  const approvedTotalDec = isApprove
    ? approvedTotal != null
      ? dec(approvedTotal)
      : order.proposedTotal || order.total
    : null;

  // Generate + upload the customer quote PDF before opening a DB transaction —
  // it's a slow external call and shouldn't hold a transaction/connection open.
  let quotePdfUrl = null;
  if (isApprove) {
    const [fullOrder, approver] = await Promise.all([
      getOrderDetails(orderId),
      reviewedById ? prisma.user.findUnique({ where: { id: reviewedById } }) : null,
    ]);
    // The order row isn't updated until the transaction below, so hand the
    // PDF the price being approved now — the customer must see the admin's
    // (possibly revised) price, not the sales rep's proposal.
    const pdfBuffer = await renderQuotePdfBuffer({ ...fullOrder, approvedTotal: approvedTotalDec }, approver);
    quotePdfUrl = await uploadPdfToCloudinary(pdfBuffer, "quotes");
  }

  await prisma.$transaction(async (tx) => {
    // Update or create order approval record
    if (latestApproval && latestApproval.status === "PENDING") {
      await tx.orderApproval.update({
        where: { id: latestApproval.id },
        data: {
          reviewedById: reviewedById || null,
          status: isApprove ? "APPROVED" : "REJECTED",
          approvedTotal: approvedTotalDec,
          remarks: remarks?.trim() || (isApprove ? "Approved by manager" : "Rejected by manager"),
          reviewedAt: new Date(),
        },
      });
    } else {
      await tx.orderApproval.create({
        data: {
          orderId,
          requestedById: order.salesRepId || null,
          reviewedById: reviewedById || null,
          status: isApprove ? "APPROVED" : "REJECTED",
          proposedTotal: order.proposedTotal || order.total,
          approvedTotal: approvedTotalDec,
          remarks: remarks?.trim() || (isApprove ? "Approved by manager" : "Rejected by manager"),
          reviewedAt: new Date(),
        },
      });
    }

    // Update ProductionOrder status
    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        approvedTotal: approvedTotalDec,
      },
    });

    if (isApprove && quotePdfUrl) {
      await tx.customerQuoteApproval.create({
        data: {
          orderId,
          pdfUrl: quotePdfUrl,
          status: "GENERATED",
        },
      });
    }

    // Reserve factory stock (or mark for a warehouse pick) as of approval.
    if (isApprove) await assignMaterialSources(orderId, materialSources, tx);
  }, { timeout: 15000 });

  if (reviewedById) {
    await writeAuditLog({
      userId: reviewedById,
      action: isApprove ? ACTIONS.QUOTE_GENERATED : "ORDER_REJECTED",
      model: "ProductionOrder",
      recordId: orderId,
      newValue: {
        status: nextStatus,
        approvedTotal: approvedTotalDec ? Number(approvedTotalDec) : null,
        remarks,
        quotePdfUrl,
      },
    });
  }

  await notifyUser(order.salesRepId, isApprove
    ? {
        type: "ORDER_APPROVED",
        title: "Order approved",
        message: `Order ${order.orderNo} was approved — quote is ready, send it to the customer`,
        link: "/dashboard/sales",
        entityType: "ProductionOrder",
        entityId: orderId,
      }
    : {
        type: "ORDER_REJECTED",
        title: "Order rejected",
        message: `Order ${order.orderNo} was rejected${remarks ? `: ${remarks}` : ""}`,
        link: "/dashboard/sales",
        entityType: "ProductionOrder",
        entityId: orderId,
      });

  return getOrderDetails(orderId);
}

/**
 * Explicit human action: marks the already-generated quote as actually sent
 * to the customer (email/handed over/etc.), moving the order into
 * "awaiting customer response". Kept separate from approval so "Quote Sent"
 * only ever means a person confirmed it went out.
 */
export async function markQuoteSent({ orderId, actingUserId }) {
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: { quoteApprovals: { orderBy: { generatedAt: "desc" } } },
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "APPROVED") {
    throw new Error(`Order must be approved (quote generated) before it can be marked sent (status: ${order.status})`);
  }

  const latestQuote = order.quoteApprovals.find((q) => q.status === "GENERATED");
  if (!latestQuote) throw new Error("No generated quote found for this order");

  await prisma.$transaction(async (tx) => {
    await tx.customerQuoteApproval.update({
      where: { id: latestQuote.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sentById: actingUserId || null,
      },
    });

    await tx.productionOrder.update({
      where: { id: orderId },
      data: { status: "PENDING_CUSTOMER_APPROVAL" },
    });
  });

  if (actingUserId) {
    await writeAuditLog({
      userId: actingUserId,
      action: ACTIONS.QUOTE_SENT,
      model: "ProductionOrder",
      recordId: orderId,
      newValue: { status: "PENDING_CUSTOMER_APPROVAL" },
    });
  }

  await notifyUser(order.salesRepId, {
    type: "ORDER_APPROVED",
    title: "Quote sent to customer",
    message: `Order ${order.orderNo} — quote was sent, awaiting the customer's response`,
    link: "/dashboard/sales",
    entityType: "ProductionOrder",
    entityId: orderId,
  });

  return getOrderDetails(orderId);
}

/**
 * Sales records the customer's response to the quote (approved outside the
 * system — email/call/signed copy — so this is the sales rep attesting to it).
 */
export async function recordCustomerQuoteResponse({
  orderId,
  approved,
  approvalMethod,
  evidenceUrl,
  remarks,
  markedById,
}) {
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: { quoteApprovals: { orderBy: { generatedAt: "desc" } } },
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING_CUSTOMER_APPROVAL") {
    throw new Error(`Order is not awaiting customer approval (status: ${order.status})`);
  }

  const latestQuote = order.quoteApprovals.find((q) => q.status === "SENT");
  if (!latestQuote) throw new Error("No pending quote found for this order");

  const nextQuoteStatus = approved ? "APPROVED" : "REJECTED";
  const nextOrderStatus = approved ? "CUSTOMER_APPROVED" : "REJECTED";

  await prisma.$transaction(async (tx) => {
    await tx.customerQuoteApproval.update({
      where: { id: latestQuote.id },
      data: {
        status: nextQuoteStatus,
        respondedAt: new Date(),
        markedById: markedById || null,
        approvalMethod: approvalMethod?.trim() || null,
        evidenceUrl: evidenceUrl || null,
        remarks: remarks?.trim() || null,
      },
    });

    await tx.productionOrder.update({
      where: { id: orderId },
      data: { status: nextOrderStatus },
    });
  }, { timeout: 15000 });

  if (markedById) {
    await writeAuditLog({
      userId: markedById,
      action: ACTIONS.CUSTOMER_APPROVAL_RECORDED,
      model: "ProductionOrder",
      recordId: orderId,
      newValue: { approved, approvalMethod, status: nextOrderStatus },
    });
  }

  await notifyUser(order.salesRepId, approved
    ? {
        type: "CUSTOMER_APPROVAL_RECORDED",
        title: "Customer approved quote",
        message: `Order ${order.orderNo} — ready to send to production`,
        link: "/dashboard/sales",
        entityType: "ProductionOrder",
        entityId: orderId,
      }
    : {
        type: "CUSTOMER_APPROVAL_RECORDED",
        title: "Customer rejected quote",
        message: `Order ${order.orderNo} was rejected by the customer${remarks ? `: ${remarks}` : ""}`,
        link: "/dashboard/sales",
        entityType: "ProductionOrder",
        entityId: orderId,
      });

  return getOrderDetails(orderId);
}

/**
 * Moves an order into production once the customer has approved and every
 * printed line has a cliche — hard gate, no override. Clichés are chosen in
 * the proposal, so this only fails for an order that skipped that rule.
 */
export async function sendOrderToProduction(orderId, actingUserId) {
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: { lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "CUSTOMER_APPROVED") {
    throw new Error(`Order must be customer-approved before sending to production (status: ${order.status})`);
  }

  const missingLines = order.lines.filter((l) => lineNeedsCliche(l) && !l.clicheId);
  if (missingLines.length > 0) {
    const lineNos = missingLines.map((l) => `#${l.lineNo}`).join(", ");
    throw new Error(`Cannot send to production — missing cliche on line(s): ${lineNos}`);
  }

  // Re-check the factory stock reserved at approval, then either hand the
  // order to the warehouse (something must be picked first) or straight to
  // workers — in one transaction so the check and the status agree.
  const { status, movedToWarehouse } = await prisma.$transaction(async (tx) => {
    const movedToWarehouse = await recheckMaterialSources(orderId, tx);
    const toPick = await countMaterialsToPick(orderId, tx);
    if (toPick > 0) {
      await tx.productionOrder.update({ where: { id: orderId }, data: { status: "AWAITING_MATERIALS" } });
      return { status: "AWAITING_MATERIALS", movedToWarehouse };
    }
    await startProductionStages(order, tx);
    return { status: "READY_FOR_WORK", movedToWarehouse };
  }, { timeout: 15000 });

  if (actingUserId) {
    await writeAuditLog({
      userId: actingUserId,
      action: ACTIONS.ORDER_SENT_TO_PRODUCTION,
      model: "ProductionOrder",
      recordId: orderId,
      newValue: { status, movedToWarehouse: movedToWarehouse.map((r) => r.material.name) },
    });
  }

  if (status === "AWAITING_MATERIALS") {
    notifyRoles(["WAREHOUSE"], {
      type: "ORDER_AWAITING_MATERIALS",
      title: "Materials to pick",
      message: `Order ${order.orderNo} needs materials picked from the warehouse before production can start`,
      link: `/dashboard/warehouse/orders/${orderId}`,
      entityType: "ProductionOrder",
      entityId: orderId,
    }).catch((e) => console.error("notify ORDER_AWAITING_MATERIALS failed", e));
  } else {
    notifyWorkersOrderReady(order);
  }

  return { order: await getOrderDetails(orderId), status, movedToWarehouse };
}

/** Warehouse-sourced materials of an order not yet fully picked. */
export async function countMaterialsToPick(orderId, db = prisma) {
  const rows = await db.orderLineMaterial.findMany({
    where: { orderLine: { orderId }, source: "WAREHOUSE" },
    select: { suggestedQty: true, pickedQty: true },
  });
  return rows.filter((r) => Number(r.pickedQty || 0) < Number(r.suggestedQty)).length;
}

/**
 * Opens the pipeline: the entry stage (RAW_MATERIAL) for every order line,
 * open for any worker to claim — in the caller's transaction, with the
 * status flip, so an order is never READY_FOR_WORK without its first stage.
 */
export async function startProductionStages(order, tx) {
  const rawMeta = getStageMeta("RAW_MATERIAL");
  const lines = order.lines ?? (await tx.orderLine.findMany({ where: { orderId: order.id } }));
  await tx.productionOrder.update({ where: { id: order.id }, data: { status: "READY_FOR_WORK" } });
  await tx.productionStage.createMany({
    data: lines.map((line) => ({
      orderId: order.id,
      orderLineId: line.id,
      stageType: "RAW_MATERIAL",
      sequence: 1,
      inputUnit: rawMeta?.inputUnit,
      outputUnit: rawMeta?.outputUnit,
      status: "READY",
    })),
  });
}

/** Fire-and-forget: notification fan-out shouldn't add latency. notifyRoles swallows its own errors. */
export function notifyWorkersOrderReady(order) {
  notifyRoles(["WORKER"], {
    type: "ORDER_READY_FOR_WORK",
    title: "Order ready for work",
    message: `Order ${order.orderNo} is available to pick — Raw Material stage is open`,
    link: "/dashboard/worker",
    entityType: "ProductionOrder",
    entityId: order.id,
  }).catch((e) => console.error("notify ORDER_READY_FOR_WORK failed", e));
}

/**
 * Fetch full order details including relations, approval history & assignments
 */
export async function getOrderDetails(orderId, db = prisma) {
  return db.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      salesRepUser: { select: { id: true, name: true, email: true } },
      assignedWorker: { select: { id: true, name: true, email: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          cliche: true,
          suggestedMaterials: {
            orderBy: { role: "asc" },
            include: { material: true },
          },
          stages: {
            orderBy: { sequence: "asc" },
            include: {
              worker: { select: { id: true, name: true, email: true } },
              machine: true,
              material: true,
              qcRecords: true,
            },
          },
        },
      },
      approvals: {
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      },
      quoteApprovals: {
        orderBy: { generatedAt: "desc" },
        include: {
          sentBy: { select: { id: true, name: true, email: true } },
          markedBy: { select: { id: true, name: true, email: true } },
        },
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          worker: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

/**
 * Deletes an order that never went ahead (draft, rejected or cancelled),
 * with any clichés it added that no other order has reused.
 */
export async function deleteSalesOrder(orderId) {
  await prisma.$transaction(async (tx) => {
    const added = await tx.cliche.findMany({ where: { originOrderId: orderId }, select: { id: true } });
    await tx.productionOrder.delete({ where: { id: orderId } });
    await tx.cliche.deleteMany({
      where: { id: { in: added.map((c) => c.id) }, orderLines: { none: {} } },
    });
  });
}

/**
 * Toggle an order's archived flag — pure visibility control, independent of
 * status, so an archived order still reads "Completed"/"Cancelled" and can
 * be unarchived without guessing what status to revert to.
 */
export async function setOrderArchived({ orderId, archived, userId }) {
  const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: { isArchived: !!archived },
  });

  if (userId) {
    await writeAuditLog({
      userId,
      action: archived ? ACTIONS.ORDER_ARCHIVED : ACTIONS.ORDER_UNARCHIVED,
      model: "ProductionOrder",
      recordId: orderId,
      newValue: { isArchived: !!archived },
    });
  }

  return getOrderDetails(orderId);
}

/**
 * Cancels an order without deleting anything — for "added something wrong"
 * or a customer backing out mid-pipeline. Any open (READY, unclaimed)
 * production stages drop out of the worker pool immediately since
 * getAvailableStages/getMyActiveStages filter on the order's status.
 */
export async function cancelOrder({ orderId, reason, userId }) {
  const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (["COMPLETED", "CANCELLED"].includes(order.status)) {
    throw new Error(`Order cannot be cancelled from status: ${order.status}`);
  }
  if (!reason?.trim()) throw new Error("A cancellation reason is required");

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED", cancelReason: reason.trim() },
  });

  if (userId) {
    await writeAuditLog({
      userId,
      action: ACTIONS.ORDER_CANCELLED,
      model: "ProductionOrder",
      recordId: orderId,
      oldValue: { status: order.status },
      newValue: { status: "CANCELLED", reason: reason.trim() },
    });
  }

  if (order.salesRepId) {
    notifyUser(order.salesRepId, {
      type: "ORDER_REJECTED",
      title: "Order cancelled",
      message: `Order ${order.orderNo} was cancelled: ${reason.trim()}`,
      link: "/dashboard/sales",
      entityType: "ProductionOrder",
      entityId: orderId,
    }).catch((e) => console.error("notify ORDER_CANCELLED failed", e));
  }

  return getOrderDetails(orderId);
}

