import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { getHandleStockSummary } from "@/lib/services/consumption.service";

export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const summary = await getHandleStockSummary();
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("GET /api/inventory/handle-stock error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
