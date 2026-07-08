import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const roll = await prisma.paperRoll.findUnique({
      where: { id },
      include: { material: true, transactions: { orderBy: { createdAt: "desc" }, take: 20 } },
    });

    if (!roll) return NextResponse.json({ error: "Roll not found" }, { status: 404 });
    return NextResponse.json({ roll: serializeModel(roll) });
  } catch (error) {
    console.error("GET /api/rolls/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();
    const data = {};
    if (body.storageLocation !== undefined) data.storageLocation = body.storageLocation;
    if (body.status) data.status = body.status;
    if (body.supplier !== undefined) data.supplier = body.supplier;
    if (body.receivedAt) data.receivedAt = new Date(body.receivedAt);

    const roll = await prisma.paperRoll.update({ where: { id }, data, include: { material: true } });
    return NextResponse.json({ roll: serializeModel(roll) });
  } catch (error) {
    console.error("PUT /api/rolls/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
