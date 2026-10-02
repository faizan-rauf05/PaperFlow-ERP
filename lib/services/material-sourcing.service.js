import { prisma } from "@/lib/prisma";
import { getStockByMaterial } from "@/lib/services/stock.service";

/**
 * Where each suggested material of an order comes from: stock already in the
 * factory, or a warehouse pick. Decided at manager approval and re-checked at
 * send-to-production.
 *
 * Factory stock another open order is counting on isn't free: an order holds
 * what it sourced from the factory (or has picked into it) until production
 * uses it up. Its use is read from the ledger — stage movements carry the
 * order number as referenceId — so a hold shrinks as the order consumes.
 */

// Orders whose factory-sourced/picked materials are still held for them.
const HOLDING_STATUSES = [
  "APPROVED",
  "PENDING_CUSTOMER_APPROVAL",
  "CUSTOMER_APPROVED",
  "AWAITING_MATERIALS",
  "READY_FOR_WORK",
  "PICKED",
  "IN_PROGRESS",
  "RUNNING",
];

const key = (orderNo, materialId) => `${orderNo}|${materialId}`;

/** Factory stock of each material held by open orders other than `excludeOrderId`. Map<materialId, number>. */
async function getFactoryHolds(materialIds, excludeOrderId, db) {
  const rows = await db.orderLineMaterial.findMany({
    where: {
      materialId: { in: materialIds },
      source: { not: null },
      orderLine: { order: { status: { in: HOLDING_STATUSES }, id: { not: excludeOrderId } } },
    },
    select: {
      materialId: true,
      source: true,
      suggestedQty: true,
      pickedQty: true,
      orderLine: { select: { order: { select: { orderNo: true } } } },
    },
  });

  const held = new Map(); // orderNo|materialId -> qty held
  for (const r of rows) {
    const need = Number(r.suggestedQty);
    // A warehouse row only holds factory stock once it has been picked into it.
    const qty = r.source === "FACTORY" ? need : Math.min(Number(r.pickedQty || 0), need);
    const k = key(r.orderLine.order.orderNo, r.materialId);
    held.set(k, (held.get(k) || 0) + qty);
  }
  if (held.size === 0) return new Map();

  const orderNos = [...new Set(rows.map((r) => r.orderLine.order.orderNo))];
  const used = await db.inventoryTransaction.groupBy({
    by: ["referenceId", "materialId"],
    where: {
      materialId: { in: materialIds },
      referenceId: { in: orderNos },
      location: "FACTORY",
      transactionType: { in: ["ISSUE", "RESTOCK"] },
    },
    _sum: { quantity: true },
  });
  const usedBy = new Map(used.map((u) => [key(u.referenceId, u.materialId), -Number(u._sum.quantity || 0)]));

  const holds = new Map();
  for (const [k, qty] of held) {
    const materialId = k.split("|")[1];
    const outstanding = Math.max(0, qty - (usedBy.get(k) || 0));
    holds.set(materialId, (holds.get(materialId) || 0) + outstanding);
  }
  return holds;
}

/**
 * Plans the source of every stock-backed suggestion on an order. A row goes
 * to FACTORY when it's requested (or, with no request, by default) and the
 * free factory stock still covers it after earlier rows of the same material;
 * otherwise WAREHOUSE. Returns the rows annotated with live stock figures.
 */
async function planSources(orderId, requested, db) {
  const rows = await db.orderLineMaterial.findMany({
    where: { orderLine: { orderId }, materialId: { not: null } },
    include: {
      material: { select: { id: true, name: true, code: true, barCode: true, unit: true, materialType: true } },
      orderLine: { select: { lineNo: true } },
    },
    orderBy: [{ orderLine: { lineNo: "asc" } }, { createdAt: "asc" }],
  });

  const materialIds = [...new Set(rows.map((r) => r.materialId))];
  const [stock, holds] = await Promise.all([
    getStockByMaterial(materialIds, db),
    getFactoryHolds(materialIds, orderId, db),
  ]);
  const free = new Map(materialIds.map((id) => [id, stock.get(id).FACTORY - (holds.get(id) || 0)]));

  return rows.map((row) => {
    const need = Number(row.suggestedQty);
    const factoryFree = Math.max(0, free.get(row.materialId));
    const factoryCovers = factoryFree >= need;
    const wanted = requested[row.id] ?? "FACTORY";
    const source = wanted === "FACTORY" && factoryCovers ? "FACTORY" : "WAREHOUSE";
    if (source === "FACTORY") free.set(row.materialId, free.get(row.materialId) - need);
    return {
      id: row.id,
      role: row.role,
      lineNo: row.orderLine.lineNo,
      material: row.material,
      suggestedQty: need,
      unit: row.unit,
      pickedQty: row.pickedQty != null ? Number(row.pickedQty) : null,
      currentSource: row.source,
      source,
      factoryStock: stock.get(row.materialId).FACTORY,
      factoryFree,
      warehouseStock: stock.get(row.materialId).WAREHOUSE,
      factoryCovers,
    };
  });
}

/**
 * Live sourcing preview for an order (manager approval screen). `requested`
 * maps suggestion id -> "FACTORY" | "WAREHOUSE" for the approver's choices.
 */
export async function getMaterialSourcing(orderId, requested = {}, db = prisma) {
  return planSources(orderId, requested, db);
}

/**
 * Saves each suggestion's source. A FACTORY request the factory can't cover
 * falls back to WAREHOUSE. Returns the rows that asked for the factory but
 * had to fall back, so the caller can say so.
 */
export async function assignMaterialSources(orderId, requested = {}, db = prisma) {
  const plan = await planSources(orderId, requested, db);
  for (const row of plan) {
    if (row.currentSource !== row.source) {
      await db.orderLineMaterial.update({ where: { id: row.id }, data: { source: row.source } });
    }
  }
  return plan.filter((row) => (requested[row.id] ?? "FACTORY") === "FACTORY" && row.source === "WAREHOUSE");
}

/**
 * Re-check at send-to-production: keeps every row's approved source unless a
 * factory row is no longer covered (stock used or held by another order
 * since approval), which moves to WAREHOUSE. Rows already picked stay put.
 */
export async function recheckMaterialSources(orderId, db = prisma) {
  const rows = await db.orderLineMaterial.findMany({
    where: { orderLine: { orderId }, materialId: { not: null } },
    select: { id: true, source: true },
  });
  const requested = Object.fromEntries(rows.map((r) => [r.id, r.source || "FACTORY"]));
  return assignMaterialSources(orderId, requested, db);
}
