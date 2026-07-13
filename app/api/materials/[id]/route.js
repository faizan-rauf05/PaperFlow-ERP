import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { buildMaterialRecord } from "@/lib/material-code";
import { materialSchema } from "@/lib/validations/admin-forms";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = materialSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Invalid material data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = buildMaterialRecord(parsed.data);
    const material = await prisma.material.update({ where: { id }, data });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_UPDATED,
      model: "Material",
      recordId: id,
      newValue: { code: material.code, name: material.name, materialType: material.materialType },
    });

    return NextResponse.json({ material: serializeModel(material) });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Material code already exists" }, { status: 409 });
    }
    console.error("PUT /api/materials/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const existing = await prisma.material.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 },
      );
    }

    const count = await prisma.inventoryTransaction.count({
      where: {
        materialId: id,
      },
    });

    if (count > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete material because it has inventory transactions.",
        },
        { status: 400 },
      );
    }

    await prisma.material.delete({ where: { id } });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_DELETED,
      model: "Material",
      recordId: id,
      oldValue: existing ? { code: existing.code, name: existing.name } : null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/materials/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
