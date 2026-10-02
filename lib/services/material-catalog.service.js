import { prisma } from "@/lib/prisma";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import {
  MATERIAL_TYPE_CONFIG,
  catalogKeyFor,
  materialCode,
  materialName,
  resolveInkColor,
  stockGroupFor,
  unitFor,
} from "@/lib/material-catalog";

/**
 * Catalog materials: one per supplier + type + subtype (docs/INVENTORY_DESIGN.md).
 * Paper rolls are not created here — each roll is created by the receipt
 * that brings it in (lib/services/stock-receipt.service.js).
 */

/** Subtype fields of a validated catalogMaterialSchema payload, normalized as stored. */
function catalogFields(data) {
  const f = {
    glueType: null,
    inkColor: null,
    ropeColor: null,
    tapeType: null,
    tapeSize: null,
    cartonSize: null,
  };
  switch (data.materialType) {
    case "GLUE":
      f.glueType = data.glueType;
      break;
    case "INK":
      f.inkColor = resolveInkColor(data.inkColor, data.inkColorCustom);
      break;
    case "ROPE":
      f.ropeColor = data.ropeColor;
      break;
    case "KAPTON":
      f.tapeType = data.tapeType;
      f.tapeSize = data.tapeSize.trim();
      break;
    case "CARTON":
      f.cartonSize = data.cartonSize;
      break;
  }
  return f;
}

function catalogRecord(data) {
  const fields = catalogFields(data);
  return {
    materialType: data.materialType,
    supplierId: data.supplierId,
    unit: unitFor(data.materialType, data),
    catalogKey: catalogKeyFor(data.materialType, fields),
    stockGroup: stockGroupFor(data.materialType, fields),
    name: materialName(data.materialType, fields),
    ...fields,
  };
}

function duplicateError(record, supplierName) {
  const error = new Error(`${supplierName || "This supplier"} already has "${record.name}" in the catalog.`);
  error.status = 409;
  return error;
}

async function assertSupplier(supplierId) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    const error = new Error("Supplier not found");
    error.status = 400;
    throw error;
  }
  return supplier;
}

/** Creates a catalog material from a validated catalogMaterialSchema payload. */
export async function createCatalogMaterial(data, userId) {
  if (!MATERIAL_TYPE_CONFIG[data.materialType]?.isCatalog) throw new Error("Paper rolls are added by receiving them");
  const supplier = await assertSupplier(data.supplierId);
  const record = catalogRecord(data);

  let material;
  try {
    material = await prisma.material.create({
      data: { ...record, code: materialCode(record.materialType, record) },
      include: { supplier: true },
    });
  } catch (error) {
    if (error.code === "P2002") throw duplicateError(record, supplier.name);
    throw error;
  }

  await writeAuditLog({
    userId,
    action: ACTIONS.MATERIAL_CREATED,
    model: "Material",
    recordId: material.id,
    newValue: { name: material.name, supplier: supplier.name, materialType: material.materialType },
  });
  return material;
}

/** Whether anything references this material yet (receipts, stock movements, orders, production). */
async function isMaterialInUse(materialId) {
  const [receipts, movements, orderLinks, stages, consumptions] = await Promise.all([
    prisma.stockReceipt.count({ where: { materialId } }),
    prisma.inventoryTransaction.count({ where: { materialId } }),
    prisma.orderLineMaterial.count({ where: { materialId } }),
    prisma.productionStage.count({ where: { materialId } }),
    prisma.stageConsumption.count({ where: { materialId } }),
  ]);
  return receipts + movements + orderLinks + stages + consumptions > 0;
}

function inUseError(action) {
  const error = new Error(
    `This material already has stock history, so it can't be ${action}. Its identity is part of every delivery and movement recorded against it.`,
  );
  error.status = 409;
  return error;
}

/**
 * Edits a catalog material's supplier/subtype. Only allowed before anything
 * has been received or recorded against it — afterwards its identity is
 * fixed, since receipts and movements were recorded under it.
 */
export async function updateCatalogMaterial(materialId, data, userId) {
  const existing = await prisma.material.findUnique({ where: { id: materialId } });
  if (!existing) throw Object.assign(new Error("Material not found"), { status: 404 });
  if (!MATERIAL_TYPE_CONFIG[existing.materialType]?.isCatalog) {
    throw Object.assign(new Error("Paper rolls are edited through their receipt"), { status: 400 });
  }
  if (data.materialType !== existing.materialType) {
    throw Object.assign(new Error("A material's type can't be changed"), { status: 400 });
  }
  if (await isMaterialInUse(materialId)) throw inUseError("edited");

  const supplier = await assertSupplier(data.supplierId);
  const record = catalogRecord(data);
  let material;
  try {
    material = await prisma.material.update({ where: { id: materialId }, data: record, include: { supplier: true } });
  } catch (error) {
    if (error.code === "P2002") throw duplicateError(record, supplier.name);
    throw error;
  }

  await writeAuditLog({
    userId,
    action: ACTIONS.MATERIAL_UPDATED,
    model: "Material",
    recordId: materialId,
    oldValue: { name: existing.name, supplierId: existing.supplierId },
    newValue: { name: material.name, supplierId: material.supplierId },
  });
  return material;
}

/** Deletes a catalog material that has never been used. */
export async function deleteCatalogMaterial(materialId, userId) {
  const existing = await prisma.material.findUnique({ where: { id: materialId } });
  if (!existing) throw Object.assign(new Error("Material not found"), { status: 404 });
  if (await isMaterialInUse(materialId)) throw inUseError("deleted");

  await prisma.material.delete({ where: { id: materialId } });
  await writeAuditLog({
    userId,
    action: ACTIONS.MATERIAL_DELETED,
    model: "Material",
    recordId: materialId,
    oldValue: { name: existing.name, code: existing.code },
  });
}
