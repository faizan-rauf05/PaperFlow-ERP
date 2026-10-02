import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/apiAuth";
import { getFactoryGlueLevels } from "@/lib/services/factory-glue.service";
import { checkFactoryGlueLevels } from "@/lib/services/transfer-task.service";

/**
 * Factory glue level per glue type, in drums, for the dashboard alert
 * (Warehouse/Manager/Admin). Also makes sure every low type has its supply
 * task — idempotent, so a level that dropped without a stock write we hook
 * (e.g. data present before this rule) still gets one.
 */
export async function GET() {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    await checkFactoryGlueLevels();
    const levels = await getFactoryGlueLevels();
    return NextResponse.json({
      levels: levels.map(({ materialIds, ...level }) => level),
    });
  } catch (error) {
    console.error("GET /api/inventory/factory-glue error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
