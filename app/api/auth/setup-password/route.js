import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { validateResetToken } from "@/lib/tokens";

export async function POST(request) {
  try {
    const body = await request.json();
    const token = body?.token;
    const password = body?.password;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const validation = await validateResetToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason || "Invalid token" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: validation.record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: validation.record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await writeAuditLog({
      userId: validation.record.userId,
      action: ACTIONS.PASSWORD_RESET_COMPLETED,
      model: "User",
      recordId: validation.record.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/setup-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
