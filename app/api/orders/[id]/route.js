import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { getOrderDetails, updateSalesOrder } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const order = await getOrderDetails(id);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();
    const userId = authResult.session.user.id;

    const order = await updateSalesOrder(id, body, userId);
    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("PUT /api/orders/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update order" },
      { status: 400 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const existing = await prisma.productionOrder.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!["DRAFT", "CANCELLED", "REJECTED"].includes(existing.status)) {
      return NextResponse.json(
        { error: `Cannot delete order in status ${existing.status}` },
        { status: 400 },
      );
    }

    await prisma.productionOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
