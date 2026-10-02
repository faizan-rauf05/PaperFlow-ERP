import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { priceReceiptInKwd } from "@/lib/cost-price";
import { MATERIAL_TYPE_CONFIG, formatQuantity, materialCode, materialName, stockGroupFor } from "@/lib/material-catalog";
import { STOCK_LOCATION_LABELS } from "@/lib/stock-locations";
import { getMaterialStock, recomputeAverageCost } from "@/lib/services/stock.service";

const { Decimal } = Prisma;

/**
 * Receiving stock (docs/INVENTORY_DESIGN.md): every delivery is a
 * StockReceipt that owns one RECEIPT ledger entry. A paper-roll receipt also
 * creates the roll's own Material row. Input is stockReceiptSchema output.
 */

export const RECEIPT_INCLUDE = {
  material: { include: { supplier: { select: { id: true, name: true } } } },
  receivedBy: { select: { id: true, name: true } },
};

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

const toDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00.000Z`) : null);

/** Paper-roll Material fields from a validated receipt payload. */
function paperRollRecord(data) {
  const fields = {
    paperType: data.paperType,
    paperColor: data.paperColor,
    paperWidthCm: data.paperWidthCm,
    paperLengthM: data.paperLengthM,
    gsm: data.gsm,
    weightKg: data.weightKg,
    barCode: data.barCode.trim(),
  };
  return {
    materialType: "PAPER_ROLL",
    supplierId: data.supplierId,
    unit: "METER",
    catalogKey: null,
    stockGroup: stockGroupFor("PAPER_ROLL", fields),
    name: materialName("PAPER_ROLL", fields),
    ...fields,
  };
}

/** Quantity received, stock units per pack and (paper) kg per meter, for a validated payload. */
function receivedQuantity(data) {
  if (data.materialType === "PAPER_ROLL") {
    return {
      quantity: new Decimal(data.paperLengthM),
      unitsPerPack: data.paperLengthM,
      kgPerUnit: new Decimal(data.weightKg).div(data.paperLengthM),
      packSize: null,
      packCount: null,
    };
  }
  if (MATERIAL_TYPE_CONFIG[data.materialType].pack) {
    const packSize = new Decimal(data.packSize);
    return { quantity: packSize.mul(data.packCount), unitsPerPack: data.packSize, packSize, packCount: data.packCount };
  }
  return { quantity: new Decimal(data.quantity), unitsPerPack: null, packSize: null, packCount: null };
}

/** Receipt row fields (everything except material/who/when-created) for a validated payload. */
async function receiptFields(data, labelImageUrl) {
  const { quantity, unitsPerPack, kgPerUnit, packSize, packCount } = receivedQuantity(data);
  const cost = await priceReceiptInKwd({
    currency: data.costCurrency,
    entryBasis: data.costEntryBasis,
    amount: data.costAmount,
    unitsPerPack,
    kgPerUnit,
    quantity,
  });
  return {
    location: data.location,
    quantity,
    packSize,
    packCount,
    batchNo: data.batchNo || null,
    batchDate: toDate(data.batchDate),
    receivedAt: toDate(data.receivedAt),
    costCurrency: data.costCurrency,
    costEntryBasis: data.costEntryBasis,
    costAmount: new Decimal(data.costAmount),
    exchangeRate: cost.exchangeRate,
    rateDate: cost.rateDate,
    unitCostKwd: cost.unitCostKwd,
    totalCostKwd: cost.totalCostKwd,
    labelImageUrl,
    notes: data.notes || null,
  };
}

async function uploadLabel(labelImageUrl) {
  if (!labelImageUrl) return null;
  return labelImageUrl.startsWith("data:image") ? uploadImageToCloudinary(labelImageUrl, "materials") : labelImageUrl;
}

function uniqueViolation(error) {
  if (error?.code !== "P2002") return null;
  // Where the violated fields show up varies by Prisma engine/adapter
  // (meta.target array, a constraint-name string, or only the message), so
  // search all of it rather than trusting meta.target alone.
  const target = `${JSON.stringify(error.meta || {})} ${error.message || ""}`;
  if (target.includes("barCode")) return httpError("A paper roll with this barcode already exists.", 409);
  if (target.includes("batchNo")) return httpError("This batch (number + date) was already received for this material.", 409);
  return null;
}

async function loadCatalogMaterial(data) {
  const material = await prisma.material.findUnique({ where: { id: data.materialId } });
  if (!material) throw httpError("Material not found", 404);
  if (material.materialType !== data.materialType) throw httpError("The selected material doesn't match the material type", 400);
  return material;
}

/** Receives a delivery (catalog material) or a new paper roll. */
export async function receiveStock(data, userId) {
  const isPaper = data.materialType === "PAPER_ROLL";
  if (isPaper) {
    const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
    if (!supplier) throw httpError("Supplier not found", 400);
  } else {
    await loadCatalogMaterial(data);
  }

  const fields = await receiptFields(data, await uploadLabel(data.labelImageUrl));

  let receiptId;
  try {
    receiptId = await prisma.$transaction(
      async (tx) => {
        const material = isPaper
          ? await tx.material.create({ data: { ...paperRollRecord(data), code: materialCode("PAPER_ROLL", data) } })
          : await tx.material.findUnique({ where: { id: data.materialId } });

        const receipt = await tx.stockReceipt.create({
          data: { ...fields, materialId: material.id, receivedById: userId || null },
        });
        await tx.inventoryTransaction.create({
          data: {
            materialId: material.id,
            location: fields.location,
            transactionType: "RECEIPT",
            quantity: fields.quantity,
            unit: material.unit,
            receiptId: receipt.id,
            referenceId: fields.batchNo,
            createdById: userId || null,
          },
        });
        await recomputeAverageCost(material.id, tx);
        return receipt.id;
      },
      { timeout: 15000 },
    );
  } catch (error) {
    throw uniqueViolation(error) || error;
  }

  const receipt = await prisma.stockReceipt.findUnique({ where: { id: receiptId }, include: RECEIPT_INCLUDE });
  await writeAuditLog({
    userId,
    action: ACTIONS.STOCK_RECEIVED,
    model: "StockReceipt",
    recordId: receiptId,
    newValue: {
      material: receipt.material.name,
      supplier: receipt.material.supplier?.name,
      location: receipt.location,
      quantity: Number(receipt.quantity),
      unitCostKwd: Number(receipt.unitCostKwd),
    },
  });
  return receipt;
}

/**
 * Taking `quantity` back out of `location` must not leave it negative — if it
 * would, some of that delivery was already used or moved, and the correction
 * has to be a stock adjustment instead.
 */
async function assertCanWithdraw(receipt, location, quantity, db) {
  const available = await getMaterialStock(receipt.materialId, location, db);
  if (available.sub(quantity).lt(0)) {
    throw httpError(
      `Part of this delivery has already been used or moved (${formatQuantity(available, receipt.material.unit)} left at the ${STOCK_LOCATION_LABELS[location].toLowerCase()}). Record a stock adjustment instead.`,
      409,
    );
  }
}

/** Corrects a receipt (quantity, price, batch, location, dates, notes; a roll's specs). */
export async function updateReceipt(receiptId, data, userId) {
  const existing = await prisma.stockReceipt.findUnique({ where: { id: receiptId }, include: { material: true } });
  if (!existing) throw httpError("Receipt not found", 404);
  if (data.materialType !== existing.material.materialType) throw httpError("A receipt's material type can't be changed", 400);
  if (data.materialType !== "PAPER_ROLL" && data.materialId !== existing.materialId) {
    throw httpError("A receipt can't be moved to a different material — delete it and receive again", 400);
  }

  const fields = await receiptFields(data, await uploadLabel(data.labelImageUrl));

  try {
    await prisma.$transaction(
      async (tx) => {
        // The old quantity leaves the old location, the new quantity arrives at the new one.
        const sameLocation = fields.location === existing.location;
        const netOut = sameLocation ? new Decimal(existing.quantity).sub(fields.quantity) : new Decimal(existing.quantity);
        if (netOut.gt(0)) await assertCanWithdraw(existing, existing.location, netOut, tx);

        if (data.materialType === "PAPER_ROLL") {
          const { materialType, unit, catalogKey, ...roll } = paperRollRecord(data);
          await tx.material.update({ where: { id: existing.materialId }, data: roll });
        }
        await tx.stockReceipt.update({ where: { id: receiptId }, data: fields });
        await tx.inventoryTransaction.update({
          where: { receiptId },
          data: { location: fields.location, quantity: fields.quantity, referenceId: fields.batchNo },
        });
        await recomputeAverageCost(existing.materialId, tx);
      },
      { timeout: 15000 },
    );
  } catch (error) {
    throw uniqueViolation(error) || error;
  }

  const receipt = await prisma.stockReceipt.findUnique({ where: { id: receiptId }, include: RECEIPT_INCLUDE });
  await writeAuditLog({
    userId,
    action: ACTIONS.STOCK_RECEIPT_UPDATED,
    model: "StockReceipt",
    recordId: receiptId,
    oldValue: { location: existing.location, quantity: Number(existing.quantity), unitCostKwd: Number(existing.unitCostKwd) },
    newValue: { location: receipt.location, quantity: Number(receipt.quantity), unitCostKwd: Number(receipt.unitCostKwd) },
  });
  return receipt;
}

/**
 * Deletes a receipt that was entered by mistake. A paper roll's receipt also
 * removes the roll itself, which is only possible while nothing else (an
 * order, a production stage) references it.
 */
export async function deleteReceipt(receiptId, userId) {
  const existing = await prisma.stockReceipt.findUnique({ where: { id: receiptId }, include: { material: true } });
  if (!existing) throw httpError("Receipt not found", 404);
  const isPaper = existing.material.materialType === "PAPER_ROLL";

  if (isPaper) {
    const [orderLinks, stages, otherMovements] = await Promise.all([
      prisma.orderLineMaterial.count({ where: { materialId: existing.materialId } }),
      prisma.productionStage.count({ where: { materialId: existing.materialId } }),
      prisma.inventoryTransaction.count({ where: { materialId: existing.materialId, receiptId: null } }),
    ]);
    if (orderLinks + stages + otherMovements > 0) {
      throw httpError("This roll has already been picked, moved or used, so its receipt can't be deleted.", 409);
    }
  }

  await prisma.$transaction(
    async (tx) => {
      if (!isPaper) await assertCanWithdraw(existing, existing.location, new Decimal(existing.quantity), tx);
      await tx.stockReceipt.delete({ where: { id: receiptId } }); // cascades its RECEIPT entry
      if (isPaper) {
        await tx.material.delete({ where: { id: existing.materialId } });
      } else {
        await recomputeAverageCost(existing.materialId, tx);
      }
    },
    { timeout: 15000 },
  );

  await writeAuditLog({
    userId,
    action: ACTIONS.STOCK_RECEIPT_DELETED,
    model: "StockReceipt",
    recordId: receiptId,
    oldValue: {
      material: existing.material.name,
      location: existing.location,
      quantity: Number(existing.quantity),
      unitCostKwd: Number(existing.unitCostKwd),
    },
  });
}
