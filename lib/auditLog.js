import { prisma } from "@/lib/prisma";

export const ACTIONS = {
  USER_LOGIN: "USER_LOGIN",
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_ACTIVATED: "USER_ACTIVATED",
  ROLE_CHANGED: "ROLE_CHANGED",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",
  USER_DELETED: "USER_DELETED",
};

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
