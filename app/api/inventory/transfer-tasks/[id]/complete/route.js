import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/apiAuth";
import { completeTransferTask } from "@/lib/services/transfer-task.service";
import { serializeModel } from "@/lib/serialize";

/** Completes a transfer task: `{ quantity, proofUrls }` (quantity ignored for paper rolls — the whole roll moves). */
export async function POST(request, { params }) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();
    const task = await completeTransferTask({
      taskId: id,
      quantity: body.quantity,
      proofUrls: body.proofUrls,
      userId: authResult.session.user.id,
    });
    return NextResponse.json({ task: serializeModel(task) });
  } catch (error) {
    console.error("POST /api/inventory/transfer-tasks/[id]/complete error:", error);
    return NextResponse.json({ error: error.message || "Failed to complete transfer" }, { status: error.status || 500 });
  }
}
