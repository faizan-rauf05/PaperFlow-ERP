import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();
    const data = {};
    if (body.name) data.name = body.name.trim();
    if (body.code) data.code = body.code.trim().toUpperCase();
    if (body.unit) data.unit = body.unit;
    if (body.minimumStock !== undefined) data.minimumStock = body.minimumStock;
    if (body.kgPerMeter !== undefined) data.kgPerMeter = body.kgPerMeter;

    const material = await prisma.material.update({ where: { id }, data });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_UPDATED,
      model: "Material",
      recordId: id,
      newValue: data,
    });
    return NextResponse.json({ material: serializeModel(material) });
  } catch (error) {
    console.error("PUT /api/materials/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const existing = await prisma.material.findUnique({ where: { id } });
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
