import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { postInventoryTransaction } from "@/lib/services/inventory.service";

const { Decimal } = Prisma;

const MATERIAL_BY_KIND = {
  GLUE_SIDE: "GLUE-SIDE",
  GLUE_BOTTOM: "GLUE-BTM",
  HANDLE_ROPE: "HANDLE-ROPE",
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

export function computePlannedHandleRope({ outputQty, wasteQty }) {
  return dec(outputQty).add(dec(wasteQty ?? 0));
}

export async function getMaterialIdByCode(code) {
  const material = await prisma.material.findUnique({ where: { code } });
  if (!material) throw new Error(`Material ${code} not found`);
  return material.id;
}

export async function recordStageConsumption({
  stageId,
  consumptionKind,
  plannedQty,
  actualQty,
  unit,
  workerId,
}) {
  const code = MATERIAL_BY_KIND[consumptionKind];
  if (!code) throw new Error(`Unknown consumption kind: ${consumptionKind}`);

  const materialId = await getMaterialIdByCode(code);
  const planned = dec(plannedQty);
  const actual = dec(actualQty);
  const variance = actual.sub(planned);

  const consumption = await prisma.stageConsumption.upsert({
    where: { stageId_consumptionKind: { stageId, consumptionKind } },
    create: {
      stageId,
      materialId,
      consumptionKind,
      plannedQty: planned,
      actualQty: actual,
      unit,
      variance,
    },
    update: {
      plannedQty: planned,
      actualQty: actual,
      variance,
    },
    include: { material: true },
  });

  if (actual.gt(0)) {
    await postInventoryTransaction({
      materialId,
      rollId: null,
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
      stage: { select: { id: true, stageType: true, sequence: true } },
    },
    orderBy: [{ stage: { sequence: "asc" } }, { consumptionKind: "asc" }],
  });
}

export async function getHandleStockSummary() {
  const handleMaterial = await prisma.material.findUnique({ where: { code: "HANDLE-ROPE" } });
  if (!handleMaterial) return { produced: 0, consumed: 0, defective: 0, remaining: 0 };

  const handleStages = await prisma.productionStage.findMany({
    where: { stageType: { in: ["HANDLE_MAKING", "HANDLE_PASTING"] }, status: "COMPLETED" },
    include: { order: { include: { bagSpec: true } } },
  });

  let produced = new Decimal(0);
  let consumed = new Decimal(0);
  let defective = new Decimal(0);

  for (const stage of handleStages) {
    if (stage.stageType === "HANDLE_MAKING") {
      produced = produced.add(dec(stage.outputQty));
      defective = defective.add(dec(stage.wasteQty));
    } else if (stage.stageType === "HANDLE_PASTING") {
      const handlesPerBag = dec(stage.order?.bagSpec?.handlesPerBag ?? 2);
      consumed = consumed.add(dec(stage.outputQty).mul(handlesPerBag));
    }
  }

  const remaining = await import("@/lib/services/inventory.service").then((m) =>
    m.getMaterialStock(handleMaterial.id),
  );

  return {
    produced: produced.toNumber(),
    consumed: consumed.toNumber(),
    defective: defective.toNumber(),
    remaining: remaining.toNumber(),
    unit: "PCS",
  };
}
