import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { computeBagsPerMeter } from "@/lib/services/unit-conversion.service";
import { serializeModel } from "@/lib/serialize";

function enrichBagSpecData(body) {
  const data = { ...body };
  if (data.bagWidthMm && data.repeatLengthMm && !data.bagsPerMeter) {
    const computed = computeBagsPerMeter({
      bagWidthMm: data.bagWidthMm,
      repeatLengthMm: data.repeatLengthMm,
    });
    if (computed) data.bagsPerMeter = computed.toNumber();
  }
  return data;
}

export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const specs = await prisma.bagSpecification.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ specs: serializeModel(specs) });
  } catch (error) {
    console.error("GET /api/bag-specs error:", error);
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
    if (!body.name || !body.code) {
      return NextResponse.json({ error: "name and code are required" }, { status: 400 });
    }

    const spec = await prisma.bagSpecification.create({ data: enrichBagSpecData(body) });
    return NextResponse.json({ spec: serializeModel(spec) }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Bag spec code already exists" }, { status: 409 });
    }
    console.error("POST /api/bag-specs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { id, ...rest } = body;
    const spec = await prisma.bagSpecification.update({
      where: { id },
      data: enrichBagSpecData(rest),
    });
    return NextResponse.json({ spec: serializeModel(spec) });
  } catch (error) {
    console.error("PUT /api/bag-specs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
