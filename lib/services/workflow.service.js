import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  STAGE_PIPELINE,
  QC_STAGE_TYPES,
  YIELD_THRESHOLD_PERCENT,
} from "@/lib/production-constants";
import {
  postInventoryTransaction,
  getMaterialStock,
} from "@/lib/services/inventory.service";
import {
  convertQuantity,
  computeBagsPerMeter,
} from "@/lib/services/unit-conversion.service";
import {
  computePlannedGlue,
  computePlannedHandleRope,
  recordStageConsumption,
  getHandleCapacity,
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

function sizeToCode(sizeLabel) {
  const base = sizeLabel
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  return base ? `BAG-${base}` : `BAG-${Date.now()}`;
}

/**
 * Resolve bagSpecId from an existing id, or find/create from a free-text bag size.
 */
async function resolveBagSpecId(db, line) {
  if (line.bagSpecId) {
    const existing = await db.bagSpecification.findUnique({
      where: { id: line.bagSpecId },
    });
    if (!existing)
      throw new Error(`Bag specification not found: ${line.bagSpecId}`);
    return existing.id;
  }

  const sizeLabel = String(line.bagSize || "").trim();
  if (!sizeLabel)
    throw new Error("Each line needs a bag size or bag specification");

  const byName = await db.bagSpecification.findFirst({
    where: { name: { equals: sizeLabel, mode: "insensitive" } },
  });
  if (byName) return byName.id;

  let code = sizeToCode(sizeLabel);
  const codeTaken = await db.bagSpecification.findUnique({ where: { code } });
  if (codeTaken) code = `${code}-${Date.now().toString(36).slice(-4)}`;

  const dims = sizeLabel.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  const bagWidthMm = dims ? Number(dims[1]) : null;
  const repeatLengthMm = dims ? Number(dims[2]) : null;
  const bagsPerMeter =
    bagWidthMm && repeatLengthMm
      ? computeBagsPerMeter({ bagWidthMm, repeatLengthMm })
      : new Decimal(2.5);

  const created = await db.bagSpecification.create({
    data: {
      name: sizeLabel,
      code,
      bagWidthMm,
      repeatLengthMm,
      bagsPerMeter,
      handlesPerBag: 2,
      description: `Created from order size: ${sizeLabel}`,
    },
  });
  return created.id;
}

export async function createProductionOrder({
  customerId,
  salesRep,
  assignedWorkerId,
  startDate,
  deliveryDate,
  notes,
  lines,
}) {
  if (!customerId) throw new Error("Customer is required");
  if (!assignedWorkerId) throw new Error("Assigned worker is required");
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("At least one order line is required");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer) throw new Error("Customer not found");

  const worker = await prisma.user.findFirst({
    where: { id: assignedWorkerId, role: "WORKER", isActive: true },
  });
  if (!worker) throw new Error("Assigned worker not found or inactive");

  for (const line of lines) {
    if (!line.plannedQty || Number(line.plannedQty) <= 0) {
      throw new Error("Each line needs a positive planned quantity");
    }
  }

  const orderNo = await generateOrderNo();

  return prisma.$transaction(
    async (tx) => {
      const order = await tx.productionOrder.create({
        data: {
          orderNo,
          customerId,
          salesRep: salesRep?.trim() || null,
          assignedWorkerId,
          startDate: startDate ? new Date(startDate) : null,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
          notes: notes?.trim() || null,
          status: "PENDING",
        },
      });

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const orderLine = await tx.orderLine.create({
          data: {
            orderId: order.id,
            heightMm: line.heightMm != null ? dec(line.heightMm) : null,
            widthMm: line.widthMm != null ? dec(line.widthMm) : null,
            baseMm: line.baseMm != null ? dec(line.baseMm) : null,
            fileUrl: line.fileUrl || null,
            fileName: line.fileName || null,
            plannedQty: dec(line.plannedQty),
            lineNo: i + 1,
          },
        });

        await tx.productionStage.createMany({
          data: STAGE_PIPELINE.map((stage) => ({
            orderId: order.id,
            orderLineId: orderLine.id,
            stageType: stage.stageType,
            sequence: stage.sequence,
            inputUnit: stage.inputUnit,
            outputUnit: stage.outputUnit,
            status: stage.sequence === 1 ? "READY" : "PENDING",
            workerId: assignedWorkerId,
          })),
        });
      }

      return getOrderWithStages(order.id, tx);
    },
    { timeout: 20000 },
  );
}

