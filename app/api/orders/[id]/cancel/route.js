import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { cancelOrder } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();

    const order = await cancelOrder({
      orderId: id,
      reason: body.reason,
      userId: authResult.session.user.id,
    });

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("POST /api/orders/[id]/cancel error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel order" },
      { status: 400 },
    );
  }
}
