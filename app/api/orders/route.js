import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/apiAuth";
import { createSalesOrder } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function GET(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const salesRepId = searchParams.get("salesRepId");

    const where = {};
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (salesRepId) where.salesRepId = salesRepId;

    // If logged in user is SALES role, optionally limit or include their orders unless admin/manager
    const user = authResult.session.user;
    if (user.role === "SALES" && !salesRepId && !status) {
      where.OR = [{ salesRepId: user.id }, { salesRep: user.name }];
    }

    const orders = await prisma.productionOrder.findMany({
      where,
      include: {
        customer: true,
        salesRepUser: { select: { id: true, name: true, email: true } },
        assignedWorker: { select: { id: true, name: true, email: true } },
        lines: true,
        approvals: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders: serializeModel(orders) });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    const userId = authResult.session.user.id;

    // If user is sales rep, default salesRepId to them unless specified
    const salesRepId = body.salesRepId || (authResult.session.user.role === "SALES" ? userId : null);

    const order = await createSalesOrder({
      customerId: body.customerId,
      salesRepId,
      priority: body.priority,
      deliveryDate: body.deliveryDate,
      notes: body.notes,
      subtotal: body.subtotal,
      discount: body.discount,
      total: body.total,
      proposedTotal: body.proposedTotal || body.total,
      lines: body.lines,
      status: body.status || "PENDING_APPROVAL",
      createdById: userId,
    });

    return NextResponse.json({ order: serializeModel(order) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create order" },
      { status: 400 },
    );
  }
}