export async function assignOrderWorker(orderId, assignedWorkerId) {
  const worker = await prisma.user.findFirst({
    where: { id: assignedWorkerId, role: "WORKER", isActive: true },
  });
  if (!worker) throw new Error("Assigned worker not found or inactive");

  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
  });
  if (!order) throw new Error("Order not found");

  await prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id: orderId },
      data: { assignedWorkerId },
    });
    // Reassign incomplete stages to the new responsible worker
    await tx.productionStage.updateMany({
      where: { orderId, status: { not: "COMPLETED" } },
      data: { workerId: assignedWorkerId },
    });
  });

  return getOrderWithStages(orderId);
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
      orderLine: true,
      material: true,
      qcRecords: true,
    },
  });
  if (!stage) throw new Error("Stage not found");
  return stage;
}

/**
 * Admin records a stage: sets output, auto waste, proofs, advances next stage.
 */
export async function recordStage({
  orderId,
  stageId,
  userId,
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
}) {
  const stage = await getStageInOrder(orderId, stageId);
  if (!["READY", "IN_PROGRESS", "COMPLETED"].includes(stage.status)) {
    throw new Error("Stage is not ready to record");
  }

  if (stage.sequence > 1) {
    const prev = await prisma.productionStage.findUnique({
      where: {
        orderLineId_sequence: {
          orderLineId: stage.orderLineId,
          sequence: stage.sequence - 1,
        },
      },
    });
    if (!prev || prev.status !== "COMPLETED") {
      throw new Error("Previous stage incomplete");
    }
  }

  const bagSpec = stage.orderLine?.bagSpec;
  const isQc = QC_STAGE_TYPES.includes(stage.stageType);
  let inputQty = stage.inputQty != null ? dec(stage.inputQty) : null;

  if (stage.sequence === 1) {
    // Raw material: operator enters meters issued as output; input mirrors issued qty
    const issued = dec(outputQty ?? 0);
    if (issued.lte(0)) throw new Error("Meters issued is required");
    if (!materialId) throw new Error("Select a paper material");
    inputQty = issued;
  } else if (inputQty == null) {
    const prev = await prisma.productionStage.findUnique({
      where: {
        orderLineId_sequence: {
          orderLineId: stage.orderLineId,
          sequence: stage.sequence - 1,
        },
      },
      include: { qcRecords: true },
    });
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
    const parentWidth = Number(rawStage?.material?.paperWidthMm || 0);
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
    if (bagSpec?.bagsPerMeter) {
      const metersUsed = convertQuantity({
        quantity: output,
        fromUnit: "BAG",
        toUnit: "METER",
        context: { bagsPerMeter: bagSpec.bagsPerMeter },
      });
      waste = Decimal.max(inputQty.sub(metersUsed), 0);
    } else {
      waste = waste != null ? waste : dec(0);
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

  const updated = await prisma.$transaction(async (tx) => {
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

    const next = await tx.productionStage.findUnique({
      where: {
        orderLineId_sequence: {
          orderLineId: stage.orderLineId,
          sequence: stage.sequence + 1,
        },
      },
    });

    if (next) {
      await tx.productionStage.update({
        where: { id: next.id },
        data: {
          status: "READY",
          inputQty: output,
        },
      });
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { status: "RUNNING" },
      });
    } else {
      const incomplete = await tx.productionStage.count({
        where: { orderId, status: { not: "COMPLETED" } },
      });
      await tx.productionOrder.update({
        where: { id: orderId },
        data: { status: incomplete === 0 ? "COMPLETED" : "RUNNING" },
      });
    }

    return updatedStage;
  });

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
      handlesPerBag: bagSpec?.handlesPerBag ?? 2,
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
      bagSpec,
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
      bagSpec,
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

/** Prefill helpers for admin record form */
export async function getStageRecordContext(orderId, stageId) {
  const stage = await getStageInOrder(orderId, stageId);
  const orderLine = stage.orderLine;

  let inputQty = stage.inputQty;
  if (inputQty == null && stage.sequence > 1) {
    const prev = await prisma.productionStage.findUnique({
      where: {
        orderLineId_sequence: {
          orderLineId: stage.orderLineId,
          sequence: stage.sequence - 1,
        },
      },
      include: { qcRecords: true },
    });
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

export async function getWorkerTasks(workerId) {
  return prisma.productionStage.findMany({
    where: {
      status: { in: ["READY", "IN_PROGRESS"] },
      OR: [{ workerId: null }, { workerId }],
      // order status filter via relation not available without join — filter in include
    },
    include: {
      orderLine: { include: { order: { include: { customer: true } } } },
      machine: true,
      material: true,
    },
    orderBy: [{ sequence: "asc" }],
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
