import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computePerBagConsumption } from "@/lib/material-suggestion";

const { Decimal } = Prisma;

/**
 * Glue and handle-rope usage recorded at the Handle Making & Pasting stage.
 * Each kind records planned (from the bag dimensions) vs actual (entered by
 * the worker) against the specific supplier material the worker used. The
 * stock movement itself is written by the stage recording (workflow.service).
 */

export const CONSUMPTION_KINDS = {
  GLUE_SIDE: { materialType: "GLUE", unit: "KG", label: "Side glue" },
  GLUE_BOTTOM: { materialType: "GLUE", unit: "KG", label: "Bottom glue" },
  HANDLE_ROPE: { materialType: "ROPE", unit: "METER", label: "Handle rope" },
};

function dec(v) {
  return new Decimal(v?.toString() ?? "0");
}

/** Planned quantity of each consumption kind for `bagCount` bags of an order line. */
export function computePlannedConsumption(orderLine, bagCount) {
  const perBag = computePerBagConsumption(orderLine);
  const bags = dec(bagCount);
  return {
    GLUE_SIDE: bags.mul(perBag.glueSideKg).toDecimalPlaces(4),
    GLUE_BOTTOM: bags.mul(perBag.glueBottomKg).toDecimalPlaces(4),
    HANDLE_ROPE: bags.mul(perBag.ropeM).toDecimalPlaces(4),
  };
}

/**
 * Upserts the planned/actual record for one consumption kind of a stage
 * (inside the stage-recording transaction `db`). The material must be of the
 * kind's type (glue for glue seams, rope for handles).
 */
export async function upsertStageConsumption(db, { stageId, consumptionKind, materialId, plannedQty, actualQty }) {
  const kind = CONSUMPTION_KINDS[consumptionKind];
  if (!kind) throw new Error(`Unknown consumption kind: ${consumptionKind}`);
  const material = await db.material.findUnique({ where: { id: materialId } });
  if (!material || material.materialType !== kind.materialType) {
    throw new Error(`Select the ${kind.label.toLowerCase()} material used`);
  }

  const planned = dec(plannedQty);
  const actual = dec(actualQty);
  const data = {
    materialId,
    plannedQty: planned,
    actualQty: actual,
    unit: kind.unit,
    variance: actual.sub(planned),
  };
  return db.stageConsumption.upsert({
    where: { stageId_consumptionKind: { stageId, consumptionKind } },
    create: { stageId, consumptionKind, ...data },
    update: data,
  });
}

export async function getOrderConsumptions(orderId) {
  return prisma.stageConsumption.findMany({
    where: { stage: { orderId } },
    include: {
      material: { include: { supplier: { select: { name: true } } } },
      stage: { select: { id: true, stageType: true, sequence: true, orderLineId: true } },
    },
    orderBy: [{ stage: { sequence: "asc" } }, { consumptionKind: "asc" }],
  });
}
