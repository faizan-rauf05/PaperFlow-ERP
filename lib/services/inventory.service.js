import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeKgPerMeter } from "@/lib/services/unit-conversion.service";

const { Decimal } = Prisma;

const STOCK_IN_TYPES = ["STOCK_IN", "RETURN", "ADJUSTMENT"];
const STOCK_OUT_TYPES = ["STOCK_OUT", "WASTE"];

function dec(v) {
  return new Decimal(v?.toString() ?? "0");
}

function getRollKgPerMeter(roll, material) {
  if (material?.kgPerMeter) return dec(material.kgPerMeter);
  if (roll.gsm && roll.widthMm) {
    const computed = computeKgPerMeter({ gsm: roll.gsm, widthMm: roll.widthMm });
    if (computed) return computed;
  }
  const lengthM = dec(roll.lengthM);
  const weightKg = dec(roll.weightKg);
  if (!lengthM.isZero()) return weightKg.div(lengthM);
  return null;
}

function syncRemainingWeight(remainingLengthM, roll, material) {
  const rate = getRollKgPerMeter(roll, material);
  if (!rate) return dec(roll.remainingWeightKg ?? roll.weightKg);
  return dec(remainingLengthM).mul(rate);
}

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
 * Post inventory transaction and update roll remaining length/weight when applicable.
 */
export async function postInventoryTransaction({
  materialId,
  rollId,
  transactionType,
  quantity,
  unit,
  referenceId,
  remarks,
  createdById,
}) {
  const qty = new Decimal(quantity.toString());
  if (qty.lte(0)) throw new Error("Quantity must be positive");

  return prisma.$transaction(async (tx) => {
    const material = await tx.material.findUnique({ where: { id: materialId } });
    if (!material) throw new Error("Material not found");

    let roll = null;
    if (rollId) {
      roll = await tx.paperRoll.findUnique({ where: { id: rollId } });
      if (!roll) throw new Error("Roll not found");
      if (roll.materialId !== materialId) throw new Error("Roll does not belong to material");
    }

    const record = await tx.inventoryTransaction.create({
      data: {
        materialId,
        rollId: rollId || null,
        transactionType,
        quantity: qty,
        unit,
        referenceId: referenceId || null,
        remarks: remarks || null,
        createdById: createdById || null,
      },
    });

    if (roll && unit === "METER") {
      let remaining = dec(roll.remainingLengthM);
      if (transactionType === "STOCK_IN" || transactionType === "RETURN") {
        remaining = remaining.add(qty);
      } else if (transactionType === "STOCK_OUT" || transactionType === "WASTE") {
        remaining = remaining.sub(qty);
        if (remaining.lt(0)) throw new Error("Insufficient roll length");
      }

      let status = roll.status;
      if (remaining.lte(0)) {
        remaining = new Decimal(0);
        status = transactionType === "WASTE" ? "WASTED" : "FINISHED";
      } else if (transactionType === "STOCK_OUT" && roll.status === "AVAILABLE") {
        status = "IN_USE";
      }

      const remainingWeightKg = syncRemainingWeight(remaining, roll, material);

      await tx.paperRoll.update({
        where: { id: rollId },
        data: { remainingLengthM: remaining, remainingWeightKg, status },
      });
    }

    return record;
  });
}

export async function registerRoll(data, createdById) {
  const lengthM = dec(data.lengthM);
  const weightKg = dec(data.weightKg);
  const barcode = data.barcode?.trim() || data.rollNo;
  const receivedAt = data.receivedAt ? new Date(data.receivedAt) : new Date();

  const material = await prisma.material.findUnique({ where: { id: data.materialId } });
  if (!material) throw new Error("Material not found");

  let kgPerMeter = material.kgPerMeter;
  if (!kgPerMeter && data.gsm && data.widthMm) {
    const computed = computeKgPerMeter({ gsm: data.gsm, widthMm: data.widthMm });
    if (computed) {
      kgPerMeter = computed;
      await prisma.material.update({
        where: { id: material.id },
        data: { kgPerMeter: computed },
      });
    }
  }

  const roll = await prisma.paperRoll.create({
    data: {
      rollNo: data.rollNo,
      barcode,
      materialId: data.materialId,
      supplier: data.supplier || null,
      batchLot: data.batchLot || null,
      gsm: data.gsm ? parseInt(data.gsm, 10) : null,
      widthMm: data.widthMm ? dec(data.widthMm) : null,
      weightKg,
      lengthM,
      remainingLengthM: lengthM,
      remainingWeightKg: weightKg,
      receivedAt,
      storageLocation: data.storageLocation || null,
      status: "AVAILABLE",
    },
    include: { material: true },
  });

  await postInventoryTransaction({
    materialId: data.materialId,
    rollId: roll.id,
    transactionType: "STOCK_IN",
    quantity: lengthM,
    unit: "METER",
    referenceId: roll.id,
    remarks: `Roll registered: ${data.rollNo}`,
    createdById,
  });

  return roll;
}
