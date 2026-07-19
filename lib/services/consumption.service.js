import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { postInventoryTransaction, getMaterialStock } from "@/lib/services/inventory.service";

const { Decimal } = Prisma;

/** Prefer seeded codes; fall back to first material of matching type. */
const MATERIAL_BY_KIND = {
  GLUE_SIDE: { code: "GLUE-HOT-25", type: "GLUE" },
  GLUE_BOTTOM: { code: "GLUE-COLD-25", type: "GLUE" },
  HANDLE_ROPE: { code: "ROPE-WHT-100-2", type: "ROPE" },
};

function dec(v) {
  return new Decimal(v?.toString() ?? "0");
}

export function computePlannedGlue({ bagSpec, consumptionKind, bagCount }) {
  const bags = dec(bagCount);
  if (consumptionKind === "GLUE_SIDE" && bagSpec?.sideGlueKgPerBag) {
    return bags.mul(dec(bagSpec.sideGlueKgPerBag));
  }
  if (consumptionKind === "GLUE_BOTTOM" && bagSpec?.bottomGlueKgPerBag) {
    return bags.mul(dec(bagSpec.bottomGlueKgPerBag));
  }
  return new Decimal(0);
}

export function computePlannedHandleRope({ bagCount, handlesPerBag = 2 }) {
  return dec(bagCount).mul(dec(handlesPerBag));
}

export async function resolveMaterialForKind(consumptionKind) {
  const cfg = MATERIAL_BY_KIND[consumptionKind];
  if (!cfg) throw new Error(`Unknown consumption kind: ${consumptionKind}`);

  let material = await prisma.material.findUnique({ where: { code: cfg.code } });
  if (!material) {
    material = await prisma.material.findFirst({
      where: { materialType: cfg.type },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!material) throw new Error(`No material found for ${consumptionKind}`);
  return material;
}

export async function recordStageConsumption({
  stageId,
  consumptionKind,
  plannedQty,
  actualQty,
  unit,
  workerId,
  materialId: explicitMaterialId,
}) {
  const material = explicitMaterialId
    ? await prisma.material.findUnique({ where: { id: explicitMaterialId } })
    : await resolveMaterialForKind(consumptionKind);
  if (!material) throw new Error("Material not found");

  const planned = dec(plannedQty);
  const actual = dec(actualQty);
  const variance = actual.sub(planned);

  const consumption = await prisma.stageConsumption.upsert({
    where: { stageId_consumptionKind: { stageId, consumptionKind } },
    create: {
      stageId,
      materialId: material.id,
      consumptionKind,
      plannedQty: planned,
      actualQty: actual,
      unit,
      variance,
    },
    update: {
      materialId: material.id,
      plannedQty: planned,
      actualQty: actual,
      variance,
    },
    include: { material: true },
  });

  if (actual.gt(0)) {
    await postInventoryTransaction({
      materialId: material.id,
      transactionType: "STOCK_OUT",
      quantity: actual,
      unit,
      referenceId: stageId,
      remarks: `${consumptionKind} consumption`,
      createdById: workerId,
    });
  }

  return consumption;
}

export async function getOrderConsumptions(orderId) {
  return prisma.stageConsumption.findMany({
    where: { stage: { orderId } },
    include: {
      material: true,
      stage: { select: { id: true, stageType: true, sequence: true, orderLineId: true } },
    },
    orderBy: [{ stage: { sequence: "asc" } }, { consumptionKind: "asc" }],
  });
}

export async function getHandleCapacity({ bagSpec, metersAvailable }) {
  const rope = await resolveMaterialForKind("HANDLE_ROPE").catch(() => null);
  const ropeStock = rope ? await getMaterialStock(rope.id) : new Decimal(0);
  const handlesPerBag = dec(bagSpec?.handlesPerBag ?? 2);
  const bagsPerMeter = bagSpec?.bagsPerMeter ? dec(bagSpec.bagsPerMeter) : null;

  const bagsFromMeters = bagsPerMeter && metersAvailable != null
    ? dec(metersAvailable).mul(bagsPerMeter)
    : null;

  const bagsFromRope = handlesPerBag.gt(0)
    ? ropeStock.div(handlesPerBag)
    : new Decimal(0);

  let capacityBags = bagsFromRope;
  if (bagsFromMeters != null) {
    capacityBags = Decimal.min(capacityBags, bagsFromMeters);
  }

  return {
    ropeMaterialId: rope?.id ?? null,
    ropeStock: ropeStock.toNumber(),
    handlesPerBag: handlesPerBag.toNumber(),
    bagsFromMeters: bagsFromMeters?.toNumber() ?? null,
    capacityBags: capacityBags.toNumber(),
  };
}

/** Simple rope stock summary for dashboards (replaces old handle-making/pasting ledger). */
export async function getHandleStockSummary() {
  try {
    const rope = await resolveMaterialForKind("HANDLE_ROPE");
    const remaining = await getMaterialStock(rope.id);
    return {
      produced: 0,
      consumed: 0,
      defective: 0,
      remaining: remaining.toNumber(),
      unit: rope.unit || "PCS",
    };
  } catch {
    return { produced: 0, consumed: 0, defective: 0, remaining: 0, unit: "PCS" };
  }
}
