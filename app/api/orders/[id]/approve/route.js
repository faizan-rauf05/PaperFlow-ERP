import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { reviewOrderApproval } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();
    const managerId = authResult.session.user.id;

    if (!body.action || !["APPROVE", "REJECT"].includes(body.action)) {
      return NextResponse.json(
        { error: "Valid action ('APPROVE' or 'REJECT') is required" },
        { status: 400 },
      );
    }

    const updatedOrder = await reviewOrderApproval({
      orderId: id,
      action: body.action,
      approvedTotal: body.approvedTotal,
      remarks: body.remarks,
      reviewedById: managerId,
    });

    return NextResponse.json({ order: serializeModel(updatedOrder) });
  } catch (error) {
    console.error("POST /api/orders/[id]/approve error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process approval" },
      { status: 400 },
    );
  }
}
