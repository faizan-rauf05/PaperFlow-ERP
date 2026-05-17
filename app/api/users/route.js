import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin, sanitizeUser } from "@/lib/apiAuth";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { sendPasswordSetupEmail } from "@/lib/email";
import {
  createPasswordResetToken,
  getSetupPasswordLink,
} from "@/lib/tokens";
import { isValidEmail, isValidRole } from "@/lib/validators";

function generateTempPassword() {
  return crypto.randomBytes(10).toString("base64url").slice(0, 20);
}

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const isActiveParam = searchParams.get("isActive");
    const search = searchParams.get("search")?.trim();

    const where = {};

    if (role) {
      if (!isValidRole(role)) {
        return NextResponse.json({ error: "Invalid role filter" }, { status: 400 });
      }
      where.role = role;
    }

    if (isActiveParam !== null && isActiveParam !== "") {
      if (isActiveParam !== "true" && isActiveParam !== "false") {
        return NextResponse.json(
          { error: "isActive must be true or false" },
          { status: 400 },
        );
      }
      where.isActive = isActiveParam === "true";
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const body = await request.json();
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const role = body?.role;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }

    if (!role || !isValidRole(role)) {
      return NextResponse.json(
        { error: "A valid role is required" },
        { status: 400 },
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email is already in use" },
        { status: 409 },
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        passwordHash,
      },
    });

    const tokenRecord = await createPasswordResetToken(user.id);
    const inviteLink = getSetupPasswordLink(tokenRecord.token);

    await sendPasswordSetupEmail({
      to: user.email,
      link: inviteLink,
      userName: user.name,
      type: "invite",
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.USER_CREATED,
      model: "User",
      recordId: user.id,
      newValue: { name, email, role },
    });

    return NextResponse.json(
      {
        user: sanitizeUser(user),
        inviteLink,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
