import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  STAGE_FLOW,
  QC_STAGE_TYPES,
  YIELD_THRESHOLD_PERCENT,
  getStageMeta,
  getStageLabel,
} from "@/lib/production-constants";
import { consumeStock, getMaterialStock, restockLeftover } from "@/lib/services/stock.service";
import { computePerBagConsumption } from "@/lib/material-suggestion";
import { materialCode, materialName, stockGroupFor } from "@/lib/material-catalog";
import { computePaperWeightKg, computeRollWidthCm, planSlitting } from "@/lib/paper-sizing";
import { computeSlitting } from "@/lib/slitting-math";
import {
  CONSUMPTION_KINDS,
  computePlannedConsumption,
  upsertStageConsumption,
} from "@/lib/services/consumption.service";
import { notifyRoles } from "@/lib/services/notification.service";
import { raiseFactoryShortfalls } from "@/lib/services/transfer-task.service";

const { Decimal } = Prisma;

function dec(v) {
  return new Decimal(v?.toString() ?? "0");
}

function getStageOutputQty(stage) {
  if (QC_STAGE_TYPES.includes(stage.stageType) && stage.qcRecords?.[0]) {
    return dec(stage.qcRecords[0].passedQty);
  }
  return dec(stage.outputQty);
}

export async function getOrderWithStages(orderId, db = prisma) {
  return db.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      assignedWorker: { select: { id: true, name: true, email: true } },
      lines: {
        orderBy: { lineNo: "asc" },
        include: {
          stages: {
            orderBy: { sequence: "asc" },
            include: {
              worker: { select: { id: true, name: true, email: true } },
              machine: true,
              material: true,
              qcRecords: {
                include: {
                  defectType: { include: { category: true } },
                  machine: true,
                  createdBy: { select: { id: true, name: true } },
                },
              },
              yieldRecord: true,
              consumptions: { include: { material: true } },
            },
          },
        },
      },
    },
  });
}

async function getStageInOrder(orderId, stageId) {
  const stage = await prisma.productionStage.findFirst({
    where: { id: stageId, orderId },
    include: {
      orderLine: { include: { order: { select: { orderNo: true } } } },
      material: true,
      qcRecords: true,
      consumptions: true,
    },
  });
  if (!stage) throw new Error("Stage not found");
  return stage;
}

