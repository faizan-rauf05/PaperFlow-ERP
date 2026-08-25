import { NextResponse } from "next/server";
import { requireSalesOrAbove } from "@/lib/apiAuth";
import { recordCustomerQuoteResponse } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request, { params }) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();

    if (typeof body.approved !== "boolean") {
      return NextResponse.json({ error: "approved (boolean) is required" }, { status: 400 });
    }
    if (!body.approvalMethod?.trim()) {
      return NextResponse.json(
        { error: "Describe how the customer's response was confirmed" },
        { status: 400 },
      );
    }

    const order = await recordCustomerQuoteResponse({
      orderId: id,
      approved: body.approved,
      approvalMethod: body.approvalMethod,
      evidenceUrl: body.evidenceUrl,
      remarks: body.remarks,
      markedById: authResult.session.user.id,
    });

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("POST /api/orders/[id]/customer-approval error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record customer approval" },
      { status: 400 },
    );
  }
}
