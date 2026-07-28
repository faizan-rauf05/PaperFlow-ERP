import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { recordStage, getStageRecordContext } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id, stageId } = await params;
    const context = await getStageRecordContext(id, stageId);
    return NextResponse.json({ context: serializeModel(context) });
  } catch (error) {
    console.error("GET stage record context error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id, stageId } = await params;
    const body = await request.json();

    const order = await recordStage({
      orderId: id,
      stageId,
      userId: authResult.session.user.id,
      ...body,
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.STAGE_SUBMITTED,
      model: "ProductionStage",
      recordId: stageId,
      newValue: { orderId: id, outputQty: body.outputQty },
    });

    return NextResponse.json({ order: serializeModel(order) });
  } catch (error) {
    console.error("POST stage record error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
