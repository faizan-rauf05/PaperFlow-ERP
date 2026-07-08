import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { unlockStage } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function POST(_request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id: orderId, stageId } = await params;
    const stage = await unlockStage({ orderId, stageId });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.STAGE_UNLOCKED,
      model: "ProductionStage",
      recordId: stageId,
      newValue: { orderId },
    });
    return NextResponse.json({ stage: serializeModel(stage) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
