import { auth } from "@/lib/auth";

export async function getSession() {
  return auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return { error: { status: 401, body: { error: "Unauthorized" } } };
  }
  return { session };
}

export async function requireAdmin() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;
  if (authResult.session.user.role !== "ADMIN") {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }
  return authResult;
}

export async function requireManager() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;
  const role = authResult.session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }
  return authResult;
}

export async function requireWorker() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult;
  const role = authResult.session.user.role;
  if (!["WORKER", "MANAGER", "ADMIN"].includes(role)) {
    return { error: { status: 403, body: { error: "Forbidden" } } };
  }
  return authResult;
}

export async function requireAdminOrManager() {
  return requireManager();
}

export function sanitizeUser(user) {
  const { passwordHash, resetTokens, auditLogs, ...safe } = user;
  return safe;
}

export function jsonError(authResult) {
  return authResult.error;
}
