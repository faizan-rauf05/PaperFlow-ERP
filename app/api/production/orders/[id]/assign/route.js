import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { assignOrderWorker } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();
    if (!body.assignedWorkerId) {
      return NextResponse.json({ error: "assignedWorkerId is required" }, { status: 400 });
    }

    const order = await assignOrderWorker(id, body.assignedWorkerId);

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.PRODUCTION_ORDER_ASSIGNED,
      model: "ProductionOrder",
      recordId: id,
      newValue: { assignedWorkerId: body.assignedWorkerId },
    });

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("PATCH assign worker error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
