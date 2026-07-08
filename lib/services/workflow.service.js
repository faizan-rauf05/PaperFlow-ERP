import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  STAGE_PIPELINE,
  QC_STAGE_TYPES,
  YIELD_THRESHOLD_PERCENT,
} from "@/lib/production-constants";
import { postInventoryTransaction } from "@/lib/services/inventory.service";
import { convertQuantity } from "@/lib/services/unit-conversion.service";
import {
  computePlannedGlue,
  computePlannedHandleRope,
  recordStageConsumption,
} from "@/lib/services/consumption.service";

const { Decimal } = Prisma;

function dec(v) {
  return new Decimal(v?.toString() ?? "0");
}

async function generateOrderNo() {
  const count = await prisma.productionOrder.count();
  const year = new Date().getFullYear();
  return `PO-${year}-${String(count + 1).padStart(4, "0")}`;
}

function getStageOutputQty(stage) {
  if (QC_STAGE_TYPES.includes(stage.stageType) && stage.qcRecords?.[0]) {
    return dec(stage.qcRecords[0].passedQty);
  }
  return dec(stage.outputQty);
}

async function resolveStageInputQty(tx, orderId, targetStage, bagSpec) {
  const meta = STAGE_PIPELINE.find((s) => s.sequence === targetStage.sequence);
  const sourceSeq = meta?.inputFromSequence ?? targetStage.sequence - 1;
  if (sourceSeq < 1) return null;

  const sourceStage = await tx.productionStage.findUnique({
    where: { orderId_sequence: { orderId, sequence: sourceSeq } },
    include: { qcRecords: true },
  });
  if (!sourceStage || sourceStage.status !== "COMPLETED") return null;

  let qty = getStageOutputQty(sourceStage);

  if (targetStage.stageType === "HANDLE_MAKING") {
    return convertQuantity({
      quantity: qty,
      fromUnit: "BAG",
      toUnit: "PCS",
      context: { handlesPerBag: bagSpec?.handlesPerBag ?? 2 },
    });
  }

  return qty;
}

export async function createProductionOrder({ customer, bagSpecId, plannedQty }) {
  const bagSpec = await prisma.bagSpecification.findUnique({ where: { id: bagSpecId } });
  if (!bagSpec) throw new Error("Bag specification not found");

  const orderNo = await generateOrderNo();
  const qty = dec(plannedQty);

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.create({
      data: {
        orderNo,
        customer,
        bagSpecId,
        plannedQty: qty,
        status: "PENDING",
      },
    });

    await tx.productionStage.createMany({
      data: STAGE_PIPELINE.map((stage) => ({
        orderId: order.id,
        stageType: stage.stageType,
        sequence: stage.sequence,
        inputUnit: stage.inputUnit,
        outputUnit: stage.outputUnit,
        status: stage.sequence === 1 ? "READY" : "PENDING",
      })),
    });

    return tx.productionOrder.findUnique({
      where: { id: order.id },
      include: {
        bagSpec: true,
        stages: { orderBy: { sequence: "asc" } },
      },
    });
  }, { timeout: 15000 });
}

export async function getOrderWithStages(orderId) {
  return prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      bagSpec: true,
      stages: {
        orderBy: { sequence: "asc" },
        include: {
          worker: { select: { id: true, name: true, email: true } },
          machine: true,
          roll: { include: { material: true } },
          qcRecords: {
            include: {
              defectType: { include: { category: true } },
              machine: true,
              roll: true,
              createdBy: { select: { id: true, name: true } },
            },
          },
          yieldRecord: true,
          consumptions: { include: { material: true } },
        },
      },
    },
  });
}

async function getStageInOrder(orderId, stageId) {
  const stage = await prisma.productionStage.findFirst({
    where: { id: stageId, orderId },
    include: {
      order: { include: { bagSpec: true } },
    },
  });
  if (!stage) throw new Error("Stage not found");
  return stage;
}

