import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { getAllMaterialStock } from "@/lib/services/inventory.service";
import { serializeModel } from "@/lib/serialize";

export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const stock = await getAllMaterialStock();
    return NextResponse.json({ stock: serializeModel(stock) });
  } catch (error) {
    console.error("GET /api/inventory/current-stock error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
