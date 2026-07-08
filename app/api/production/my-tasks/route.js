import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { getWorkerTasks } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function GET() {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const tasks = await getWorkerTasks(authResult.session.user.id);
    return NextResponse.json({ tasks: serializeModel(tasks) });
  } catch (error) {
    console.error("GET /api/production/my-tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
