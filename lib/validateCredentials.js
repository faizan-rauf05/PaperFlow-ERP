import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

/**
 * @param {string} email
 * @param {string} password
 */
export async function validateCredentials(email, password) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return { ok: false };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isActive) {
    return { ok: false };
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return { ok: false };
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
