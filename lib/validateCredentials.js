import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

/**
 * @param {string} email
 * @param {string} password
 */
export async function validateCredentials(email, password) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (!user.isActive) {
    return { ok: false, reason: "inactive_account" };
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return { ok: false, reason: "invalid_credentials" };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}
