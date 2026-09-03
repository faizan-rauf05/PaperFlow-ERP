import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/apiAuth";
import { getAvailableStages, getMyActiveStages } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function GET() {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const [available, mine] = await Promise.all([
      getAvailableStages(),
      getMyActiveStages(authResult.session.user.id),
    ]);

    return NextResponse.json({
      available: serializeModel(available),
      mine: serializeModel(mine),
    });
  } catch (error) {
    console.error("GET /api/production/my-tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
