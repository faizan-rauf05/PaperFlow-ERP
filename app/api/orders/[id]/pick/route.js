import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { pickWorkerOrder } from "@/lib/services/order-workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request, { params }) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const workerId = authResult.session.user.id;

    const order = await pickWorkerOrder(id, workerId);
    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("POST /api/orders/[id]/pick error:", error);
    // If order already picked or unavailable, return 409 Conflict
    const status = error.message?.includes("already been picked") ? 409 : 400;
    return NextResponse.json(
      { error: error.message || "Failed to pick order" },
      { status },
    );
  }
}
