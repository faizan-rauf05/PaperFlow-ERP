import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ materials: serializeModel(materials) });
  } catch (error) {
    console.error("GET /api/materials error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    const name = body?.name?.trim();
    const code = body?.code?.trim().toUpperCase();
    const unit = body?.unit;
    const minimumStock = body?.minimumStock ?? 0;
    const kgPerMeter = body?.kgPerMeter ?? null;

    if (!name || !code || !unit) {
      return NextResponse.json({ error: "name, code, and unit are required" }, { status: 400 });
    }

    const material = await prisma.material.create({
      data: { name, code, unit, minimumStock, kgPerMeter },
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_CREATED,
      model: "Material",
      recordId: material.id,
      newValue: { code, name, unit },
    });

    return NextResponse.json({ material: serializeModel(material) }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Material code already exists" }, { status: 409 });
    }
    console.error("POST /api/materials error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
