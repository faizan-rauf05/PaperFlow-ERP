import { NextResponse } from "next/server";
import { requireSalesOrAbove } from "@/lib/apiAuth";
import { sendOrderToProduction } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request, { params }) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const order = await sendOrderToProduction(id, authResult.session.user.id);

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("POST /api/orders/[id]/send-to-production error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send order to production" },
      { status: 400 },
    );
  }
}
