import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { createProductionOrder } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

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
        bagSpec: true,
        stages: { select: { id: true, stageType: true, status: true, sequence: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders: serializeModel(orders) });
  } catch (error) {
    console.error("GET /api/production/orders error:", error);
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
    if (!body.customer || !body.bagSpecId || !body.plannedQty) {
      return NextResponse.json(
        { error: "customer, bagSpecId, and plannedQty are required" },
        { status: 400 },
      );
    }

    const order = await createProductionOrder(body);
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.PRODUCTION_ORDER_CREATED,
      model: "ProductionOrder",
      recordId: order.id,
      newValue: { orderNo: order.orderNo, customer: body.customer },
    });
    return NextResponse.json({ order: serializeModel(order) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/production/orders error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
