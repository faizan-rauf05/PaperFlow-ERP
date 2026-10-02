import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWarehouse } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { canSeeCost, withoutReceiptCost } from "@/lib/api/cost-visibility";
import { stockReceiptSchema } from "@/lib/validations/inventory";
import { RECEIPT_INCLUDE, receiveStock } from "@/lib/services/stock-receipt.service";

/** GET /api/inventory/receipts — recent deliveries. Filters: ?materialId, ?location, ?limit (≤ 200). */
export async function GET(request) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const where = {
      ...(searchParams.get("materialId") ? { materialId: searchParams.get("materialId") } : {}),
      ...(searchParams.get("location") ? { location: searchParams.get("location") } : {}),
    };

    const receipts = await prisma.stockReceipt.findMany({
      where,
      include: RECEIPT_INCLUDE,
      orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });
    const out = canSeeCost(authResult.session.user.role) ? receipts : receipts.map(withoutReceiptCost);
    return NextResponse.json({ receipts: serializeModel(out) });
  } catch (error) {
    console.error("GET /api/inventory/receipts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/inventory/receipts — receive a delivery (catalog material) or a new paper roll. */
export async function POST(request) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const parsed = stockReceiptSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid receipt" }, { status: 400 });
    }

    const receipt = await receiveStock(parsed.data, authResult.session.user.id);
    const out = canSeeCost(authResult.session.user.role) ? receipt : withoutReceiptCost(receipt);
    return NextResponse.json({ receipt: serializeModel(out) }, { status: 201 });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error.code === "COST_PRICE_DIVISOR_MISSING") return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("POST /api/inventory/receipts error:", error);
    const isRateFailure = /exchange rate|Frankfurter|fetch/i.test(error.message || "");
    return NextResponse.json(
      {
        error: isRateFailure
          ? "Couldn't get the current exchange rate. Try again, or enter the price in KWD."
          : "Internal server error",
      },
      { status: isRateFailure ? 503 : 500 },
    );
  }
}
