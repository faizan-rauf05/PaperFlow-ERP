import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STOCK_LOCATIONS, STOCK_LOCATION_LABELS, emptyStock } from "@/lib/stock-locations";
import { formatQuantity } from "@/lib/material-catalog";

const { Decimal } = Prisma;

/**
 * Stock ledger (docs/INVENTORY_DESIGN.md). Every movement is an
 * InventoryTransaction with a location and a signed quantity, so stock at a
 * location is simply the sum of its entries. All stock reads and writes go
 * through this module.
 */

function toDecimal(value) {
  return new Decimal(value?.toString?.() ?? value ?? 0);
}

// ── Reads ──────────────────────────────────────────────────────────────────

/**
 * Stock per location for many materials in one query.
 * Returns Map<materialId, { WAREHOUSE, FACTORY, total }> (numbers).
 */
export async function getStockByMaterial(materialIds, db = prisma) {
  const rows = await db.inventoryTransaction.groupBy({
    by: ["materialId", "location"],
    where: materialIds ? { materialId: { in: materialIds } } : undefined,
    _sum: { quantity: true },
  });
  const stock = new Map();
  for (const id of materialIds || []) stock.set(id, emptyStock());
  for (const row of rows) {
    const entry = stock.get(row.materialId) || emptyStock();
    const qty = Number(row._sum.quantity || 0);
    entry[row.location] += qty;
    entry.total += qty;
    stock.set(row.materialId, entry);
  }
  return stock;
}

/** Stock of one material at one location (or across all locations when omitted), as a Decimal. */
export async function getMaterialStock(materialId, location = undefined, db = prisma) {
  const { _sum } = await db.inventoryTransaction.aggregate({
    where: { materialId, ...(location ? { location } : {}) },
    _sum: { quantity: true },
  });
  return toDecimal(_sum.quantity);
}

/** Adds `stock: { WAREHOUSE, FACTORY, total }` to each material. */
export async function withStock(materials, db = prisma) {
  const stock = await getStockByMaterial(
    materials.map((m) => m.id),
    db,
  );
  return materials.map((m) => ({ ...m, stock: stock.get(m.id) || emptyStock() }));
}

// ── Writes ─────────────────────────────────────────────────────────────────

async function loadMaterial(materialId, db) {
  const material = await db.material.findUnique({ where: { id: materialId } });
  if (!material) throw new Error("Material not found");
  return material;
}

function assertLocation(location) {
  if (!STOCK_LOCATIONS.includes(location)) throw new Error(`Unknown stock location: ${location}`);
}

/** Soft check: a movement that takes a location below zero is allowed but reported back. */
async function belowZeroWarning(material, location, outgoing, db) {
  const available = await getMaterialStock(material.id, location, db);
  if (available.sub(outgoing).gte(0)) return null;
  return `${material.name} at the ${STOCK_LOCATION_LABELS[location].toLowerCase()} goes below zero (available: ${formatQuantity(available, material.unit)}).`;
}

async function insertMovement(db, { material, location, transactionType, quantity, ...rest }) {
  return db.inventoryTransaction.create({
    data: {
      materialId: material.id,
      location,
      transactionType,
      quantity,
      unit: material.unit,
      receiptId: rest.receiptId || null,
      transferId: rest.transferId || null,
      stageId: rest.stageId || null,
      referenceId: rest.referenceId || null,
      remarks: rest.remarks || null,
      createdById: rest.createdById || null,
    },
  });
}

/**
 * Issues stock from a location to production. `quantity` is positive; it's
 * recorded as a negative ISSUE movement. (Production waste is not a further
 * stock movement — it's part of what was issued, recorded on the stage.)
 */
export async function consumeStock({ materialId, location, quantity, ...rest }, db = prisma) {
  assertLocation(location);
  const qty = toDecimal(quantity);
  if (qty.lte(0)) throw new Error("Quantity must be greater than 0");
  const material = await loadMaterial(materialId, db);
  const warning = await belowZeroWarning(material, location, qty, db);
  const transaction = await insertMovement(db, { material, location, transactionType: "ISSUE", quantity: qty.neg(), ...rest });
  return { transaction, warning };
}

