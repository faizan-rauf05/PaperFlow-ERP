import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStockByMaterial, getMaterialStock, transferStock } from "@/lib/services/stock.service";
import {
  countMaterialsToPick,
  getOrderDetails,
  notifyWorkersOrderReady,
  startProductionStages,
} from "@/lib/services/order-workflow.service";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { computePaperWeightKg, lineBagWeight } from "@/lib/paper-sizing";

const { Decimal } = Prisma;

// A picked quantity can never exceed this multiple of what was suggested —
// a generous ceiling that still catches an obvious fat-finger entry (e.g.
// typing an extra digit) without blocking a legitimate slightly-larger pick.
// Paper rolls are exempt: the whole roll always moves.
const MAX_PICK_MULTIPLE_OF_SUGGESTED = 5;

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function remainingToPick(olm) {
  const suggested = new Decimal(olm.suggestedQty.toString());
  const picked = olm.pickedQty != null ? new Decimal(olm.pickedQty.toString()) : new Decimal(0);
  const remaining = suggested.sub(picked);
  return remaining.isNegative() ? new Decimal(0) : remaining;
}

/**
 * Orders sent to production that are waiting on warehouse picks
 * (AWAITING_MATERIALS — no stages exist yet, so workers can't start). Each
 * material is annotated with where it comes from: factory rows are already
 * in place (shown for context, nothing to do); warehouse rows carry
 * remaining-to-pick and a live shortage flag against WAREHOUSE stock. Never
 * includes price/total/profit — a warehouse-facing view.
 */
