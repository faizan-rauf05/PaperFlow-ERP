import { auth } from "@/lib/auth";

export async function getSession() {
  return auth();
}

export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    return { error: { status: 401, body: { error: "Unauthorized" } } };
  }

  if (session.user.role !== "ADMIN") {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }

  return { session };
}

export function sanitizeUser(user) {
  const { passwordHash, resetTokens, auditLogs, ...safe } = user;
  return safe;
}
