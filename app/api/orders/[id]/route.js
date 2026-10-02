import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireSalesOrAbove } from "@/lib/apiAuth";
import { deleteSalesOrder, getOrderDetails, updateSalesOrder } from "@/lib/services/order-workflow.service";
import { salesOrderSchema } from "@/lib/validations/sales-order";
import { canSeeCost, withoutOrderMaterialCost } from "@/lib/api/cost-visibility";
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

    // Material cost is Admin/Manager-only (same rule as /api/materials).
    const orderOut = canSeeCost(authResult.session.user.role) ? order : withoutOrderMaterialCost(order);

    return NextResponse.json({ order: serializeModel(orderOut) });
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const parsed = salesOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order data" }, { status: 400 });
    }

    const { id } = await params;
    const { id: userId, role } = authResult.session.user;
    const data = { ...parsed.data };
    // Sales can't reassign an order's rep — undefined keeps the current one.
    if (role === "SALES") delete data.salesRepId;

    const order = await updateSalesOrder(id, data, userId);
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
    const authResult = await requireSalesOrAbove();
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

    await deleteSalesOrder(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
