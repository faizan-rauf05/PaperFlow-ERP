import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_EXPIRY_HOURS = 48;

export function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function getTokenExpiryDate() {
  return new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
}

export function getSetupPasswordLink(token) {
  const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${baseUrl}/setup-password?token=${token}`;
}

/**
 * @param {string} token
 */
export async function validateResetToken(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Token is required" };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record) {
    return { valid: false, reason: "Invalid token" };
  }

  if (record.usedAt) {
    return { valid: false, reason: "Token has already been used" };
  }

  if (record.expiresAt <= new Date()) {
    return { valid: false, reason: "Token has expired" };
  }

  if (!record.user?.isActive) {
    return { valid: false, reason: "User account is inactive" };
  }

  return {
    valid: true,
    record,
    userName: record.user.name,
  };
}

export async function invalidateUserTokens(userId) {
  await prisma.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });
}

export async function createPasswordResetToken(userId) {
  const token = generateResetToken();
  const record = await prisma.passwordResetToken.create({
    data: {
      token,
      userId,
      expiresAt: getTokenExpiryDate(),
    },
  });
  return record;
}
