import { prisma } from "@/lib/prisma";
import { getStockByMaterial } from "@/lib/services/stock.service";
import { GLUE_MIN_FACTORY_DRUMS, GLUE_TYPES } from "@/lib/material-constants";

/**
 * Factory glue level per glue type, counted in drums. Stock is kept in kg,
 * so drums = factory kg ÷ drum weight, where the drum weight is the pack
 * size of that glue type's most recent delivery (any supplier). A type with
 * no delivery on record has no known drum weight and is reported as
 * unknown rather than guessed.
 */
export async function getFactoryGlueLevels(db = prisma) {
  const materials = await db.material.findMany({
    where: { materialType: "GLUE" },
    select: { id: true, glueType: true },
  });
  if (materials.length === 0) return [];
  const stock = await getStockByMaterial(materials.map((m) => m.id), db);

  const levels = [];
  for (const { value: glueType, label } of GLUE_TYPES) {
    const ids = materials.filter((m) => m.glueType === glueType).map((m) => m.id);
    if (ids.length === 0) continue;

    const lastDelivery = await db.stockReceipt.findFirst({
      where: { materialId: { in: ids }, packSize: { not: null } },
      orderBy: { receivedAt: "desc" },
      select: { packSize: true },
    });
    const drumKg = lastDelivery ? Number(lastDelivery.packSize) : null;
    const factoryKg = ids.reduce((sum, id) => sum + stock.get(id).FACTORY, 0);
    const warehouseKg = ids.reduce((sum, id) => sum + stock.get(id).WAREHOUSE, 0);
    // Shown count never goes negative; drumsNeeded below still covers an overdraw.
    const drums = drumKg ? Math.max(0, Math.floor((factoryKg / drumKg) * 10) / 10) : null;
    const isLow = drums != null && drums < GLUE_MIN_FACTORY_DRUMS;

    levels.push({
      glueType,
      label,
      materialIds: ids,
      factoryKg,
      warehouseKg,
      drumKg,
      drums,
      minDrums: GLUE_MIN_FACTORY_DRUMS,
      isLow,
      // Whole drums to bring the factory back to the minimum.
      drumsNeeded: isLow ? Math.ceil(GLUE_MIN_FACTORY_DRUMS - factoryKg / drumKg) : 0,
    });
  }
  return levels;
}
