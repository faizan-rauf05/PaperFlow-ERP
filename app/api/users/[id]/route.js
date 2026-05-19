import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, sanitizeUser } from "@/lib/apiAuth";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { isValidRole } from "@/lib/validators";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = {};

    if (body.name !== undefined) {
      const name = body.name?.trim();
      if (!name) {
        return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
      }
      data.name = name;
    }

    if (body.role !== undefined) {
      if (!isValidRole(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      data.role = body.role;
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json(
          { error: "isActive must be a boolean" },
          { status: 400 },
        );
      }
      data.isActive = body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    const actorId = authResult.session.user.id;

    if (data.role !== undefined && data.role !== existing.role) {
      await writeAuditLog({
        userId: actorId,
        action: ACTIONS.ROLE_CHANGED,
        model: "User",
        recordId: id,
        oldValue: { role: existing.role },
        newValue: { role: data.role },
      });
    }

    if (data.isActive !== undefined && data.isActive !== existing.isActive) {
      await writeAuditLog({
        userId: actorId,
        action: data.isActive ? ACTIONS.USER_ACTIVATED : ACTIONS.USER_DEACTIVATED,
        model: "User",
        recordId: id,
        oldValue: { isActive: existing.isActive },
        newValue: { isActive: data.isActive },
      });
    }

    await writeAuditLog({
      userId: actorId,
      action: ACTIONS.USER_UPDATED,
      model: "User",
      recordId: id,
      oldValue: {
        name: existing.name,
        role: existing.role,
        isActive: existing.isActive,
      },
      newValue: data,
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PUT /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const existing = await prisma.user.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (id === authResult.session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    await prisma.user.delete({ where: { id } });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.USER_DELETED,
      model: "User",
      recordId: id,
      oldValue: {
        name: existing.name,
        email: existing.email,
        role: existing.role,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
