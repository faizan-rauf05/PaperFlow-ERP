import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { sendPasswordSetupEmail } from "@/lib/email";
import {
  createPasswordResetToken,
  getSetupPasswordLink,
  invalidateUserTokens,
} from "@/lib/tokens";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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
      userId: authResult.session.user.id,
      action: ACTIONS.PASSWORD_RESET_REQUESTED,
      model: "User",
      recordId: user.id,
    });

    return NextResponse.json({ success: true, resetLink });
  } catch (error) {
    console.error("POST /api/users/[id]/reset-password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
