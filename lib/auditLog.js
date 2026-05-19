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
