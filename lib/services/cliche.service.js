import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCodeSuffix } from "@/lib/material-code";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

const { Decimal } = Prisma;

function dec(v) {
  return v == null || v === "" ? null : new Decimal(v.toString());
}

/**
 * Search existing cliches by free-text (matches code) and/or customer, so a
 * repeat order can reuse one instead of re-entering the same details.
 */
export async function searchCliches({ query, customerId, take = 25 } = {}) {
  return prisma.cliche.findMany({
    where: {
      ...(customerId ? { customerId } : {}),
      ...(query
        ? {
            OR: [
              { code: { contains: query, mode: "insensitive" } },
              { customer: { name: { contains: query, mode: "insensitive" } } },
              { notes: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 200),
  });
}

export async function createCliche(data, createdById) {
  const code = `CLC-${createCodeSuffix()}`;

  const cliche = await prisma.cliche.create({
    data: {
      code,
      widthMm: dec(data.widthMm),
      heightMm: dec(data.heightMm),
      colorCount: data.colorCount != null ? Number(data.colorCount) : null,
      ownership: data.ownership,
      source: data.source,
      condition: data.condition || "ACTIVE",
      customerId: data.customerId || null,
      storageLocation: data.storageLocation?.trim() || null,
      cost: dec(data.cost),
      photoUrl: data.photoUrl || null,
      notes: data.notes?.trim() || null,
    },
    include: { customer: { select: { id: true, name: true } } },
  });

  if (createdById) {
    await writeAuditLog({
      userId: createdById,
      action: ACTIONS.CLICHE_CREATED,
      model: "Cliche",
      recordId: cliche.id,
      newValue: { code: cliche.code, ownership: cliche.ownership, source: cliche.source },
    });
  }

  return cliche;
}

/**
 * Attach a cliche to an order line — either an existing one by id, or inline
 * data for a brand-new one (e.g. just purchased for this order).
 */
export async function assignClicheToOrderLine(orderLineId, { clicheId, newCliche }, actingUserId) {
  const orderLine = await prisma.orderLine.findUnique({ where: { id: orderLineId } });
  if (!orderLine) throw new Error("Order line not found");

  let targetClicheId = clicheId || null;
  if (!targetClicheId && newCliche) {
    const created = await createCliche(newCliche, actingUserId);
    targetClicheId = created.id;
  }
  if (!targetClicheId) throw new Error("Provide either clicheId or newCliche data");

  const updated = await prisma.orderLine.update({
    where: { id: orderLineId },
    data: { clicheId: targetClicheId },
    include: { cliche: true },
  });

  if (actingUserId) {
    await writeAuditLog({
      userId: actingUserId,
      action: ACTIONS.CLICHE_ASSIGNED,
      model: "OrderLine",
      recordId: orderLineId,
      newValue: { clicheId: targetClicheId },
    });
  }

  return updated;
}
