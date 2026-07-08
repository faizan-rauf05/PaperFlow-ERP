import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { getManagerKpis } from "@/lib/services/workflow.service";
import { serializeModel } from "@/lib/serialize";

export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const kpis = await getManagerKpis();
    return NextResponse.json({ kpis: serializeModel(kpis) });
  } catch (error) {
    console.error("GET /api/kpi error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
