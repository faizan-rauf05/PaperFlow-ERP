import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/apiAuth";
import { getLowStockMaterials } from "@/lib/services/inventory.service";
import { serializeModel } from "@/lib/serialize";

export async function GET() {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const items = await getLowStockMaterials();
    return NextResponse.json({ items: serializeModel(items) });
  } catch (error) {
    console.error("GET /api/inventory/low-stock error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
