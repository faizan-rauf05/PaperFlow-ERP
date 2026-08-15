import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { getAvailableWorkerOrders } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const availableOrders = await getAvailableWorkerOrders();
    return NextResponse.json({ orders: serializeModel(availableOrders) });
  } catch (error) {
    console.error("GET /api/orders/available error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
