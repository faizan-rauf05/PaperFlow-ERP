import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { claimStage } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function POST(_request, { params }) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id, stageId } = await params;
    const workerId = authResult.session.user.id;

    const stage = await claimStage({ stageId, orderId: id, workerId });

    await writeAuditLog({
      userId: workerId,
      action: ACTIONS.STAGE_CLAIMED,
      model: "ProductionStage",
      recordId: stageId,
      newValue: { orderId: id, stageType: stage.stageType },
    });

    return NextResponse.json({ stage: serializeModel(stage) });
  } catch (error) {
    console.error("POST stage claim error:", error);
    const status = error.message?.includes("already claimed") ? 409 : 400;
    return NextResponse.json(
      { error: error.message || "Failed to claim stage" },
      { status },
    );
  }
}
