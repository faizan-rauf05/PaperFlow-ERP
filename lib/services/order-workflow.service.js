import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { renderQuotePdfBuffer } from "@/lib/pdf/quote-document";
import { uploadPdfToCloudinary } from "@/lib/cloudinary";
import { notifyUser, notifyRoles } from "@/lib/services/notification.service";
import { getStageMeta } from "@/lib/production-constants";
import { computeOrderLineMaterialNeeds, findBestPaperRoll, findBestStockMatch } from "@/lib/material-suggestion";

const { Decimal } = Prisma;

function dec(v) {
  if (v == null || v === "") return new Decimal(0);
  return new Decimal(v.toString());
}

/**
 * Computes and saves the "best match" material suggestions (paper roll,
 * glue, rope, ink) for one order line. Best-effort: a failure here (e.g. no
 * stock fits) shouldn't block order creation, so callers wrap this in
 * try/catch and log rather than throw.
 */
async function generateSuggestionsForLine(line) {
  const needs = computeOrderLineMaterialNeeds(line);
  const rows = [];

  const { bestMatch: roll, reason: rollReason } = await findBestPaperRoll({
    paperType: line.paperType,
    paperColor: line.paperColor,
    rollWidthCm: needs.rollWidthCm,
    paperLengthNeededM: needs.paperLengthNeededM,
  });
  if (roll) {
    rows.push({
      materialId: roll.id,
      role: "ROLL",
      suggestedQty: needs.paperLengthNeededM,
      unit: "METER",
      suggestedCost: needs.paperLengthNeededM * Number(roll.costPricePerUnit || 0),
      reason: rollReason,
    });
  }

  const otherNeeds = [
    { role: "GLUE", materialType: "GLUE", qty: needs.glueNeededKg, unit: "KG" },
    { role: "ROPE", materialType: "ROPE", qty: needs.ropeNeededM, unit: "METER" },
    { role: "INK", materialType: "INK", qty: needs.inkNeededKg, unit: "KG" },
  ];

  for (const { role, materialType, qty, unit } of otherNeeds) {
    if (qty <= 0) continue;
    const { bestMatch, reason } = await findBestStockMatch({ materialType, quantityNeeded: qty, unit });
    if (bestMatch) {
      rows.push({
        materialId: bestMatch.id,
        role,
        suggestedQty: qty,
        unit,
        suggestedCost: qty * Number(bestMatch.costPricePerUnit || 0),
        reason,
      });
    }
  }

  if (rows.length > 0) {
    await prisma.orderLineMaterial.createMany({
      data: rows.map((r) => ({ orderLineId: line.id, ...r })),
    });
  }
}

/**
 * Regenerates material suggestions for every line on an order — drops any
 * existing suggestions for those lines first (cascade on orderLine delete
 * handles this when lines are replaced wholesale; called explicitly here
 * for the create path where lines are new).
 */
async function generateOrderMaterialSuggestions(orderId) {
  const lines = await prisma.orderLine.findMany({ where: { orderId } });
  for (const line of lines) {
    await generateSuggestionsForLine(line);
  }
}

/**
 * Generates sequential order number PO-YYYY-XXXX
 */
export async function generateOrderNo() {
  const count = await prisma.productionOrder.count();
  const year = new Date().getFullYear();
  return `PO-${year}-${String(count + 1).padStart(4, "0")}`;
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
  const lineTotal = line.lineTotal != null ? dec(line.lineTotal) : null;

  // Auto calculate unit price if line total is provided and unit price is missing
  let unitPrice = line.unitPrice != null ? dec(line.unitPrice) : null;
  if (!unitPrice && lineTotal && qty.gt(0)) {
    unitPrice = lineTotal.div(qty);
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
  };
}

/**
 * Creates a new Order in DRAFT or PENDING_APPROVAL status.
 */
