import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { buildMaterialRecord } from "@/lib/material-code";
import { materialSchema } from "@/lib/validations/admin-forms";

export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const materials = await prisma.material.findMany({ orderBy: [{ materialType: "asc" }, { name: "asc" }] });
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
    const parsed = materialSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Invalid material data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = buildMaterialRecord(parsed.data);
    const material = await prisma.material.create({ data });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_CREATED,
      model: "Material",
      recordId: material.id,
      newValue: { code: material.code, name: material.name, materialType: material.materialType },
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
