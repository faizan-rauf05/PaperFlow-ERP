import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMaterialStock, getStockByMaterial, transferStock } from "@/lib/services/stock.service";
import { notifyRoles } from "@/lib/services/notification.service";
import { getFactoryGlueLevels } from "@/lib/services/factory-glue.service";
import { formatQuantity } from "@/lib/material-catalog";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

const { Decimal } = Prisma;

/**
 * Warehouse → factory transfer tasks. Production draws from factory stock
 * and is allowed to take it below zero (material physically on the floor
 * that the ledger still has in the warehouse). Each time that happens the
 * warehouse gets a task: move the stock and upload proof of the transfer.
 * Glue follows a stricter rule — a task as soon as a glue type drops below
 * its drum minimum in the factory (see checkFactoryGlueLevels).
 */

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Raises (or updates) an OPEN transfer task for every given material whose
 * factory stock is now below zero, and notifies the warehouse about new
 * ones. Called after production movements are written; never throws — a
 * failure here mustn't undo a recorded stage.
 */
export async function raiseFactoryShortfalls(materialIds, { orderId = null } = {}) {
  try {
    const ids = [...new Set(materialIds.filter(Boolean))];
    if (ids.length === 0) return;
    // Glue has its own, stricter rule (a drum minimum), which also covers below zero.
    const glueIds = new Set(
      (await prisma.material.findMany({ where: { id: { in: ids }, materialType: "GLUE" }, select: { id: true } })).map(
        (m) => m.id,
      ),
    );
    if (glueIds.size > 0) await checkFactoryGlueLevels({ orderId });
    const stock = await getStockByMaterial(ids);

    for (const materialId of ids.filter((id) => !glueIds.has(id))) {
      const factory = stock.get(materialId).FACTORY;
      if (factory >= 0) continue;
      const shortfallQty = new Decimal(-factory).toDecimalPlaces(4);

      const open = await prisma.stockTransferTask.findFirst({ where: { materialId, status: "OPEN" } });
      if (open) {
        await prisma.stockTransferTask.update({ where: { id: open.id }, data: { shortfallQty } });
        continue;
      }

      const task = await prisma.stockTransferTask.create({
        data: { materialId, shortfallQty, orderId },
        include: { material: true, order: { select: { orderNo: true } } },
      });
      await notifyRoles(["WAREHOUSE"], {
        type: "STOCK_TRANSFER_REQUIRED",
        title: "Transfer stock to the factory",
        message: `${task.material.name} is ${formatQuantity(shortfallQty, task.material.unit)} below zero in the factory${
          task.order ? ` (order ${task.order.orderNo})` : ""
        } — move it from the warehouse and upload proof`,
        link: "/dashboard/warehouse/transfers",
        entityType: "StockTransferTask",
        entityId: task.id,
      });
    }
  } catch (err) {
    console.error("raiseFactoryShortfalls failed", err);
  }
}

/**
 * Keeps one OPEN supply task per glue type that is below its drum minimum in
 * the factory, sized in whole drums back up to the minimum, and notifies the
 * warehouse when one is first raised. The task is filed against that type's
 * material with the most warehouse stock (what the warehouse can supply
 * from). Never throws — callers are stock writes that mustn't fail on it.
 */
export async function checkFactoryGlueLevels({ orderId = null } = {}) {
  try {
    const levels = (await getFactoryGlueLevels()).filter((l) => l.isLow);
    for (const level of levels) {
      const shortfallQty = new Decimal(level.drumsNeeded * level.drumKg).toDecimalPlaces(4);
      const open = await prisma.stockTransferTask.findFirst({
        where: { status: "OPEN", materialId: { in: level.materialIds } },
      });
      if (open) {
        await prisma.stockTransferTask.update({ where: { id: open.id }, data: { shortfallQty } });
        continue;
      }

      const stock = await getStockByMaterial(level.materialIds);
      const materialId = [...level.materialIds].sort((a, b) => stock.get(b).WAREHOUSE - stock.get(a).WAREHOUSE)[0];
      const task = await prisma.stockTransferTask.create({ data: { materialId, shortfallQty, orderId } });
      await notifyRoles(["WAREHOUSE"], {
        type: "LOW_STOCK",
        title: `${level.label} low in the factory`,
        message: `${level.label}: ${level.drums} drum(s) in the factory, minimum ${level.minDrums} — supply ${level.drumsNeeded} drum(s) and upload proof`,
        link: "/dashboard/warehouse/transfers",
        entityType: "StockTransferTask",
        entityId: task.id,
      });
    }
  } catch (err) {
    console.error("checkFactoryGlueLevels failed", err);
  }
}