/** Puts a usable production leftover back into stock at a location. */
export async function restockLeftover({ materialId, location, quantity, ...rest }, db = prisma) {
  assertLocation(location);
  const qty = toDecimal(quantity);
  if (qty.lte(0)) throw new Error("Quantity must be greater than 0");
  const material = await loadMaterial(materialId, db);
  const transaction = await insertMovement(db, { material, location, transactionType: "RESTOCK", quantity: qty, ...rest });
  return { transaction };
}

/**
 * Moves stock between locations: two TRANSFER entries sharing a transferId
 * (− at the source, + at the destination). Pass an interactive-transaction
 * client as `db` to make it part of a larger atomic write (e.g. order
 * picking); otherwise it runs in its own transaction.
 */
export async function transferStock({ materialId, from, to, quantity, ...rest }, db = null) {
  assertLocation(from);
  assertLocation(to);
  if (from === to) throw new Error("Choose two different locations");
  const qty = toDecimal(quantity);
  if (qty.lte(0)) throw new Error("Quantity must be greater than 0");

  const write = async (tx) => {
    const material = await loadMaterial(materialId, tx);
    const warning = await belowZeroWarning(material, from, qty, tx);
    const transferId = randomUUID();
    const outgoing = await insertMovement(tx, { material, location: from, transactionType: "TRANSFER", quantity: qty.neg(), transferId, ...rest });
    const incoming = await insertMovement(tx, { material, location: to, transactionType: "TRANSFER", quantity: qty, transferId, ...rest });
    return { transferId, outgoing, incoming, warning };
  };
  return db ? write(db) : prisma.$transaction(write);
}

/** Stock-count correction at a location: `quantity` is signed (+ found / − missing). A reason is required. */
export async function adjustStock({ materialId, location, quantity, remarks, createdById }) {
  assertLocation(location);
  const qty = toDecimal(quantity);
  if (qty.isZero()) throw new Error("Adjustment can't be zero");
  if (!remarks?.trim()) throw new Error("Enter a reason for the adjustment");
  const material = await loadMaterial(materialId, prisma);
  const warning = qty.isNegative() ? await belowZeroWarning(material, location, qty.neg(), prisma) : null;
  const transaction = await insertMovement(prisma, {
    material,
    location,
    transactionType: "ADJUSTMENT",
    quantity: qty,
    remarks: remarks.trim(),
    createdById,
  });
  return { transaction, warning };
}

// ── Cost ───────────────────────────────────────────────────────────────────

/**
 * Recomputes a material's weighted-average cost by replaying its ledger in
 * order: each receipt blends its unit cost into the average in proportion to
 * the stock on hand at that moment; every other movement only changes the
 * quantity on hand. Replaying (instead of updating incrementally) keeps the
 * average correct when a past receipt is edited or deleted.
 */
export async function recomputeAverageCost(materialId, db = prisma) {
  const movements = await db.inventoryTransaction.findMany({
    where: { materialId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { quantity: true, transactionType: true, receipt: { select: { unitCostKwd: true } } },
  });

  let onHand = new Decimal(0);
  let average = null;
  for (const m of movements) {
    const qty = toDecimal(m.quantity);
    if (m.transactionType === "RECEIPT" && m.receipt) {
      const cost = toDecimal(m.receipt.unitCostKwd);
      average =
        average == null || onHand.lte(0)
          ? cost
          : onHand.mul(average).add(qty.mul(cost)).div(onHand.add(qty));
    }
    onHand = onHand.add(qty);
  }

  await db.material.update({
    where: { id: materialId },
    data: { averageCostKwd: average == null ? null : average.toDecimalPlaces(6) },
  });
  return average;
}
