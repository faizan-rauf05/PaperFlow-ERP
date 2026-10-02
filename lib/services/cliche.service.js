import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createCodeSuffix } from "@/lib/material-catalog";
import { ACTIONS, writeAuditLogs } from "@/lib/auditLog";
import { lineNeedsCliche } from "@/lib/order-labels";

const { Decimal } = Prisma;

function dec(v) {
  return v == null || v === "" ? null : new Decimal(v.toString());
}

/**
 * Search existing cliches by free-text (matches code) and/or customer, so a
 * repeat order can reuse one instead of re-entering the same details.
 * `includeShared` also returns cliches not tied to any customer, and
 * `activeOnly` leaves out damaged/retired ones — both for the order form's picker.
 */
export async function searchCliches({ query, customerId, includeShared = false, activeOnly = false, take = 25 } = {}) {
  const and = [];
  if (customerId) {
    and.push(includeShared ? { OR: [{ customerId }, { customerId: null }] } : { customerId });
  }
  if (activeOnly) and.push({ condition: "ACTIVE" });
  if (query) {
    and.push({
      OR: [
        { code: { contains: query, mode: "insensitive" } },
        { customer: { name: { contains: query, mode: "insensitive" } } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  return prisma.cliche.findMany({
    where: { AND: and },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(take, 200),
  });
}

function newClicheCode() {
  return `CLC-${createCodeSuffix()}`;
}

/**
 * `count` distinct codes for cliches created together — the code is a
 * millisecond timestamp (createCodeSuffix's format), so each takes the next one.
 */
function newClicheCodes(count) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => `CLC-T${(now + i).toString(36).toUpperCase()}`);
}

export async function createCliche(data, createdById) {
  const cliche = await prisma.cliche.create({
    data: {
      code: newClicheCode(),
      widthCm: dec(data.widthCm),
      heightCm: dec(data.heightCm),
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

  if (createdById) await logClichesCreated([cliche], createdById);
  return cliche;
}

/** Audit entries for newly created cliches, for writeAuditLogs. */
export function clicheCreatedLogs(cliches, userId) {
  return cliches.map((cliche) => ({
    userId,
    action: ACTIONS.CLICHE_CREATED,
    model: "Cliche",
    recordId: cliche.id,
    newValue: { code: cliche.code, ownership: cliche.ownership, source: cliche.source },
  }));
}

export async function logClichesCreated(cliches, userId) {
  await writeAuditLogs(clicheCreatedLogs(cliches, userId));
}

/** A new cliche's fields from an order-form line (salesOrderSchema output). */
function clicheFieldsFromLine(line, customerId) {
  const source = line.clicheSource;
  return {
    heightCm: dec(line.clicheHeightCm),
    widthCm: dec(line.clicheWidthCm),
    colorCount: line.clicheColorCount != null ? Number(line.clicheColorCount) : Number(line.colorCount) || null,
    source,
    // A customer-supplied plate is theirs; otherwise as chosen (company by default).
    ownership: source === "CUSTOMER_SUPPLIED" ? "CUSTOMER_OWNED" : line.clicheOwnership || "COMPANY_OWNED",
    // Only a purchase has a cost to the company (and so to the customer).
    cost: source === "PURCHASED_NEW" ? dec(line.clicheCost) : null,
    notes: line.clicheNotes?.trim() || null,
    customerId: customerId || null,
  };
}

/**
 * Checks each order-form line's cliche choice before anything is written and
 * returns one plan per line: none (plain line or left open on a draft), an
 * existing cliche to reuse, or a new one to create — or to update, when it
 * was added by this same order on an earlier save (`orderId` when editing).
 */
export async function planOrderLineCliches(lines, { customerId, orderId = null }) {
  const existingIds = lines
    .filter((l) => lineNeedsCliche(l) && l.clicheMode === "EXISTING" && l.clicheId)
    .map((l) => l.clicheId);
  const ownIds = lines
    .filter((l) => lineNeedsCliche(l) && l.clicheMode === "NEW" && l.clicheId)
    .map((l) => l.clicheId);

  const found = await prisma.cliche.findMany({
    where: { id: { in: [...existingIds, ...ownIds] } },
    select: { id: true, customerId: true, condition: true, originOrderId: true },
  });
  const byId = new Map(found.map((c) => [c.id, c]));

  return lines.map((line, i) => {
    const lineNo = i + 1;
    if (!lineNeedsCliche(line) || !line.clicheMode) return { mode: "NONE" };

    if (line.clicheMode === "EXISTING") {
      if (!line.clicheId) return { mode: "NONE" };
      const cliche = byId.get(line.clicheId);
      if (!cliche) throw new Error(`Line ${lineNo}: the selected cliché no longer exists`);
      if (cliche.condition !== "ACTIVE") {
        throw new Error(`Line ${lineNo}: the selected cliché is marked ${cliche.condition.toLowerCase()}`);
      }
      if (cliche.customerId && cliche.customerId !== customerId) {
        throw new Error(`Line ${lineNo}: the selected cliché belongs to another customer`);
      }
      return { mode: "EXISTING", clicheId: cliche.id };
    }

    const own = line.clicheId ? byId.get(line.clicheId) : null;
    if (line.clicheId && (!own || !orderId || own.originOrderId !== orderId)) {
      throw new Error(`Line ${lineNo}: this cliché wasn't added by this order and can't be edited here`);
    }
    return { mode: "NEW", clicheId: own?.id ?? null, data: clicheFieldsFromLine(line, customerId) };
  });
}

/**
 * Writes the planned cliches inside the order's transaction — creates new
 * ones (tagged with the order that added them, in one insert) and updates
 * the order's own earlier ones. Returns the cliche id per line (null where
 * none) and the newly created cliches, for audit logging after commit.
 */
export async function writeOrderLineCliches(plans, orderId, tx) {
  const fresh = newClicheCodes(plans.length);
  const codes = plans.map((plan, i) => (plan.mode === "NEW" && !plan.clicheId ? fresh[i] : null));
  const toCreate = plans.flatMap((plan, i) => (codes[i] ? [{ ...plan.data, code: codes[i], originOrderId: orderId }] : []));
  const created = toCreate.length ? await tx.cliche.createManyAndReturn({ data: toCreate }) : [];
  const createdIdByCode = new Map(created.map((c) => [c.code, c.id]));

  const clicheIds = [];
  for (const [i, plan] of plans.entries()) {
    if (plan.mode === "NONE") {
      clicheIds.push(null);
    } else if (codes[i]) {
      clicheIds.push(createdIdByCode.get(codes[i]));
    } else {
      if (plan.mode === "NEW") await tx.cliche.update({ where: { id: plan.clicheId }, data: plan.data });
      clicheIds.push(plan.clicheId);
    }
  }
  return { clicheIds, created };
}

/**
 * Removes cliches this order added that no order line uses any more — e.g.
 * a planned purchase dropped from the proposal. A cliche another order has
 * since reused is kept.
 */
export async function deleteUnusedOrderCliches(orderId, tx) {
  await tx.cliche.deleteMany({ where: { originOrderId: orderId, orderLines: { none: {} } } });
}
