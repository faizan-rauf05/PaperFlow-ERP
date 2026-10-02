import { NextResponse } from "next/server";
import { requireSalesOrAbove } from "@/lib/apiAuth";
import { markQuoteSent } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(_request, { params }) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const order = await markQuoteSent({
      orderId: id,
      actingUserId: authResult.session.user.id,
    });

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("POST /api/orders/[id]/mark-quote-sent error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark quote as sent" },
      { status: 400 },
    );
  }
}
