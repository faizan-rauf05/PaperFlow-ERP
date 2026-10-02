import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { sendOrderToProduction } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const { order, status, movedToWarehouse } = await sendOrderToProduction(id, authResult.session.user.id);

    return NextResponse.json({
      order: serializeModel(order),
      status,
      // Materials reserved in the factory at approval that it no longer covers.
      movedToWarehouse: movedToWarehouse.map((r) => ({ id: r.id, lineNo: r.lineNo, name: r.material.name })),
    });
  } catch (error) {
    console.error("POST /api/orders/[id]/send-to-production error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send order to production" },
      { status: 400 },
    );
  }
}
