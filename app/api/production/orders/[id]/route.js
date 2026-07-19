import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { getOrderWithStages } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const order = await getOrderWithStages(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("GET /api/production/orders/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
