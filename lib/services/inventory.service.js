import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const { Decimal } = Prisma;

const STOCK_IN_TYPES = ["STOCK_IN", "RETURN", "ADJUSTMENT"];
const STOCK_OUT_TYPES = ["STOCK_OUT", "WASTE"];

/**
 * Current material stock from ledger.
 */
export async function getMaterialStock(materialId) {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { materialId },
    select: { transactionType: true, quantity: true },
  });

  let stock = new Decimal(0);
  for (const tx of transactions) {
    const q = new Decimal(tx.quantity.toString());
    if (STOCK_IN_TYPES.includes(tx.transactionType)) stock = stock.add(q);
    else if (STOCK_OUT_TYPES.includes(tx.transactionType)) stock = stock.sub(q);
  }
  return stock;
}

export async function getAllMaterialStock() {
  const materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
  const results = await Promise.all(
    materials.map(async (m) => {
      const currentStock = await getMaterialStock(m.id);
      return {
        ...m,
        currentStock: currentStock.toNumber(),
        isLowStock: currentStock.lessThan(m.minimumStock),
      };
    }),
  );
  return results;
}

export async function getLowStockMaterials() {
  const all = await getAllMaterialStock();
  return all.filter((m) => m.isLowStock);
}

/**
 * Post inventory transaction (material ledger only).
 */
export async function postInventoryTransaction({
  materialId,
  transactionType,
  quantity,
  unit,
  referenceId,
  remarks,
  createdById,
}) {
  const qty = new Decimal(quantity.toString());
  if (qty.lte(0)) throw new Error("Quantity must be positive");

  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) throw new Error("Material not found");

  return prisma.inventoryTransaction.create({
    data: {
      materialId,
      transactionType,
      quantity: qty,
      unit,
      referenceId: referenceId || null,
      remarks: remarks || null,
      createdById: createdById || null,
    },
  });
}
