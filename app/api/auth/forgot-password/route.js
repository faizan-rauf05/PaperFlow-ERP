import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { sendPasswordSetupEmail } from "@/lib/email";
import {
  createPasswordResetToken,
  getSetupPasswordLink,
  invalidateUserTokens,
} from "@/lib/tokens";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body?.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user?.isActive) {
      await invalidateUserTokens(user.id);
      const tokenRecord = await createPasswordResetToken(user.id);
      const resetLink = getSetupPasswordLink(tokenRecord.token);

      await sendPasswordSetupEmail({
        to: user.email,
        link: resetLink,
        userName: user.name,
        type: "reset",
      });

      await writeAuditLog({
        userId: user.id,
        action: ACTIONS.PASSWORD_RESET_REQUESTED,
        model: "User",
        recordId: user.id,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/forgot-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