async function assertPreviousStageComplete(orderId, sequence) {
  if (sequence <= 1) return;
  const prev = await prisma.productionStage.findUnique({
    where: { orderId_sequence: { orderId, sequence: sequence - 1 } },
  });
  if (!prev || prev.status !== "COMPLETED") {
    throw new Error("Previous stage incomplete");
  }
}

export async function startStage({ orderId, stageId, workerId, machineId, rollId }) {
  const stage = await getStageInOrder(orderId, stageId);

  if (stage.locked) throw new Error("Stage is locked");
  if (stage.status === "COMPLETED") throw new Error("Stage already completed");
  if (!["READY", "IN_PROGRESS"].includes(stage.status)) {
    throw new Error("Stage is not ready to start");
  }

  await assertPreviousStageComplete(orderId, stage.sequence);

  const meta = STAGE_PIPELINE.find((s) => s.sequence === stage.sequence);
  let effectiveRollId = rollId || null;

  if (meta?.requiresRoll && !effectiveRollId && stage.stageType === "PRINTING") {
    const rawStage = await prisma.productionStage.findUnique({
      where: { orderId_sequence: { orderId, sequence: 1 } },
    });
    if (rawStage?.rollId) effectiveRollId = rawStage.rollId;
  }

  if (meta?.requiresRoll && !effectiveRollId) {
    throw new Error("Roll selection is required for this stage");
  }

  if (effectiveRollId) {
    const roll = await prisma.paperRoll.findUnique({ where: { id: effectiveRollId } });
    if (!roll || !["AVAILABLE", "IN_USE"].includes(roll.status)) {
      throw new Error("Roll is not available");
    }
  }

  let inputQty = stage.inputQty;
  if (!inputQty && stage.sequence > 1) {
    inputQty = await resolveStageInputQty(
      prisma,
      orderId,
      stage,
      stage.order?.bagSpec,
    );
    if (!inputQty) {
      const prev = await prisma.productionStage.findUnique({
        where: { orderId_sequence: { orderId, sequence: stage.sequence - 1 } },
        include: { qcRecords: true },
      });
      if (prev) inputQty = getStageOutputQty(prev);
    }
  }

  const updated = await prisma.productionStage.update({
    where: { id: stageId },
    data: {
      status: "IN_PROGRESS",
      workerId,
      machineId: machineId || null,
      rollId: effectiveRollId || null,
      inputQty: inputQty || null,
      startedAt: stage.startedAt || new Date(),
    },
    include: {
      worker: { select: { id: true, name: true } },
      machine: true,
      roll: true,
    },
  });

  await prisma.productionOrder.update({
    where: { id: orderId },
    data: { status: "RUNNING" },
  });

  if (effectiveRollId) {
    await prisma.paperRoll.update({
      where: { id: effectiveRollId },
      data: { status: "IN_USE" },
    });
  }

  return updated;
}

