import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

const { Decimal } = Prisma;

function dec(v) {
  if (v == null || v === "") return new Decimal(0);
  return new Decimal(v.toString());
}

/**
 * Generates sequential order number PO-YYYY-XXXX
 */
export async function generateOrderNo() {
  const count = await prisma.productionOrder.count();
  const year = new Date().getFullYear();
  return `PO-${year}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Fetch active Sales Rep users for dropdown selector
 */
export async function getSalesRepresentatives() {
  return prisma.user.findMany({
    where: {
      role: "SALES",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Formats order line data cleanly for DB creation/updates
 */
export function formatOrderLineData(line, index) {
  const qty = dec(line.quantity || line.plannedQty || 1);
  const lineTotal = line.lineTotal != null ? dec(line.lineTotal) : null;

  // Auto calculate unit price if line total is provided and unit price is missing
  let unitPrice = line.unitPrice != null ? dec(line.unitPrice) : null;
  if (!unitPrice && lineTotal && qty.gt(0)) {
    unitPrice = lineTotal.div(qty);
  }

  // Dimensions in cm
  const widthCm = line.widthCm != null ? dec(line.widthCm) : null;
  const heightCm = line.heightCm != null ? dec(line.heightCm) : null;
  const baseCm = line.baseCm != null ? dec(line.baseCm) : null;

  // Convert to mm for backward compatibility with existing production stage math if present
  const widthMm = widthCm ? widthCm.mul(10) : line.widthMm != null ? dec(line.widthMm) : null;
  const heightMm = heightCm ? heightCm.mul(10) : line.heightMm != null ? dec(line.heightMm) : null;
  const baseMm = baseCm ? baseCm.mul(10) : line.baseMm != null ? dec(line.baseMm) : null;

  // Parse reference files (array of up to 5 uploaded file objects or string URLs)
  let referenceFiles = null;
  if (Array.isArray(line.referenceFiles)) {
    referenceFiles = line.referenceFiles.slice(0, 5);
  } else if (typeof line.referenceFiles === "string") {
    try {
      const parsed = JSON.parse(line.referenceFiles);
      if (Array.isArray(parsed)) referenceFiles = parsed.slice(0, 5);
    } catch {
      referenceFiles = [{ url: line.referenceFiles, name: line.fileName || "Reference File" }];
    }
  }

  return {
    lineNo: index + 1,
    widthCm,
    heightCm,
    baseCm,
    widthMm,
    heightMm,
    baseMm,
    quantity: qty,
    plannedQty: qty,
    withHandle: Boolean(line.withHandle),
    paperType: line.paperType || "VIRGIN",
    paperColor: line.paperColor || "WHITE",
    colorCount: parseInt(line.colorCount || 0, 10),
    referenceFiles,
    unitPrice,
    lineTotal,
    fileUrl: line.fileUrl || (Array.isArray(referenceFiles) && referenceFiles[0]?.url) || null,
    fileName: line.fileName || (Array.isArray(referenceFiles) && referenceFiles[0]?.name) || null,
  };
}

/**
 * Creates a new Order in DRAFT or PENDING_APPROVAL status.
 */
export async function createSalesOrder({
  customerId,
  salesRepId,
  priority = "NORMAL",
  deliveryDate,
  notes,
  subtotal,
  discount = 0,
  total,
  proposedTotal,
  lines = [],
  status = "PENDING_APPROVAL", // "DRAFT" or "PENDING_APPROVAL"
  createdById,
}) {
  if (!customerId) throw new Error("Customer is required");
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("At least one order line is required");
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error("Customer not found");

  let salesRepUser = null;
  if (salesRepId) {
    salesRepUser = await prisma.user.findFirst({
      where: { id: salesRepId, role: "SALES", isActive: true },
    });
  }

  const orderNo = await generateOrderNo();
  const subTotalDec = dec(subtotal || 0);
  const discountDec = dec(discount || 0);
  const totalDec = total != null ? dec(total) : subTotalDec.sub(discountDec);
  const proposedTotalDec = proposedTotal != null ? dec(proposedTotal) : totalDec;

  const targetStatus = ["DRAFT", "PENDING_APPROVAL"].includes(status)
    ? status
    : "PENDING_APPROVAL";

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.create({
      data: {
        orderNo,
        customerId,
        salesRepId: salesRepUser?.id || salesRepId || null,
        salesRep: salesRepUser?.name || null,
        priority: priority || "NORMAL",
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        notes: notes?.trim() || null,
        status: targetStatus,
        subtotal: subTotalDec,
        discount: discountDec,
        total: totalDec,
        proposedTotal: proposedTotalDec,
        approvedTotal: null,
      },
    });

    for (let i = 0; i < lines.length; i++) {
      const formattedLine = formatOrderLineData(lines[i], i);
      await tx.orderLine.create({
        data: {
          orderId: order.id,
          ...formattedLine,
        },
      });
    }

    // If order submitted for approval, create initial OrderApproval history entry
    if (targetStatus === "PENDING_APPROVAL") {
      await tx.orderApproval.create({
        data: {
          orderId: order.id,
          requestedById: createdById || null,
          status: "PENDING",
          proposedTotal: proposedTotalDec,
          remarks: "Initial order submission for manager approval",
        },
      });
    }

    if (createdById) {
      await writeAuditLog({
        userId: createdById,
        action: ACTIONS.PRODUCTION_ORDER_CREATED || "ORDER_CREATED",
        model: "ProductionOrder",
        recordId: order.id,
        newValue: {
          orderNo: order.orderNo,
          status: targetStatus,
          proposedTotal: Number(proposedTotalDec),
          linesCount: lines.length,
        },
      });
    }

    return getOrderDetails(order.id, tx);
  });
}

/**
 * Updates an order. If edited after approval/ready status, resets to PENDING_APPROVAL.
 */
export async function updateSalesOrder(orderId, data, userId) {
  const existingOrder = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: { lines: true, approvals: true },
  });

  if (!existingOrder) throw new Error("Order not found");

  const isApprovedOrReady = ["APPROVED", "READY_FOR_WORK", "PICKED", "IN_PROGRESS"].includes(
    existingOrder.status,
  );

  let newStatus = data.status || existingOrder.status;
  // If materially editing an already approved order, reset to PENDING_APPROVAL
  if (isApprovedOrReady && data.lines) {
    newStatus = "PENDING_APPROVAL";
  }

  const subTotalDec = data.subtotal != null ? dec(data.subtotal) : existingOrder.subtotal;
  const discountDec = data.discount != null ? dec(data.discount) : existingOrder.discount;
  const totalDec = data.total != null ? dec(data.total) : (subTotalDec ? subTotalDec.sub(discountDec) : existingOrder.total);
  const proposedTotalDec = data.proposedTotal != null ? dec(data.proposedTotal) : totalDec;

  return prisma.$transaction(async (tx) => {
    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        customerId: data.customerId || existingOrder.customerId,
        salesRepId: data.salesRepId !== undefined ? data.salesRepId : existingOrder.salesRepId,
        priority: data.priority || existingOrder.priority,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : existingOrder.deliveryDate,
        notes: data.notes !== undefined ? data.notes : existingOrder.notes,
        status: newStatus,
        subtotal: subTotalDec,
        discount: discountDec,
        total: totalDec,
        proposedTotal: proposedTotalDec,
      },
    });

    if (Array.isArray(data.lines)) {
      // Replace lines
      await tx.orderLine.deleteMany({ where: { orderId } });
      for (let i = 0; i < data.lines.length; i++) {
        const formattedLine = formatOrderLineData(data.lines[i], i);
        await tx.orderLine.create({
          data: {
            orderId,
            ...formattedLine,
          },
        });
      }
    }

    // Create new approval history record if submitted or reset to PENDING_APPROVAL
    if (newStatus === "PENDING_APPROVAL") {
      await tx.orderApproval.create({
        data: {
          orderId,
          requestedById: userId || null,
          status: "PENDING",
          proposedTotal: proposedTotalDec,
          remarks: isApprovedOrReady
            ? "Order edited after approval; re-submitted for manager review"
            : "Order revised & submitted for approval",
        },
      });
    }

    if (userId) {
      await writeAuditLog({
        userId,
        action: "ORDER_UPDATED",
        model: "ProductionOrder",
        recordId: orderId,
        oldValue: { status: existingOrder.status, total: Number(existingOrder.total || 0) },
        newValue: { status: newStatus, total: Number(totalDec || 0) },
      });
    }

    return getOrderDetails(orderId, tx);
  });
}

/**
 * Manager approves or rejects an order.
 */
export async function reviewOrderApproval({
  orderId,
  action, // "APPROVE" | "REJECT"
  approvedTotal,
  remarks,
  reviewedById,
}) {
  const order = await prisma.productionOrder.findUnique({
    where: { id: orderId },
    include: { approvals: { orderBy: { createdAt: "desc" } } },
  });

  if (!order) throw new Error("Order not found");
  if (order.status !== "PENDING_APPROVAL" && order.status !== "DRAFT" && order.status !== "REJECTED") {
    throw new Error(`Order cannot be reviewed in current status: ${order.status}`);
  }

  const latestApproval = order.approvals[0];
  const isApprove = action === "APPROVE";
  const nextStatus = isApprove ? "READY_FOR_WORK" : "REJECTED";
  const approvedTotalDec = isApprove
    ? approvedTotal != null
      ? dec(approvedTotal)
      : order.proposedTotal || order.total
    : null;

  return prisma.$transaction(async (tx) => {
    // Update or create order approval record
    if (latestApproval && latestApproval.status === "PENDING") {
      await tx.orderApproval.update({
        where: { id: latestApproval.id },
        data: {
          reviewedById: reviewedById || null,
          status: isApprove ? "APPROVED" : "REJECTED",
          approvedTotal: approvedTotalDec,
          remarks: remarks?.trim() || (isApprove ? "Approved by manager" : "Rejected by manager"),
          reviewedAt: new Date(),
        },
      });
    } else {
      await tx.orderApproval.create({
        data: {
          orderId,
          requestedById: order.salesRepId || null,
          reviewedById: reviewedById || null,
          status: isApprove ? "APPROVED" : "REJECTED",
          proposedTotal: order.proposedTotal || order.total,
          approvedTotal: approvedTotalDec,
          remarks: remarks?.trim() || (isApprove ? "Approved by manager" : "Rejected by manager"),
          reviewedAt: new Date(),
        },
      });
    }

    // Update ProductionOrder status
    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        approvedTotal: approvedTotalDec,
      },
    });

    if (reviewedById) {
      await writeAuditLog({
        userId: reviewedById,
        action: isApprove ? "ORDER_APPROVED" : "ORDER_REJECTED",
        model: "ProductionOrder",
        recordId: orderId,
        newValue: {
          status: nextStatus,
          approvedTotal: approvedTotalDec ? Number(approvedTotalDec) : null,
          remarks,
        },
      });
    }

    return getOrderDetails(orderId, tx);
  });
}

/**
 * Worker picks an available order safely with atomic locking/transaction.
 */
export async function pickWorkerOrder(orderId, workerId) {
  const worker = await prisma.user.findFirst({
    where: { id: workerId, role: "WORKER", isActive: true },
  });
  if (!worker) throw new Error("Worker not found or inactive");

  return prisma.$transaction(async (tx) => {
    const order = await tx.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        assignments: {
          where: { status: { in: ["PICKED", "IN_PROGRESS"] } },
        },
      },
    });

    if (!order) throw new Error("Order not found");

    // Prevent double picking
    if (order.status !== "READY_FOR_WORK" && order.status !== "APPROVED") {
      throw new Error(`Order is not available for picking (Status: ${order.status})`);
    }

    if (order.assignments.length > 0 || order.assignedWorkerId) {
      throw new Error("Order has already been picked or assigned to another worker");
    }

    const now = new Date();

    // Create OrderAssignment record with timestamp
    const assignment = await tx.orderAssignment.create({
      data: {
        orderId,
        workerId,
        status: "IN_PROGRESS",
        assignedAt: now,
        startedAt: now,
      },
    });

    // Update order status to IN_PROGRESS and set assigned worker
    await tx.productionOrder.update({
      where: { id: orderId },
      data: {
        status: "IN_PROGRESS",
        assignedWorkerId: workerId,
        startDate: order.startDate || now,
      },
    });

    await writeAuditLog({
      userId: workerId,
      action: "ORDER_PICKED",
      model: "ProductionOrder",
      recordId: orderId,
      newValue: {
        workerId,
        workerName: worker.name,
        assignedAt: now,
      },
    });

    return getOrderDetails(orderId, tx);
  });
}

/**
 * Fetch full order details including relations, approval history & assignments
 */
export async function getOrderDetails(orderId, db = prisma) {
  return db.productionOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      salesRepUser: { select: { id: true, name: true, email: true } },
      assignedWorker: { select: { id: true, name: true, email: true } },
      lines: {
        orderBy: { lineNo: "asc" },
      },
      approvals: {
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      },
      assignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          worker: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

/**
 * Fetch available orders for worker dashboard (READY_FOR_WORK / APPROVED)
 */
export async function getAvailableWorkerOrders() {
  return prisma.productionOrder.findMany({
    where: {
      status: { in: ["READY_FOR_WORK", "APPROVED"] },
      assignedWorkerId: null,
    },
    include: {
      customer: true,
      salesRepUser: { select: { id: true, name: true } },
      lines: {
        orderBy: { lineNo: "asc" },
      },
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "asc" },
    ],
  });
}
