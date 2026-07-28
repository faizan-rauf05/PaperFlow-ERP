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

export async function POST(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    if (!body.customerId || !body.assignedWorkerId || !Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json(
        { error: "customerId, assignedWorkerId, and at least one line are required" },
        { status: 400 },
      );
    }

    const order = await createProductionOrder({
      customerId: body.customerId,
      salesRep: body.salesRep,
      assignedWorkerId: body.assignedWorkerId,
      notes: body.notes,
      lines: body.lines,
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.PRODUCTION_ORDER_CREATED,
      model: "ProductionOrder",
      recordId: order.id,
      newValue: {
        orderNo: order.orderNo,
        customerId: body.customerId,
        assignedWorkerId: body.assignedWorkerId,
        lines: body.lines.length,
      },
    });

    return NextResponse.json({ order: serializeModel(order) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/production/orders error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