export async function submitStage({
  orderId,
  stageId,
  workerId,
  outputQty,
  wasteQty,
  remarks,
  qc,
  consumptions,
}) {
  const stage = await getStageInOrder(orderId, stageId);

  if (stage.locked) throw new Error("Stage is locked");
  if (stage.status !== "IN_PROGRESS") throw new Error("Stage must be in progress to submit");

  const inputQty = dec(stage.inputQty);
  const output = dec(outputQty ?? 0);
  const waste = dec(wasteQty ?? 0);
  const isQc = QC_STAGE_TYPES.includes(stage.stageType);
  const bagSpec = stage.order?.bagSpec;

  if (isQc) {
    const passed = dec(qc?.passedQty ?? outputQty);
    const rejected = dec(qc?.rejectedQty ?? 0);
    if (passed.add(rejected).gt(inputQty) && !inputQty.isZero()) {
      throw new Error("Pass + reject cannot exceed input quantity");
    }
  } else {
    const total = output.add(waste);
    if (!inputQty.isZero() && total.gt(inputQty.mul(1.001))) {
      throw new Error("Output + waste cannot exceed input");
    }
    if (stage.stageType === "BAG_MAKING" && bagSpec?.bagsPerMeter && !inputQty.isZero()) {
      const expectedBags = convertQuantity({
        quantity: inputQty,
        fromUnit: "METER",
        toUnit: "BAG",
        context: { bagsPerMeter: bagSpec.bagsPerMeter },
      });
      if (output.gt(expectedBags.mul(1.05))) {
        throw new Error("Output exceeds expected bag count from input meters");
      }
    }
    if (stage.stageType === "HANDLE_PASTING" && bagSpec?.handlesPerBag) {
      const handlesRequired = output.mul(dec(bagSpec.handlesPerBag));
      const handleStage = await prisma.productionStage.findUnique({
        where: { orderId_sequence: { orderId, sequence: 6 } },
      });
      if (handleStage?.outputQty && handlesRequired.gt(dec(handleStage.outputQty))) {
        throw new Error("Not enough handles produced for bags pasted");
      }
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const effectiveOutput = isQc ? dec(qc?.passedQty ?? outputQty) : output;

    const updatedStage = await tx.productionStage.update({
      where: { id: stageId },
      data: {
        outputQty: isQc ? dec(qc?.passedQty ?? outputQty) : output,
        wasteQty: isQc ? dec(qc?.rejectedQty ?? 0) : waste,
        status: "COMPLETED",
        completedAt: new Date(),
        locked: true,
        remarks: remarks || null,
        workerId: workerId || stage.workerId,
      },
    });

    if (isQc) {
      const existingQc = await tx.qCRecord.findFirst({ where: { stageId } });
      const qcData = {
        passedQty: dec(qc?.passedQty ?? outputQty),
        rejectedQty: dec(qc?.rejectedQty ?? 0),
        defectTypeId: qc?.defectTypeId || null,
        photoUrl: qc?.photoUrl || null,
        machineId: stage.machineId || null,
        rollId: stage.rollId || null,
        remarks: qc?.remarks || remarks || null,
        createdById: workerId || null,
      };
      if (existingQc) {
        await tx.qCRecord.update({ where: { id: existingQc.id }, data: qcData });
      } else {
        await tx.qCRecord.create({ data: { stageId, ...qcData } });
      }
    }

    if (!inputQty.isZero()) {
      const yieldPercent = effectiveOutput.div(inputQty).mul(100);
      const yieldData = {
        orderId,
        expectedQty: inputQty,
        actualQty: effectiveOutput,
        yieldPercent,
        variance: effectiveOutput.sub(inputQty),
      };
      await tx.yieldRecord.upsert({
        where: { stageId },
        create: { stageId, ...yieldData },
        update: yieldData,
      });
    }

    const next = await tx.productionStage.findUnique({
      where: { orderId_sequence: { orderId, sequence: stage.sequence + 1 } },
    });

    if (next) {
      const nextInput = await resolveStageInputQty(tx, orderId, next, bagSpec);
      await tx.productionStage.update({
        where: { id: next.id },
        data: {
          status: "READY",
          inputQty: nextInput ?? effectiveOutput,
        },
      });
    } else {
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { status: "COMPLETED" },
      });
    }

    return {
      updatedStage,
      effectiveOutput,
      rollWaste: stage.rollId && waste.gt(0) ? { rollId: stage.rollId, waste, workerId } : null,
      rollUsage:
        stage.rollId && ["RAW_MATERIAL", "PRINTING"].includes(stage.stageType)
          ? { rollId: stage.rollId, used: effectiveOutput, workerId }
          : null,
      consumptionTasks: [],
    };
  });

  if (result.rollUsage) {
    const roll = await prisma.paperRoll.findUnique({ where: { id: result.rollUsage.rollId } });
    if (roll && result.rollUsage.used.gt(0)) {
      await postInventoryTransaction({
        materialId: roll.materialId,
        rollId: roll.id,
        transactionType: "STOCK_OUT",
        quantity: result.rollUsage.used,
        unit: "METER",
        referenceId: stageId,
        remarks: `Roll used at ${stage.stageType}`,
        createdById: result.rollUsage.workerId,
      });
    }
  }
  if (result.rollWaste) {
    const roll = await prisma.paperRoll.findUnique({ where: { id: result.rollWaste.rollId } });
    if (roll) {
      await postInventoryTransaction({
        materialId: roll.materialId,
        rollId: roll.id,
        transactionType: "WASTE",
        quantity: result.rollWaste.waste,
        unit: "METER",
        referenceId: stageId,
        remarks: "Stage waste",
        createdById: result.rollWaste.workerId,
      });
    }
  }

  if (stage.stageType === "BAG_MAKING") {
    const bagCount = result.effectiveOutput;
    const plannedSide = computePlannedGlue({ bagSpec, consumptionKind: "GLUE_SIDE", bagCount });
    const actualSide = dec(consumptions?.sideGlueKg ?? plannedSide);
    if (actualSide.gt(0) || plannedSide.gt(0)) {
      await recordStageConsumption({
        stageId,
        consumptionKind: "GLUE_SIDE",
        plannedQty: plannedSide,
        actualQty: actualSide,
        unit: "KG",
        workerId,
      });
    }
  }

  if (stage.stageType === "HANDLE_MAKING") {
    const plannedRope = computePlannedHandleRope({ outputQty: output, wasteQty: waste });
    const actualRope = dec(consumptions?.handleRopePcs ?? plannedRope);
    await recordStageConsumption({
      stageId,
      consumptionKind: "HANDLE_ROPE",
      plannedQty: plannedRope,
      actualQty: actualRope,
      unit: "PCS",
      workerId,
    });
  }

  if (stage.stageType === "HANDLE_PASTING") {
    const bagCount = result.effectiveOutput;
    const plannedBottom = computePlannedGlue({ bagSpec, consumptionKind: "GLUE_BOTTOM", bagCount });
    const actualBottom = dec(consumptions?.bottomGlueKg ?? plannedBottom);
    if (actualBottom.gt(0) || plannedBottom.gt(0)) {
      await recordStageConsumption({
        stageId,
        consumptionKind: "GLUE_BOTTOM",
        plannedQty: plannedBottom,
        actualQty: actualBottom,
        unit: "KG",
        workerId,
      });
    }
  }

  return result.updatedStage;
}

