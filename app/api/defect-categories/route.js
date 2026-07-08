import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const categories = await prisma.defectCategory.findMany({
      include: { defectTypes: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ categories: serializeModel(categories) });
  } catch (error) {
    console.error("GET /api/defect-categories error:", error);
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
    if (!body.code || !body.name) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

    const category = await prisma.defectCategory.create({
      data: { code: body.code.toUpperCase(), name: body.name },
    });
    return NextResponse.json({ category: serializeModel(category) }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Category code already exists" }, { status: 409 });
    }
    console.error("POST /api/defect-categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
