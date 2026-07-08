import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { logDowntime, getMachineDowntimes } from "@/lib/services/machine.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const downtimes = await getMachineDowntimes(id);
    return NextResponse.json({ downtimes: serializeModel(downtimes) });
  } catch (error) {
    console.error("GET /api/machines/[id]/downtime error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id: machineId } = await params;
    const body = await request.json();

    if (!body.reason || !body.startTime) {
      return NextResponse.json({ error: "reason and startTime are required" }, { status: 400 });
    }

    const record = await logDowntime({
      machineId,
      reason: body.reason,
      startTime: body.startTime,
      endTime: body.endTime || null,
      createdById: authResult.session.user.id,
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MACHINE_DOWNTIME,
      model: "MachineDowntime",
      recordId: record.id,
      newValue: { machineId, reason: body.reason },
    });

    return NextResponse.json({ downtime: serializeModel(record) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/machines/[id]/downtime error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