/** Most recently completed stage for a line — the actual predecessor under branching. */
async function getLatestCompletedStage(orderLineId) {
  return prisma.productionStage.findFirst({
    where: { orderLineId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
    include: { qcRecords: true },
  });
}

/**
 * Atomically claims an open (READY, unclaimed) stage for a worker.
 * Guarded single-statement update — first claimant wins, no double-booking.
 */
export async function claimStage({ stageId, orderId, workerId }) {
  const result = await prisma.productionStage.updateMany({
    where: { id: stageId, orderId, status: "READY", workerId: null },
    data: { status: "IN_PROGRESS", workerId, startedAt: new Date() },
  });
  if (result.count === 0) {
    throw new Error("Stage already claimed or unavailable");
  }
  return getStageInOrder(orderId, stageId);
}

/**
 * Stock movements for a recorded stage, all at the FACTORY (production draws
 * from factory stock). Only real movements are written: paper issued at Raw
 * Material, unused length returned and recycled rolls created at Slitting,
 * glue/rope used at Handle Making, cartons used at Packing. Waste is not a further movement — it's part
 * of what was already issued, recorded on the stage for yield.
 *
 * Replaces whatever this stage wrote before, so re-recording a completed
 * stage corrects its movements instead of adding to them. Returns soft
 * below-zero warnings.
 */
async function writeStageStock(
  tx,
  { stage, stageId, userId, paperMaterialId, output, lengthRestock, recycled, cartonMaterialId, handleConsumptions },
) {
  await tx.inventoryTransaction.deleteMany({ where: { stageId } });

  const warnings = [];
  const base = { location: "FACTORY", stageId, referenceId: stage.orderLine?.order?.orderNo || null, createdById: userId || null };
  const issue = async (materialId, quantity, remarks) => {
    if (!materialId || !dec(quantity).gt(0)) return;
    const { warning } = await consumeStock({ ...base, materialId, quantity, remarks }, tx);
    if (warning) warnings.push(warning);
  };
  const putBack = async (materialId, quantity, remarks) => {
    if (!materialId || !dec(quantity).gt(0)) return;
    await restockLeftover({ ...base, materialId, quantity, remarks }, tx);
  };

  switch (stage.stageType) {
    case "RAW_MATERIAL":
      await issue(paperMaterialId, output, "Paper issued to order");
      break;
    case "SLITTING":
      await putBack(paperMaterialId, lengthRestock, "Slitting: unused length returned to the roll");
      await replaceRecycledRolls(tx, { stageId, base, ...recycled });
      break;
    case "HANDLE_MAKING_PASTING":
      await tx.stageConsumption.deleteMany({ where: { stageId } });
      for (const c of handleConsumptions) {
        await upsertStageConsumption(tx, {
          stageId,
          consumptionKind: c.consumptionKind,
          materialId: c.materialId,
          plannedQty: c.plannedQty,
          actualQty: c.actualQty,
        });
        await issue(c.materialId, c.actualQty, CONSUMPTION_KINDS[c.consumptionKind].label);
      }
      break;
    case "PACKING":
      await issue(cartonMaterialId, output, "Cartons used in packing");
      break;
  }
  return warnings;
}

/**
 * The recycled rolls a slitting stage cut from its parent roll: each is its
 * own paper roll (type Recycled, the parent's color and GSM, its own width,
 * length and weight), barcoded parent + "-1", "-2"… in order across every
 * slitting of that parent, and received into factory stock. Re-recording the
 * stage replaces them — unless one has since been moved or used.
 */
async function replaceRecycledRolls(tx, { stageId, base, parent, count, widthCm, lengthM }) {
  const previous = await tx.material.findMany({ where: { recycledAtStageId: stageId }, select: { id: true } });
  if (previous.length > 0) {
    const ids = previous.map((m) => m.id);
    // This stage's own movements were already cleared, so any left are someone else's
    const [movements, orderLinks, stages] = await Promise.all([
      tx.inventoryTransaction.count({ where: { materialId: { in: ids } } }),
      tx.orderLineMaterial.count({ where: { materialId: { in: ids } } }),
      tx.productionStage.count({ where: { materialId: { in: ids } } }),
    ]);
    if (movements + orderLinks + stages > 0) {
      throw new Error("The recycled rolls from this slitting have already been moved or used, so it can't be re-recorded");
    }
    await tx.material.deleteMany({ where: { id: { in: ids } } });
  }
  if (!count) return;

  const siblings = await tx.material.findMany({ where: { parentRollId: parent.id }, select: { barCode: true } });
  const lastSuffix = siblings.reduce((max, m) => {
    const n = parseInt(m.barCode?.slice(parent.barCode.length + 1), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);

  const length = Math.round(lengthM * 10000) / 10000;
  const fields = {
    paperType: "RECYCLED",
    paperColor: parent.paperColor,
    paperWidthCm: dec(widthCm),
    paperLengthM: dec(length),
    gsm: parent.gsm,
    weightKg: dec(computePaperWeightKg(length, widthCm, parent.gsm).toFixed(4)),
  };
  for (let i = 1; i <= count; i++) {
    const barCode = `${parent.barCode}-${lastSuffix + i}`;
    const roll = await tx.material.create({
      data: {
        ...fields,
        barCode,
        materialType: "PAPER_ROLL",
        unit: "METER",
        supplierId: parent.supplierId,
        catalogKey: null,
        stockGroup: stockGroupFor("PAPER_ROLL", fields),
        name: materialName("PAPER_ROLL", fields),
        code: materialCode("PAPER_ROLL", fields),
        parentRollId: parent.id,
        recycledAtStageId: stageId,
      },
    });
    await restockLeftover(
      { ...base, materialId: roll.id, quantity: length, remarks: `Recycled at slitting from roll ${parent.barCode}` },
      tx,
    );
  }
}

/** The paper roll issued to an order line at Raw Material (sequence 1). */
async function getIssuedRoll(orderLineId) {
  const rawStage = await prisma.productionStage.findUnique({
    where: { orderLineId_sequence: { orderLineId, sequence: 1 } },
    include: { material: true },
  });
  return rawStage?.material || null;
}

/**
 * Records a stage's output, auto-computes waste, and (in the same
 * transaction as completing this stage) creates the next stage — following
 * STAGE_FLOW, or the worker's branch choice at PRINT_QC.
 */
export async function recordStage({
  orderId,
  stageId,
  userId,
  role,
  materialId,
  machineId,
  outputQty,
  wasteQty,
  proofUrls,
  remarks,
  qc,
  lengthRestockQty,
  recycledRollCount,
  recycledWidthCm,
  glueSideQty,
  glueSideMaterialId,
  glueBottomQty,
  glueBottomMaterialId,
  ropeQty,
  ropeMaterialId,
  cartonMaterialId,
  nextStage,
}) {
  const stage = await getStageInOrder(orderId, stageId);
  const isPrivileged = role === "ADMIN" || role === "MANAGER";

  if (isPrivileged) {
    if (!["READY", "IN_PROGRESS", "COMPLETED"].includes(stage.status)) {
      throw new Error("Stage is not ready to record");
    }
  } else {
    if (stage.status !== "IN_PROGRESS" || stage.workerId !== userId) {
      throw new Error("Claim this stage before recording it");
    }
  }

  if (stage.sequence > 1) {
    const prev = await getLatestCompletedStage(stage.orderLineId);
    if (!prev) {
      throw new Error("Previous stage incomplete");
    }
  }

  const isQc = QC_STAGE_TYPES.includes(stage.stageType);
  let inputQty = stage.inputQty != null ? dec(stage.inputQty) : null;

  if (stage.sequence === 1) {
    // Raw material: operator enters meters issued as output; input mirrors issued qty
    const issued = dec(outputQty ?? 0);
    if (issued.lte(0)) throw new Error("Meters issued is required");
    if (!materialId) throw new Error("Select a paper material");
    inputQty = issued;
  } else if (inputQty == null) {
    const prev = await getLatestCompletedStage(stage.orderLineId);
    inputQty = prev ? getStageOutputQty(prev) : dec(0);
  }

  let handleConsumptions = [];
  const proofs = Array.isArray(proofUrls) ? proofUrls.filter(Boolean) : [];
  if (proofs.length === 0)
    throw new Error("At least one proof image is required");

  let output = dec(outputQty ?? 0);
  let waste = wasteQty != null ? dec(wasteQty) : null;
  let lengthRestock = lengthRestockQty != null && lengthRestockQty !== "" ? dec(lengthRestockQty) : dec(0);
  let slitting = null; // SLITTING only: { bagWidthCm, count, widthCm, result, parent }

  if (isQc) {
    const passed = dec(qc?.passedQty ?? outputQty ?? 0);
    if (passed.lt(0)) throw new Error("Passed qty cannot be negative");
    if (passed.gt(inputQty)) throw new Error("Passed cannot exceed input");
    const rejected = inputQty.sub(passed);
    output = passed;
    waste = rejected;

    if (stage.stageType === "PRINT_QC") {
      const branches = STAGE_FLOW.PRINT_QC.branches;
      if (!branches.includes(nextStage)) {
        throw new Error(`Choose the next stage: ${branches.join(" or ")}`);
      }
    }
  } else if (stage.stageType === "SLITTING") {
    if (!machineId) throw new Error("Slitting machine is required");
    const parent = await getIssuedRoll(stage.orderLineId);
    const bagWidthCm = computeRollWidthCm(stage.orderLine.widthCm, stage.orderLine.baseCm);
    const count = recycledRollCount != null && recycledRollCount !== "" ? Number(recycledRollCount) : 0;
    const widthCm = count > 0 ? Number(recycledWidthCm) : 0;
    const result = computeSlitting({
      inputMeters: Number(inputQty),
      lengthRestockMeters: Number(lengthRestock),
      parentWidthCm: parent?.paperWidthCm,
      bagWidthCm,
      gsm: parent?.gsm,
      stripCount: count,
      stripWidthCm: widthCm,
    });
    if (result.error) throw new Error(result.error);
    if (count > 0 && !parent?.barCode) throw new Error("The issued roll has no barcode to number recycled rolls from");
    slitting = { bagWidthCm, count, widthCm, result, parent };
    // The bag-width web runs on; the waste is width, recorded in kg below.
    output = dec(result.lengthM);
    waste = dec(0);
  } else if (stage.stageType === "PRINTING") {
    if (output.lte(0)) throw new Error("Printed meters are required");
    if (output.gt(inputQty))
      throw new Error("Printed meters cannot exceed input");
    waste = inputQty.sub(output);
  } else if (stage.stageType === "HANDLE_MAKING_PASTING") {
    if (output.lte(0)) throw new Error("Bag count is required");
    // No per-bag meters-per-bag rate is available (BagSpecification was
    // removed and has no replacement source on OrderLine) — waste falls
    // back to whatever the operator enters, no auto-derivation.
    waste = waste != null ? waste : dec(0);

    // Glue and rope: planned from the bag dimensions, actual as entered
    // (defaulting to planned), each against the supplier material used.
    const planned = computePlannedConsumption(stage.orderLine, output);
    handleConsumptions = [
      { consumptionKind: "GLUE_SIDE", materialId: glueSideMaterialId, actual: glueSideQty, label: "side glue" },
      { consumptionKind: "GLUE_BOTTOM", materialId: glueBottomMaterialId, actual: glueBottomQty, label: "bottom glue" },
      { consumptionKind: "HANDLE_ROPE", materialId: ropeMaterialId, actual: ropeQty, label: "handle rope" },
    ]
      .map((c) => ({
        ...c,
        plannedQty: planned[c.consumptionKind],
        actualQty: c.actual != null && c.actual !== "" ? dec(c.actual) : planned[c.consumptionKind],
      }))
      .filter((c) => c.actualQty.gt(0));
    for (const c of handleConsumptions) {
      if (c.actualQty.lt(0)) throw new Error(`The ${c.label} used can't be negative`);
      if (!c.materialId) throw new Error(`Select which ${c.label} was used`);
    }
  } else if (stage.stageType === "PACKING") {
    if (output.lte(0)) throw new Error("Carton count is required");
    if (!cartonMaterialId) throw new Error("Select a carton material");
    waste = waste != null ? waste : dec(0);
  } else if (stage.stageType === "DISPATCH") {
    if (output.lte(0)) throw new Error("Dispatched quantity is required");
    waste = waste != null ? waste : inputQty.sub(output);
    if (waste.lt(0)) waste = dec(0);
  } else {
    if (output.lte(0) && !isQc) throw new Error("Output quantity is required");
    waste = waste != null ? waste : Decimal.max(inputQty.sub(output), 0);
  }

  const materialForStage = materialId || stage.materialId || null;
  // Later stages work on the roll issued at Raw Material (sequence 1).
  const paperMaterialId =
    materialForStage ||
    (stage.sequence > 1
      ? (
          await prisma.productionStage.findUnique({
            where: { orderLineId_sequence: { orderLineId: stage.orderLineId, sequence: 1 } },
            select: { materialId: true },
          })
        )?.materialId
      : null);

  const flow = STAGE_FLOW[stage.stageType];
  const nextStageType = flow?.branches ? nextStage : (flow?.next ?? null);

  const { createdNext, stockWarnings } = await prisma.$transaction(async (tx) => {
    const updatedStage = await tx.productionStage.update({
      where: { id: stageId },
      data: {
        status: "COMPLETED",
        inputQty,
        outputQty: output,
        wasteQty: waste,
        materialId: materialForStage,
        machineId: machineId || null,
        workerId: userId || null,
        startedAt: stage.startedAt || new Date(),
        completedAt: new Date(),
        proofUrls: proofs,
        remarks: remarks || null,
        bagWidthCm: slitting ? dec(slitting.bagWidthCm) : null,
        recycledRollCount: slitting ? slitting.count : null,
        recycledWidthCm: slitting?.count ? dec(slitting.widthCm) : null,
        slitWasteWidthCm: slitting ? dec(slitting.result.wasteWidthCm) : null,
        slitWasteKg: slitting?.result.wasteKg != null ? dec(slitting.result.wasteKg.toFixed(4)) : null,
        lengthRestockQty: slitting ? lengthRestock : null,
      },
    });

    if (isQc) {
      const existingQc = await tx.qCRecord.findFirst({ where: { stageId } });
      const qcData = {
        passedQty: output,
        rejectedQty: waste,
        defectTypeId: qc?.defectTypeId || null,
        photoUrl: proofs[0] || null,
        machineId: machineId || null,
        remarks: qc?.remarks || remarks || null,
        createdById: userId || null,
      };
      if (existingQc) {
        await tx.qCRecord.update({
          where: { id: existingQc.id },
          data: qcData,
        });
      } else {
        await tx.qCRecord.create({ data: { stageId, ...qcData } });
      }
    }

    if (inputQty.gt(0)) {
      const yieldPercent = output.div(inputQty).mul(100);
      await tx.yieldRecord.upsert({
        where: { stageId },
        create: {
          stageId,
          orderId,
          expectedQty: inputQty,
          actualQty: output,
          yieldPercent,
          variance: output.sub(inputQty),
        },
        update: {
          expectedQty: inputQty,
          actualQty: output,
          yieldPercent,
          variance: output.sub(inputQty),
        },
      });
    }

    const stockWarnings = await writeStageStock(tx, {
      stage,
      stageId,
      userId,
      paperMaterialId,
      output,
      lengthRestock,
      recycled: slitting && {
        parent: slitting.parent,
        count: slitting.count,
        widthCm: slitting.widthCm,
        lengthM: slitting.result.lengthM,
      },
      cartonMaterialId,
      handleConsumptions,
    });

    // Create the next stage in the SAME transaction as completing this one —
    // required so the order-completion rollup below never observes a line
    // with zero non-COMPLETED rows while it's actually still mid-pipeline.
    let createdNext = null;
    // Re-recording a completed stage: its next stage already exists. Checked
    // first — a failed insert would abort the whole Postgres transaction.
    const nextExists =
      nextStageType &&
      (await tx.productionStage.findUnique({
        where: { orderLineId_sequence: { orderLineId: stage.orderLineId, sequence: stage.sequence + 1 } },
        select: { id: true },
      }));
    if (nextStageType && !nextExists) {
      const meta = getStageMeta(nextStageType);
      createdNext = await tx.productionStage.create({
        data: {
          orderId,
          orderLineId: stage.orderLineId,
          stageType: nextStageType,
          sequence: stage.sequence + 1,
          inputUnit: meta?.inputUnit,
          outputUnit: meta?.outputUnit,
          status: "READY",
          inputQty: output,
        },
      });
    }

    const incomplete = await tx.productionStage.count({
      where: { orderId, status: { not: "COMPLETED" } },
    });
    await tx.productionOrder.update({
      where: { id: orderId },
      data: { status: incomplete === 0 ? "COMPLETED" : "RUNNING" },
    });

    return { updatedStage, createdNext, stockWarnings };
  }, { timeout: 15000 });

  // Factory stock below zero, or glue below its drum minimum -> warehouse
  // task. Fire-and-forget (it swallows its own errors) so it never adds
  // latency or undoes the record.
  if (stockWarnings.length > 0 || handleConsumptions.length > 0) {
    raiseFactoryShortfalls(
      [paperMaterialId, cartonMaterialId, ...handleConsumptions.map((c) => c.materialId)],
      { orderId },
    );
  }

  // Notify all workers the next stage is open — fired async, not awaited,
  // so fan-out (one Notification row per active worker) never adds latency
  // to this response. notifyRoles already swallows its own errors.
  if (createdNext) {
    const orderNo = stage.orderLine?.order?.orderNo;
    notifyRoles(["WORKER"], {
      type: "STAGE_READY",
      title: "Stage ready to pick up",
      message: `Order ${orderNo || ""} — ${getStageLabel(nextStageType)} is ready to pick up`,
      link: "/dashboard/worker",
      entityType: "ProductionOrder",
      entityId: orderId,
    }).catch((e) => console.error("notify STAGE_READY failed", e));
  }

  return { order: await getOrderWithStages(orderId), stockWarnings };
}

/** Prefill helpers for the worker/admin record form */
export async function getStageRecordContext(orderId, stageId) {
  const stage = await getStageInOrder(orderId, stageId);
  const orderLine = stage.orderLine;

  let inputQty = stage.inputQty;
  if (inputQty == null && stage.sequence > 1) {
    const prev = await getLatestCompletedStage(stage.orderLineId);
    inputQty = prev ? getStageOutputQty(prev).toNumber() : null;
  }

  const rawStage = await prisma.productionStage.findUnique({
    where: {
      orderLineId_sequence: { orderLineId: stage.orderLineId, sequence: 1 },
    },
    include: { material: true },
  });

  const bagWidthCm = orderLine ? computeRollWidthCm(orderLine.widthCm, orderLine.baseCm) : null;

  // Production draws from factory stock.
  let paperStock = null;
  if (rawStage?.materialId) {
    paperStock = Number(await getMaterialStock(rawStage.materialId, "FACTORY"));
  }

  return {
    stage,
    orderLine,
    inputQty: inputQty != null ? Number(inputQty) : null,
    paperMaterial: rawStage?.material || null,
    paperStock,
    // Glue/rope per bag, to pre-fill Handle Making usage from the bag count.
    perBagConsumption: orderLine ? computePerBagConsumption(orderLine) : null,
    // Slitting: the width the bag keeps and the planned recycled rolls/waste
    bagWidthCm,
    slitPlan: bagWidthCm && rawStage?.material ? planSlitting(rawStage.material.paperWidthCm, bagWidthCm) : null,
  };
}

// Cancelled or archived orders drop out of the worker pool immediately —
// no need to touch the stage rows themselves, just exclude them here.
const LIVE_ORDER_FILTER = {
  orderLine: { order: { status: { not: "CANCELLED" }, isArchived: false } },
};

/** Open stages nobody has claimed yet — visible to every worker. */
export async function getAvailableStages() {
  return prisma.productionStage.findMany({
    where: { status: "READY", workerId: null, ...LIVE_ORDER_FILTER },
    include: {
      orderLine: { include: { order: { include: { customer: true } } } },
      machine: true,
      material: true,
    },
    orderBy: [{ createdAt: "asc" }],
  });
}

/** Stages the given worker currently holds. */
export async function getMyActiveStages(workerId) {
  return prisma.productionStage.findMany({
    where: { status: "IN_PROGRESS", workerId, ...LIVE_ORDER_FILTER },
    include: {
      orderLine: { include: { order: { include: { customer: true } } } },
      machine: true,
      material: true,
    },
    orderBy: [{ startedAt: "asc" }],
  });
}

export async function getManagerKpis() {
  const [runningOrders, readyStages] = await Promise.all([
    prisma.productionOrder.count({ where: { status: "RUNNING" } }),
    prisma.productionStage.count({ where: { status: "READY" } }),
  ]);
  return { runningOrders, readyStages };
}

export { YIELD_THRESHOLD_PERCENT };
