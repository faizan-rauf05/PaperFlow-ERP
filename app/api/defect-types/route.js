import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorker } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET(request) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const stageType = searchParams.get("stageType");

    const where = stageType ? { stageType } : {};
    const defectTypes = await prisma.defectType.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { name: "asc" } }, { code: "asc" }],
    });

    return NextResponse.json({ defectTypes: serializeModel(defectTypes) });
  } catch (error) {
    console.error("GET /api/defect-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    if (!body.stageType || !body.code || !body.description) {
      return NextResponse.json({ error: "stageType, code, and description are required" }, { status: 400 });
    }

    const defectType = await prisma.defectType.create({
      data: {
        stageType: body.stageType,
        code: body.code.toUpperCase(),
        description: body.description,
        categoryId: body.categoryId || null,
      },
      include: { category: true },
    });
    return NextResponse.json({ defectType: serializeModel(defectType) }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Defect type already exists for this stage" }, { status: 409 });
    }
    console.error("POST /api/defect-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { id, ...data } = body;
    const defectType = await prisma.defectType.update({
      where: { id },
      data: {
        description: data.description,
        categoryId: data.categoryId ?? undefined,
      },
      include: { category: true },
    });
    return NextResponse.json({ defectType: serializeModel(defectType) });
  } catch (error) {
    console.error("PUT /api/defect-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    await prisma.defectType.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/defect-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
