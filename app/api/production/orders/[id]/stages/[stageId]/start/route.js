import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { startStage } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function POST(request, { params }) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id: orderId, stageId } = await params;
    const body = await request.json();

    const stage = await startStage({
      orderId,
      stageId,
      workerId: authResult.session.user.id,
      machineId: body.machineId || null,
      rollId: body.rollId || null,
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.STAGE_STARTED,
      model: "ProductionStage",
      recordId: stageId,
      newValue: { stageType: stage.stageType, orderId },
    });

    return NextResponse.json({ stage: serializeModel(stage) });
  } catch (error) {
    const status = error.message?.includes("incomplete") ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
