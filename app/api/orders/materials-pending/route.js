import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/apiAuth";
import { getOrdersPendingMaterials } from "@/lib/services/material-fulfillment.service";
import { serializeModel } from "@/lib/serialize";

/**
 * Orders that need warehouse material fulfillment (picking), each annotated
 * with per-material remaining-to-pick and a live shortage flag. Never
 * includes price/total/profit fields — see material-fulfillment.service.js
 * for the status scope and shortage-detection logic.
 */
export async function GET() {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const orders = await getOrdersPendingMaterials();
    return NextResponse.json({ orders: serializeModel(orders) });
  } catch (error) {
    console.error("GET /api/orders/materials-pending error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
