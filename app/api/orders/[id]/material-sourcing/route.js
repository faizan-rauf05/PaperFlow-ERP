import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { getMaterialSourcing } from "@/lib/services/material-sourcing.service";
import { serializeModel } from "@/lib/serialize";

/**
 * Live factory/warehouse availability for an order's suggested materials,
 * with the default source for each (factory when free factory stock covers
 * it) — shown to the approver before approving.
 */
export async function GET(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const rows = await getMaterialSourcing(id);
    return NextResponse.json({ materials: serializeModel(rows) });
  } catch (error) {
    console.error("GET /api/orders/[id]/material-sourcing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
