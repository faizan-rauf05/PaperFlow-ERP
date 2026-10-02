import { prisma } from "@/lib/prisma";

/**
 * Non-blocking write — a notification failure should never break the
 * business flow (order creation, approval, etc.) that triggered it.
 */
async function safeCreateMany(rows) {
  if (!rows.length) return;
  try {
    await prisma.notification.createMany({ data: rows });
  } catch (error) {
    console.error("Failed to write notification(s):", error);
  }
}

function buildRow(userId, { type, title, message, link, entityType, entityId }) {
  return {
    userId,
    type,
    title,
    message,
    link: link || null,
    entityType: entityType || null,
    entityId: entityId || null,
  };
}

/** Notify a single user (e.g. the sales rep who owns an order). */
export async function notifyUser(userId, payload) {
  if (!userId) return;
  await safeCreateMany([buildRow(userId, payload)]);
}

/** Fan out one notification row per active user in the given role(s). */
export async function notifyRoles(roles, payload) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, isActive: true },
    select: { id: true },
  });
  await safeCreateMany(users.map((u) => buildRow(u.id, payload)));
}

export async function getNotifications(userId, { unreadOnly = false, limit = 20 } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, read: false } });
}

/** Scoped to userId so a user can only mark their own notifications read. */
export async function markNotificationRead(id, userId) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true, readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true, readAt: new Date() },
  });
}
