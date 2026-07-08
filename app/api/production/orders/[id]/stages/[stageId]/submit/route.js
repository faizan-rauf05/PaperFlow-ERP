import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { submitStage } from "@/lib/services/workflow.service";
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

    const stage = await submitStage({
      orderId,
      stageId,
      workerId: authResult.session.user.id,
      outputQty: body.outputQty,
      wasteQty: body.wasteQty,
      remarks: body.remarks,
      qc: body.qc,
      consumptions: body.consumptions,
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.STAGE_SUBMITTED,
      model: "ProductionStage",
      recordId: stageId,
      newValue: { stageType: stage.stageType, orderId },
    });

    return NextResponse.json({ stage: serializeModel(stage) });
  } catch (error) {
    const status = error.message?.includes("locked") || error.message?.includes("exceed") ? 400 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
