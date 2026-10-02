import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/apiAuth";
import { listTransferTasks } from "@/lib/services/transfer-task.service";
import { serializeModel } from "@/lib/serialize";

/** Warehouse → factory transfer tasks raised by factory stock going below zero. `?status=OPEN|COMPLETED`. */
export async function GET(request) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const status = new URL(request.url).searchParams.get("status");
    const tasks = await listTransferTasks({
      status: ["OPEN", "COMPLETED"].includes(status) ? status : undefined,
    });
    return NextResponse.json({ tasks: serializeModel(tasks) });
  } catch (error) {
    console.error("GET /api/inventory/transfer-tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
