import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";

export async function GET(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const where = status ? { status } : {};

    const orders = await prisma.productionOrder.findMany({
      where,
      include: {
        customer: true,
        assignedWorker: { select: { id: true, name: true, email: true } },
        lines: {
          include: {
            stages: { select: { id: true, stageType: true, status: true, sequence: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders: serializeModel(orders) });
  } catch (error) {
    console.error("GET /api/production/orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "This creation path is retired — orders are created via POST /api/orders (Sales → Approval → Customer Approval → Send to Production).",
    },
    { status: 410 },
  );
}
