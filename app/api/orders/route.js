import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireSalesOrAbove } from "@/lib/apiAuth";
import { createSalesOrder } from "@/lib/services/order-workflow.service";
import { salesOrderSchema } from "@/lib/validations/sales-order";
import { canSeeCost, withoutOrderMaterialCost } from "@/lib/api/cost-visibility";
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
        lines: {
          orderBy: { lineNo: "asc" },
          include: {
            cliche: true,
            stages: { orderBy: { sequence: "asc" } },
            suggestedMaterials: { orderBy: { role: "asc" }, include: { material: true } },
          },
        },
        approvals: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            requestedBy: { select: { id: true, name: true, email: true } },
            reviewedBy: { select: { id: true, name: true, email: true } },
          },
        },
        quoteApprovals: {
          orderBy: { generatedAt: "desc" },
          take: 1,
          include: {
            sentBy: { select: { id: true, name: true, email: true } },
            markedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Material cost is Admin/Manager-only (same rule as /api/materials).
    const ordersOut = canSeeCost(user.role) ? orders : orders.map(withoutOrderMaterialCost);

    return NextResponse.json({ orders: serializeModel(ordersOut) });
  } catch (error) {
    console.error("GET /api/orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Proposals can be created by Sales, Admin and Manager.
export async function POST(request) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const parsed = salesOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order data" }, { status: 400 });
    }

    const { id: userId, role } = authResult.session.user;
    const order = await createSalesOrder({
      ...parsed.data,
      // A sales rep's proposal is always their own; Admin/Manager pick a rep (or none).
      salesRepId: role === "SALES" ? userId : parsed.data.salesRepId,
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
