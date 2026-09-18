import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMaterialStock } from "@/lib/services/inventory.service";
import { getOrderDetails } from "@/lib/services/order-workflow.service";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

const { Decimal } = Prisma;

// A picked quantity can never exceed this multiple of what was suggested —
// a generous ceiling that still catches an obvious fat-finger entry (e.g.
// typing an extra digit) without blocking a legitimate slightly-larger pick.
const MAX_PICK_MULTIPLE_OF_SUGGESTED = 5;

/**
 * Orders considered "in the warehouse fulfillment queue": READY_FOR_WORK is
 * the point sendOrderToProduction() moves an order to once the customer has
 * approved it and every line has a cliche — the earliest point picking makes
 * sense (anything before that, e.g. CUSTOMER_APPROVED, can still be edited
 * or rejected, so warehouse shouldn't be pulling stock against it yet).
 * IN_PROGRESS/PICKED are included too so fulfillment already underway still
 * shows up until every line is fully picked.
 */
const FULFILLMENT_STATUSES = ["READY_FOR_WORK", "PICKED", "IN_PROGRESS"];

function remainingToPick(olm) {
  const suggested = new Decimal(olm.suggestedQty.toString());
  const picked = olm.pickedQty != null ? new Decimal(olm.pickedQty.toString()) : new Decimal(0);
  const remaining = suggested.sub(picked);
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

/**
 * Orders awaiting (or mid-way through) material picking, each annotated
 * with per-line-material remaining-to-pick and a live shortage flag
 * (remaining need vs. current stock). Never includes price/total/profit —
 * this is a warehouse-facing view.
 */
export async function getOrdersPendingMaterials() {
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: { in: FULFILLMENT_STATUSES },
      isArchived: false,
    },
    include: {
      customer: { select: { id: true, name: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          suggestedMaterials: {
            include: {
              material: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  barCode: true,
                  materialType: true,
                  unit: true,
                  minimumStock: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { deliveryDate: "asc" },
  });

  const stockCache = new Map();
  const getStock = async (materialId) => {
    if (!stockCache.has(materialId)) {
      stockCache.set(materialId, await getMaterialStock(materialId));
    }
    return stockCache.get(materialId);
  };

  const results = [];
  for (const order of orders) {
    let orderHasShortage = false;
    let orderFullyPicked = true;
    const lines = [];

    for (const line of order.lines) {
      const materials = [];
      for (const olm of line.suggestedMaterials) {
        const remaining = remainingToPick(olm);
        const isPicked = remaining.lte(0);
        if (!isPicked) orderFullyPicked = false;

        const stock = await getStock(olm.materialId);
        const hasShortage = !isPicked && stock.lessThan(remaining);
        if (hasShortage) orderHasShortage = true;

        materials.push({
          id: olm.id,
          role: olm.role,
          material: olm.material,
          suggestedQty: Number(olm.suggestedQty),
          unit: olm.unit,
          pickedQty: olm.pickedQty != null ? Number(olm.pickedQty) : null,
          pickedAt: olm.pickedAt,
          remainingQty: remaining.toNumber(),
          availableStock: stock.toNumber(),
          isPicked,
          hasShortage,
        });
      }

      if (materials.length > 0) {
        lines.push({
          id: line.id,
          lineNo: line.lineNo,
          paperType: line.paperType,
          paperColor: line.paperColor,
          withHandle: line.withHandle,
          plannedQty: line.plannedQty != null ? Number(line.plannedQty) : null,
          materials,
        });
      }
    }

    if (lines.length === 0) continue;

    results.push({
      id: order.id,
      orderNo: order.orderNo,
      status: order.status,
      priority: order.priority,
      deliveryDate: order.deliveryDate,
      customer: order.customer,
      hasShortage: orderHasShortage,
      isFullyPicked: orderFullyPicked,
      lines,
    });
  }

  return results;
}

/**
 * Records a warehouse pick for one OrderLineMaterial: sets
 * pickedQty/pickedAt/pickedById and posts a matching STOCK_OUT
 * InventoryTransaction, in a single transaction so the two writes never
 * diverge. Optionally validates a scanned barcode against the target
 * material's barCode first — a mismatch is rejected, never silently ignored.
 *
 * Re-picking an already-fully-picked line is rejected (409) rather than
 * silently allowed — if a correction is genuinely needed, that's a distinct,
 * deliberate action outside this endpoint's scope for now.
 */
export async function pickOrderLineMaterial({
  orderId,
  orderLineMaterialId,
  pickedQty,
  scannedBarcode,
  actingUserId,
}) {
  const qty = Number(pickedQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    const error = new Error("Picked quantity must be a positive number");
    error.status = 400;
    throw error;
  }

  const olm = await prisma.orderLineMaterial.findUnique({
    where: { id: orderLineMaterialId },
    include: {
      material: true,
      orderLine: { select: { id: true, orderId: true } },
    },
  });

  if (!olm || olm.orderLine.orderId !== orderId) {
    const error = new Error("Order material line not found for this order");
    error.status = 404;
    throw error;
  }

  if (olm.pickedQty != null && new Decimal(olm.pickedQty.toString()).gte(olm.suggestedQty.toString())) {
    const error = new Error("This material has already been fully picked for this order");
    error.status = 409;
    throw error;
  }

  if (scannedBarcode) {
    const expected = (olm.material.barCode || "").trim();
    if (!expected || expected !== scannedBarcode.trim()) {
      const error = new Error(
        `Barcode mismatch: scanned code does not match ${olm.material.name}'s barcode`,
      );
      error.status = 422;
      error.code = "BARCODE_MISMATCH";
      throw error;
    }
  }

  const maxAllowed = Number(olm.suggestedQty) * MAX_PICK_MULTIPLE_OF_SUGGESTED;
  if (qty > maxAllowed) {
    const error = new Error(
      `Picked quantity (${qty}) looks too large for the suggested amount (${Number(olm.suggestedQty)} ${olm.unit}) — please double-check.`,
    );
    error.status = 400;
    throw error;
  }

  const order = await prisma.productionOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    const error = new Error("Order not found");
    error.status = 404;
    throw error;
  }

  const [updatedOlm] = await prisma.$transaction([
    prisma.orderLineMaterial.update({
      where: { id: olm.id },
      data: {
        pickedQty: qty,
        pickedAt: new Date(),
        pickedById: actingUserId || null,
      },
    }),
    prisma.inventoryTransaction.create({
      data: {
        materialId: olm.materialId,
        transactionType: "STOCK_OUT",
        quantity: qty,
        unit: olm.unit,
        referenceId: order.orderNo,
        remarks: `Picked for order ${order.orderNo}`,
        createdById: actingUserId || null,
      },
    }),
  ]);

  if (actingUserId) {
    await writeAuditLog({
      userId: actingUserId,
      action: ACTIONS.ORDER_MATERIAL_PICKED,
      model: "OrderLineMaterial",
      recordId: olm.id,
      newValue: { orderId, materialId: olm.materialId, pickedQty: qty, unit: olm.unit },
    });
  }

  return { orderLineMaterial: updatedOlm, order: await getOrderDetails(orderId) };
}
