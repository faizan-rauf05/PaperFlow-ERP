import { prisma } from "@/lib/prisma";
import { ACTIONS } from "@/lib/audit-actions";

export { ACTIONS };

export async function writeAuditLog({
  userId,
  action,
  model,
  recordId,
  oldValue,
  newValue,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        model,
        recordId,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}

/** Several audit entries (writeAuditLog's shape) in one insert. */
export async function writeAuditLogs(entries) {
  if (!entries.length) return;
  try {
    await prisma.auditLog.createMany({
      data: entries.map(({ userId, action, model, recordId, oldValue, newValue }) => ({
        userId: userId ?? null,
        action,
        model,
        recordId,
        oldValue: oldValue ?? undefined,
        newValue: newValue ?? undefined,
      })),
    });
  } catch (error) {
    console.error("Failed to write audit logs:", error);
  }
}