export async function unlockStage({ orderId, stageId }) {
  const stage = await getStageInOrder(orderId, stageId);
  if (!stage.locked) throw new Error("Stage is not locked");

  return prisma.productionStage.update({
    where: { id: stageId },
    data: {
      locked: false,
      status: "IN_PROGRESS",
    },
  });
}

export async function getWorkerTasks(workerId) {
  return prisma.productionStage.findMany({
    where: {
      status: { in: ["READY", "IN_PROGRESS"] },
      OR: [{ workerId: null }, { workerId: workerId }],
      order: { status: { in: ["PENDING", "RUNNING"] } },
    },
    include: {
      order: { include: { bagSpec: true } },
      machine: true,
      roll: true,
    },
    orderBy: [{ order: { createdAt: "desc" } }, { sequence: "asc" }],
  });
}

export async function getManagerKpis() {
  const [runningOrders, readyStages, lowStockCount] = await Promise.all([
    prisma.productionOrder.count({ where: { status: "RUNNING" } }),
    prisma.productionStage.count({ where: { status: "READY" } }),
    prisma.material.findMany().then(async () => {
      const { getAllMaterialStock } = await import("@/lib/services/inventory.service");
      const stocks = await getAllMaterialStock();
      return stocks.filter((m) => m.isLowStock).length;
    }),
  ]);

  return { runningOrders, readyStages, lowStockCount };
}

export { YIELD_THRESHOLD_PERCENT };
