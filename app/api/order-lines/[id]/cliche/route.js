import { NextResponse } from "next/server";
import { requireSalesOrAbove } from "@/lib/apiAuth";
import { assignClicheToOrderLine } from "@/lib/services/cliche.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request, { params }) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.clicheId && !body.newCliche) {
      return NextResponse.json({ error: "clicheId or newCliche is required" }, { status: 400 });
    }

    const orderLine = await assignClicheToOrderLine(
      id,
      { clicheId: body.clicheId, newCliche: body.newCliche },
      authResult.session.user.id,
    );

    return NextResponse.json({ orderLine: serializeModel(orderLine) });
  } catch (error) {
    console.error("POST /api/order-lines/[id]/cliche error:", error);
    return NextResponse.json({ error: error.message || "Failed to assign cliche" }, { status: 400 });
  }
}