export async function createSalesOrder({
  customerId,
  salesRepId,
  priority = "NORMAL",
  deliveryDate,
  notes,
  subtotal,
  discount = 0,
  total,
  proposedTotal,
  lines = [],
  status = "PENDING_APPROVAL", // "DRAFT" or "PENDING_APPROVAL"
  createdById,
}) {
  if (!customerId) throw new Error("Customer is required");
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("At least one order line is required");
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error("Customer not found");

  let salesRepUser = null;
  if (salesRepId) {
    salesRepUser = await prisma.user.findFirst({
      where: { id: salesRepId, role: "SALES", isActive: true },
    });
  }

  const orderNo = await generateOrderNo();
  const subTotalDec = dec(subtotal || 0);
  const discountDec = dec(discount || 0);
  const totalDec = total != null ? dec(total) : subTotalDec.sub(discountDec);
  const proposedTotalDec = proposedTotal != null ? dec(proposedTotal) : totalDec;

  const targetStatus = ["DRAFT", "PENDING_APPROVAL"].includes(status)
    ? status
    : "PENDING_APPROVAL";

  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.create({
      data: {
        orderNo,
        customerId,
        salesRepId: salesRepUser?.id || salesRepId || null,
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

    await tx.orderLine.createMany({
      data: lines.map((line, i) => ({
        orderId: order.id,
        ...formatOrderLineData(line, i),
      })),
    });

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

    return order.id;
  });

  try {
    await generateOrderMaterialSuggestions(orderId);
  } catch (err) {
    console.error("Material suggestion generation failed for order", orderId, err);
  }

  if (createdById) {
    await writeAuditLog({
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
    });
  }

  if (targetStatus === "PENDING_APPROVAL") {
    await notifyRoles(["MANAGER", "ADMIN"], {
      type: "ORDER_PENDING_APPROVAL",
      title: "New order awaiting approval",
      message: `Order ${orderNo} for ${customer.name} needs your review`,
      link: "/dashboard/manager",
      entityType: "ProductionOrder",
      entityId: orderId,
    });
  }

  return getOrderDetails(orderId);
}

/**
 * Updates an order. If edited after approval/ready status, resets to PENDING_APPROVAL.
 */
export async function updateSalesOrder(orderId, data, userId) {
  const existingOrder = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: { lines: true, approvals: true },
  });

  if (!existingOrder) throw new Error("Order not found");

  const isApprovedOrReady = ["APPROVED", "READY_FOR_WORK", "PICKED", "IN_PROGRESS"].includes(
    existingOrder.status,
  );

  let newStatus = data.status || existingOrder.status;
  // If materially editing an already approved order, reset to PENDING_APPROVAL
  if (isApprovedOrReady && data.lines) {
    newStatus = "PENDING_APPROVAL";
  }

  const subTotalDec = data.subtotal != null ? dec(data.subtotal) : existingOrder.subtotal;
  const discountDec = data.discount != null ? dec(data.discount) : existingOrder.discount;
  const totalDec = data.total != null ? dec(data.total) : (subTotalDec ? subTotalDec.sub(discountDec) : existingOrder.total);
  const proposedTotalDec = data.proposedTotal != null ? dec(data.proposedTotal) : totalDec;

  await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        customerId: data.customerId || existingOrder.customerId,
        salesRepId: data.salesRepId !== undefined ? data.salesRepId : existingOrder.salesRepId,
        priority: data.priority || existingOrder.priority,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : existingOrder.deliveryDate,
        notes: data.notes !== undefined ? data.notes : existingOrder.notes,
        status: newStatus,
        subtotal: subTotalDec,
        discount: discountDec,
        total: totalDec,
        proposedTotal: proposedTotalDec,
      },
    });

    if (Array.isArray(data.lines)) {
      // Replace lines
      await tx.orderLine.deleteMany({ where: { orderId } });
      for (let i = 0; i < data.lines.length; i++) {
        const formattedLine = formatOrderLineData(data.lines[i], i);
        await tx.orderLine.create({
          data: {
            orderId,
            ...formattedLine,
          },
        });
      }
    }

    // Create new approval history record if submitted or reset to PENDING_APPROVAL
    if (newStatus === "PENDING_APPROVAL") {
      await tx.orderApproval.create({
        data: {
          orderId,
          requestedById: userId || null,
          status: "PENDING",
          proposedTotal: proposedTotalDec,
          remarks: isApprovedOrReady
            ? "Order edited after approval; re-submitted for manager review"
            : "Order revised & submitted for approval",
        },
      });
    }
  }, { timeout: 15000 });

  if (Array.isArray(data.lines)) {
    try {
      await generateOrderMaterialSuggestions(orderId);
    } catch (err) {
      console.error("Material suggestion generation failed for order", orderId, err);
    }
  }

  if (userId) {
    await writeAuditLog({
      userId,
      action: "ORDER_UPDATED",
      model: "ProductionOrder",
      recordId: orderId,
      oldValue: { status: existingOrder.status, total: Number(existingOrder.total || 0) },
      newValue: { status: newStatus, total: Number(totalDec || 0) },
    });
  }

  return getOrderDetails(orderId);
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
    const pdfBuffer = await renderQuotePdfBuffer(fullOrder, approver);
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
        message: `Order ${order.orderNo} — assign cliche(s) and send it to production`,
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
 * line has a cliche assigned — hard gate, no override.
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

  const missingLines = order.lines.filter((l) => !l.clicheId);
  if (missingLines.length > 0) {
    const lineNos = missingLines.map((l) => `#${l.lineNo}`).join(", ");
    throw new Error(`Cannot send to production — missing cliche on line(s): ${lineNos}`);
  }

  // Kick off the pipeline: the entry stage (RAW_MATERIAL) for every order
  // line, open for any worker to claim — same transaction as the status
  // flip so an order is never READY_FOR_WORK without its first stage.
  const rawMeta = getStageMeta("RAW_MATERIAL");
  await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id: orderId },
      data: { status: "READY_FOR_WORK" },
    });

    await tx.productionStage.createMany({
      data: order.lines.map((line) => ({
        orderId,
        orderLineId: line.id,
        stageType: "RAW_MATERIAL",
        sequence: 1,
        inputUnit: rawMeta?.inputUnit,
        outputUnit: rawMeta?.outputUnit,
        status: "READY",
      })),
    });
  });

  if (actingUserId) {
    await writeAuditLog({
      userId: actingUserId,
      action: ACTIONS.ORDER_SENT_TO_PRODUCTION,
      model: "ProductionOrder",
      recordId: orderId,
      newValue: { status: "READY_FOR_WORK" },
    });
  }

  // Fire-and-forget: notification fan-out (one row per active worker)
  // shouldn't add latency to this response. notifyRoles swallows its own errors.
  notifyRoles(["WORKER"], {
    type: "ORDER_READY_FOR_WORK",
    title: "Order ready for work",
    message: `Order ${order.orderNo} is available to pick — Raw Material stage is open`,
    link: "/dashboard/worker",
    entityType: "ProductionOrder",
    entityId: orderId,
  }).catch((e) => console.error("notify ORDER_READY_FOR_WORK failed", e));

  return getOrderDetails(orderId);
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