export async function getOrdersPendingMaterials() {
  const orders = await prisma.productionOrder.findMany({
    where: { status: "AWAITING_MATERIALS", isArchived: false },
    include: {
      customer: { select: { id: true, name: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          suggestedMaterials: {
            where: { materialId: { not: null }, source: { not: null } },
            orderBy: { role: "asc" },
            include: {
              material: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  barCode: true,
                  materialType: true,
                  unit: true,
                  paperWidthCm: true,
                  gsm: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { deliveryDate: "asc" },
  });

  const materialIds = [
    ...new Set(orders.flatMap((o) => o.lines.flatMap((l) => l.suggestedMaterials.map((m) => m.materialId)))),
  ];
  const stockByMaterial = await getStockByMaterial(materialIds);

  const results = [];
  for (const order of orders) {
    let orderHasShortage = false;
    let orderFullyPicked = true;
    const lines = [];

    for (const line of order.lines) {
      const materials = line.suggestedMaterials.map((olm) => {
        const stock = stockByMaterial.get(olm.materialId);
        const fromFactory = olm.source === "FACTORY";
        const remaining = fromFactory ? new Decimal(0) : remainingToPick(olm);
        const isPicked = !fromFactory && remaining.lte(0);
        const hasShortage = !fromFactory && !isPicked && new Decimal(stock.WAREHOUSE).lessThan(remaining);
        if (!fromFactory && !isPicked) orderFullyPicked = false;
        if (hasShortage) orderHasShortage = true;
        return {
          id: olm.id,
          role: olm.role,
          source: olm.source,
          isRoll: olm.role === "ROLL",
          material: olm.material,
          suggestedQty: Number(olm.suggestedQty),
          unit: olm.unit,
          pickedQty: olm.pickedQty != null ? Number(olm.pickedQty) : null,
          pickedAt: olm.pickedAt,
          pickProofUrls: Array.isArray(olm.pickProofUrls) ? olm.pickProofUrls : [],
          remainingQty: remaining.toNumber(),
          warehouseStock: stock.WAREHOUSE,
          factoryStock: stock.FACTORY,
          isPicked,
          hasShortage,
          ...(olm.role === "ROLL" && olm.material.gsm
            ? {
                paperWeightKg: computePaperWeightKg(olm.suggestedQty, olm.material.paperWidthCm, olm.material.gsm),
                bagWeight: lineBagWeight(line, olm.material.gsm),
              }
            : {}),
        };
      });

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
 * Records a warehouse pick for one warehouse-sourced OrderLineMaterial:
 * moves the stock warehouse → factory and adds to pickedQty, with photo proof,
 * in one transaction. A paper roll moves whole (all its warehouse metres);
 * other materials move the quantity entered. When this was the order's last outstanding pick, the order
 * is released to workers in the same transaction.
 */
export async function pickOrderLineMaterial({
  orderId,
  orderLineMaterialId,
  pickedQty,
  proofUrls,
  actingUserId,
}) {
  const proofs = Array.isArray(proofUrls) ? proofUrls.filter(Boolean) : [];
  if (proofs.length === 0) throw httpError("Upload a photo as proof of the transfer", 400);

  const olm = await prisma.orderLineMaterial.findUnique({
    where: { id: orderLineMaterialId },
    include: {
      material: true,
      orderLine: { select: { id: true, orderId: true } },
    },
  });

  if (!olm || olm.orderLine.orderId !== orderId || !olm.material) {
    throw httpError("Order material line not found for this order", 404);
  }
  if (olm.source !== "WAREHOUSE") {
    throw httpError("This material is already in the factory — nothing to pick", 409);
  }

  const order = await prisma.productionOrder.findUnique({ where: { id: orderId }, include: { lines: true } });
  if (!order) throw httpError("Order not found", 404);
  if (order.status !== "AWAITING_MATERIALS") {
    throw httpError(`Order isn't waiting for materials (status: ${order.status})`, 409);
  }

  const remaining = remainingToPick(olm);
  if (remaining.lte(0)) throw httpError("This material has already been fully picked for this order", 409);

  const isRoll = olm.role === "ROLL";
  let moveQty;
  if (isRoll) {
    moveQty = await getMaterialStock(olm.materialId, "WAREHOUSE");
    if (moveQty.lte(0)) throw httpError(`${olm.material.name} has no metres left in the warehouse`, 409);
  } else {
    const qty = Number(pickedQty);
    if (!Number.isFinite(qty) || qty <= 0) throw httpError("Picked quantity must be a positive number", 400);
    if (qty > Number(olm.suggestedQty) * MAX_PICK_MULTIPLE_OF_SUGGESTED) {
      throw httpError(
        `Picked quantity (${qty}) looks too large for the suggested amount (${Number(olm.suggestedQty)} ${olm.unit}) — please double-check.`,
        400,
      );
    }
    moveQty = new Decimal(qty);
  }
  // A roll's extra metres move with it but only this order's need counts as picked.
  const pickedIncrement = isRoll ? Decimal.min(moveQty, remaining) : moveQty;
  const previousProofs = Array.isArray(olm.pickProofUrls) ? olm.pickProofUrls : [];

  const { updatedOlm, released } = await prisma.$transaction(async (tx) => {
    await transferStock(
      {
        materialId: olm.materialId,
        from: "WAREHOUSE",
        to: "FACTORY",
        quantity: moveQty,
        referenceId: order.orderNo,
        remarks: isRoll ? `Whole roll moved for order ${order.orderNo}` : `Picked for order ${order.orderNo}`,
        createdById: actingUserId || null,
      },
      tx,
    );
    const updatedOlm = await tx.orderLineMaterial.update({
      where: { id: olm.id },
      data: {
        pickedQty: { increment: pickedIncrement },
        pickedAt: new Date(),
        pickedById: actingUserId || null,
        pickProofUrls: [...previousProofs, ...proofs],
      },
    });

    const released = (await countMaterialsToPick(orderId, tx)) === 0;
    if (released) await startProductionStages(order, tx);
    return { updatedOlm, released };
  }, { timeout: 15000 });

  if (actingUserId) {
    await writeAuditLog({
      userId: actingUserId,
      action: ACTIONS.ORDER_MATERIAL_PICKED,
      model: "OrderLineMaterial",
      recordId: olm.id,
      newValue: {
        orderId,
        materialId: olm.materialId,
        movedQty: Number(moveQty),
        pickedQty: Number(pickedIncrement),
        unit: olm.unit,
        wholeRoll: isRoll,
        proofUrls: proofs,
        releasedToWorkers: released,
      },
    });
  }
  if (released) notifyWorkersOrderReady(order);

  return { orderLineMaterial: updatedOlm, released, order: await getOrderDetails(orderId) };
}
