import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager, requireWorker } from "@/lib/apiAuth";
import { registerRoll } from "@/lib/services/inventory.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function GET(request) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();

    const where = {};
    if (searchParams.get("selectable") === "true") {
      where.status = { in: ["AVAILABLE", "IN_USE"] };
    } else if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { rollNo: { contains: search, mode: "insensitive" } },
        { batchLot: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    const barcode = searchParams.get("barcode")?.trim();
    if (barcode) {
      where.barcode = barcode;
    }

    const rolls = await prisma.paperRoll.findMany({
      where,
      include: { material: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rolls: serializeModel(rolls) });
  } catch (error) {
    console.error("GET /api/rolls error:", error);
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
    if (!body.rollNo || !body.materialId || !body.weightKg || !body.lengthM) {
      return NextResponse.json(
        { error: "rollNo, materialId, weightKg, and lengthM are required" },
        { status: 400 },
      );
    }

    const roll = await registerRoll(body, authResult.session.user.id);
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.ROLL_CREATED,
      model: "PaperRoll",
      recordId: roll.id,
      newValue: { rollNo: roll.rollNo, materialId: roll.materialId },
    });
    return NextResponse.json({ roll: serializeModel(roll) }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Roll number already exists" }, { status: 409 });
    }
    console.error("POST /api/rolls error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