/** Transfer tasks (open first, newest first) with live stock of each material. */
export async function listTransferTasks({ status } = {}) {
  const tasks = await prisma.stockTransferTask.findMany({
    where: status ? { status } : undefined,
    include: {
      material: { select: { id: true, name: true, code: true, barCode: true, unit: true, materialType: true } },
      order: { select: { id: true, orderNo: true } },
      completedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  const stock = await getStockByMaterial([...new Set(tasks.map((t) => t.materialId))]);
  const glueLevels = tasks.some((t) => t.material.materialType === "GLUE") ? await getFactoryGlueLevels() : [];
  return tasks.map((t) => ({
    ...t,
    isRoll: t.material.materialType === "PAPER_ROLL",
    stock: stock.get(t.materialId),
    // Glue tasks are drum top-ups: the type's live factory level, in drums.
    glueLevel: glueLevels.find((l) => l.materialIds.includes(t.materialId)) || null,
  }));
}

/**
 * Completes a task: moves stock warehouse → factory with photo proof. A paper
 * roll moves whole (all its warehouse metres); anything else moves the
 * quantity entered.
 */
export async function completeTransferTask({ taskId, quantity, proofUrls, userId }) {
  const proofs = Array.isArray(proofUrls) ? proofUrls.filter(Boolean) : [];
  if (proofs.length === 0) throw httpError("Upload a photo as proof of the transfer", 400);

  const task = await prisma.stockTransferTask.findUnique({
    where: { id: taskId },
    include: { material: true, order: { select: { orderNo: true } } },
  });
  if (!task) throw httpError("Transfer task not found", 404);
  if (task.status !== "OPEN") throw httpError("This transfer has already been completed", 409);

  const isRoll = task.material.materialType === "PAPER_ROLL";
  let qty;
  if (isRoll) {
    qty = await getMaterialStock(task.materialId, "WAREHOUSE");
    if (qty.lte(0)) throw httpError(`${task.material.name} has no metres left in the warehouse`, 409);
  } else {
    const n = Number(quantity);
    if (!Number.isFinite(n) || n <= 0) throw httpError("Enter the quantity moved to the factory", 400);
    qty = new Decimal(n);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const { transferId } = await transferStock(
      {
        materialId: task.materialId,
        from: "WAREHOUSE",
        to: "FACTORY",
        quantity: qty,
        referenceId: task.order?.orderNo || null,
        remarks: isRoll ? "Whole roll moved to cover factory shortfall" : "Moved to cover factory shortfall",
        createdById: userId || null,
      },
      tx,
    );
    return tx.stockTransferTask.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        transferredQty: qty,
        transferId,
        proofUrls: proofs,
        completedById: userId || null,
        completedAt: new Date(),
      },
    });
  });

  if (userId) {
    await writeAuditLog({
      userId,
      action: ACTIONS.STOCK_TRANSFERRED,
      model: "StockTransferTask",
      recordId: task.id,
      newValue: { materialId: task.materialId, quantity: Number(qty), from: "WAREHOUSE", to: "FACTORY", proofUrls: proofs },
    });
  }
  // Supplied less than the drum minimum needs -> a fresh task for the rest.
  if (task.material.materialType === "GLUE") await checkFactoryGlueLevels();
  return updated;
}
