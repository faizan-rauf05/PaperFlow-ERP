import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  STAGE_FLOW,
  QC_STAGE_TYPES,
  YIELD_THRESHOLD_PERCENT,
  getStageMeta,
  getStageLabel,
} from "@/lib/production-constants";
import {
  postInventoryTransaction,
  getMaterialStock,
} from "@/lib/services/inventory.service";
import { convertQuantity } from "@/lib/services/unit-conversion.service";
import {
  computePlannedGlue,
  computePlannedHandleRope,
  recordStageConsumption,
  getHandleCapacity,
} from "@/lib/services/consumption.service";
import { notifyRoles } from "@/lib/services/notification.service";

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
  cutWidthMm,
  pieceCount,
  pieceWeightKg,
  remainderAction,
  remainderQty,
  qc,
  ropeMaterialId,
  bagsPerCarton,
  lengthRestockQty,
  glueSideQty,
  glueBottomQty,
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

  const proofs = Array.isArray(proofUrls) ? proofUrls.filter(Boolean) : [];
  if (proofs.length === 0)
    throw new Error("At least one proof image is required");

  let output = dec(outputQty ?? 0);
  let waste = wasteQty != null ? dec(wasteQty) : null;
  let lengthRestock = lengthRestockQty != null ? dec(lengthRestockQty) : dec(0);
  let resolvedPieceCount = pieceCount != null ? parseInt(pieceCount, 10) : null;
  let widthRemainderQty = remainderQty != null ? dec(remainderQty) : dec(0);

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
    if (!cutWidthMm || Number(cutWidthMm) <= 0)
      throw new Error("Cut width is required");

    const rawStage = await prisma.productionStage.findUnique({
      where: {
        orderLineId_sequence: { orderLineId: stage.orderLineId, sequence: 1 },
      },
      include: { material: true },
    });
    // Material stores width in cm (paperWidthCm) — convert to mm for this math.
    const parentWidth = Number(rawStage?.material?.paperWidthCm || 0) * 10;
    const cutW = Number(cutWidthMm);
    resolvedPieceCount =
      parentWidth > 0 ? Math.floor(parentWidth / cutW) : resolvedPieceCount;
    if (!resolvedPieceCount || resolvedPieceCount < 1) {
      throw new Error("Cut width must be smaller than paper width");
    }

    const grossUsable = inputQty.mul(resolvedPieceCount);
    if (lengthRestock.lt(0))
      throw new Error("Length restock cannot be negative");
    if (lengthRestock.gt(grossUsable))
      throw new Error("Length restock cannot exceed usable cut meters");

    output = grossUsable.sub(lengthRestock);
    const widthRemMm =
      parentWidth > 0 ? parentWidth - resolvedPieceCount * cutW : 0;
    widthRemainderQty = widthRemMm > 0 ? inputQty : dec(0);

    if (widthRemainderQty.gt(0) && !remainderAction) {
      throw new Error("Choose Waste or Restock for leftover width strip");
    }
    waste = remainderAction === "WASTE" ? widthRemainderQty : dec(0);
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

  const flow = STAGE_FLOW[stage.stageType];
  const nextStageType = flow?.branches ? nextStage : (flow?.next ?? null);

  const { createdNext } = await prisma.$transaction(async (tx) => {
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
        cutWidthMm: cutWidthMm != null ? dec(cutWidthMm) : null,
        pieceCount: resolvedPieceCount,
        pieceWeightKg: pieceWeightKg != null ? dec(pieceWeightKg) : null,
        remainderAction: remainderAction || null,
        remainderQty:
          stage.stageType === "SLITTING"
            ? widthRemainderQty
            : remainderQty != null
              ? dec(remainderQty)
              : null,
        lengthRestockQty: stage.stageType === "SLITTING" ? lengthRestock : null,
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

    // Create the next stage in the SAME transaction as completing this one —
    // required so the order-completion rollup below never observes a line
    // with zero non-COMPLETED rows while it's actually still mid-pipeline.
    let createdNext = null;
    if (nextStageType) {
      const meta = getStageMeta(nextStageType);
      try {
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
      } catch (err) {
        // Unique (orderLineId, sequence) violation = next stage already
        // exists (idempotent re-record of a completed stage) — not an error.
        if (err.code !== "P2002") throw err;
      }
    }

    const incomplete = await tx.productionStage.count({
      where: { orderId, status: { not: "COMPLETED" } },
    });
    await tx.productionOrder.update({
      where: { id: orderId },
      data: { status: incomplete === 0 ? "COMPLETED" : "RUNNING" },
    });

    return { updatedStage, createdNext };
  });

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

  // Inventory side-effects (after TX)
  if (stage.stageType === "RAW_MATERIAL" && materialForStage) {
    await postInventoryTransaction({
      materialId: materialForStage,
      transactionType: "STOCK_OUT",
      quantity: output,
      unit: "METER",
      referenceId: stageId,
      remarks: "Raw material issued to order",
      createdById: userId,
    });
  }

  if (stage.stageType === "SLITTING") {
    const paperId =
      materialForStage ||
      (
        await prisma.productionStage.findUnique({
          where: {
            orderLineId_sequence: {
              orderLineId: stage.orderLineId,
              sequence: 1,
            },
          },
        })
      )?.materialId;

    if (paperId && widthRemainderQty.gt(0)) {
      if (remainderAction === "WASTE") {
        await postInventoryTransaction({
          materialId: paperId,
          transactionType: "WASTE",
          quantity: widthRemainderQty,
          unit: "METER",
          referenceId: stageId,
          remarks: `Slitting width leftover strip (${cutWidthMm ? "cut " + cutWidthMm + "mm" : "cut"})`,
          createdById: userId,
        });
      } else if (remainderAction === "RESTOCK") {
        await postInventoryTransaction({
          materialId: paperId,
          transactionType: "STOCK_IN",
          quantity: widthRemainderQty,
          unit: "METER",
          referenceId: stageId,
          remarks: "Slitting width remainder restock",
          createdById: userId,
        });
      }
    }

    if (paperId && lengthRestock.gt(0)) {
      await postInventoryTransaction({
        materialId: paperId,
        transactionType: "STOCK_IN",
        quantity: lengthRestock,
        unit: "METER",
        referenceId: stageId,
        remarks: `Slitting length restock (cut width ${cutWidthMm}mm)`,
        createdById: userId,
      });
    }
  }

  if (stage.stageType === "PRINTING" && waste.gt(0)) {
    const paperId =
      materialForStage ||
      (
        await prisma.productionStage.findUnique({
          where: {
            orderLineId_sequence: {
              orderLineId: stage.orderLineId,
              sequence: 1,
            },
          },
        })
      )?.materialId;
    if (paperId) {
      await postInventoryTransaction({
        materialId: paperId,
        transactionType: "WASTE",
        quantity: waste,
        unit: "METER",
        referenceId: stageId,
        remarks: "Printing waste",
        createdById: userId,
      });
    }
  }

  if (stage.stageType === "HANDLE_MAKING_PASTING") {
    const bagCount = output;
    const plannedRope = computePlannedHandleRope({
      bagCount,
      handlesPerBag: 2,
    });
    await recordStageConsumption({
      stageId,
      consumptionKind: "HANDLE_ROPE",
      plannedQty: plannedRope,
      actualQty: plannedRope,
      unit: "PCS",
      workerId: userId,
      materialId: ropeMaterialId,
    });

    const plannedBottom = computePlannedGlue({
      bagSpec: null,
      consumptionKind: "GLUE_BOTTOM",
      bagCount,
    });
    const actualBottom =
      glueBottomQty != null ? dec(glueBottomQty) : plannedBottom;
    if (actualBottom.gt(0) || plannedBottom.gt(0)) {
      await recordStageConsumption({
        stageId,
        consumptionKind: "GLUE_BOTTOM",
        plannedQty: plannedBottom,
        actualQty: actualBottom,
        unit: "KG",
        workerId: userId,
      });
    }

    const plannedSide = computePlannedGlue({
      bagSpec: null,
      consumptionKind: "GLUE_SIDE",
      bagCount,
    });
    const actualSide = glueSideQty != null ? dec(glueSideQty) : plannedSide;
    if (actualSide.gt(0) || plannedSide.gt(0)) {
      await recordStageConsumption({
        stageId,
        consumptionKind: "GLUE_SIDE",
        plannedQty: plannedSide,
        actualQty: actualSide,
        unit: "KG",
        workerId: userId,
      });
    }
  }

  if (stage.stageType === "PACKING" && cartonMaterialId) {
    await postInventoryTransaction({
      materialId: cartonMaterialId,
      transactionType: "STOCK_OUT",
      quantity: output,
      unit: "CARTON",
      referenceId: stageId,
      remarks: "Cartons used in packing",
      createdById: userId,
    });
  }

  return getOrderWithStages(orderId);
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

  let paperStock = null;
  if (rawStage?.materialId) {
    paperStock = Number(await getMaterialStock(rawStage.materialId));
  }

  return {
    stage,
    orderLine,
    inputQty: inputQty != null ? Number(inputQty) : null,
    paperMaterial: rawStage?.material || null,
    paperStock,
    suggestedCutWidthMm:
      orderLine?.widthMm != null ? Number(orderLine.widthMm) : null,
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
  const [runningOrders, readyStages, lowStockCount] = await Promise.all([
    prisma.productionOrder.count({ where: { status: "RUNNING" } }),
    prisma.productionStage.count({ where: { status: "READY" } }),
    (async () => {
      const stocks = await (
        await import("@/lib/services/inventory.service")
      ).getAllMaterialStock();
      return stocks.filter((m) => m.isLowStock).length;
    })(),
  ]);

  return { runningOrders, readyStages, lowStockCount };
}

export { YIELD_THRESHOLD_PERCENT, getHandleCapacity };
