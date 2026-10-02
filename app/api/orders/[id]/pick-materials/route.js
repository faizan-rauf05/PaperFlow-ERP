import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/apiAuth";
import { pickOrderLineMaterial } from "@/lib/services/material-fulfillment.service";
import { serializeModel } from "@/lib/serialize";
import { withoutOrderMaterialCost } from "@/lib/api/cost-visibility";

/**
 * Confirms a warehouse pick against an order's material requirement. Body
 * accepts either a single pick `{ orderLineMaterialId, pickedQty, proofUrls }`
 * or a batch `{ picks: [...] }` of the same shape, applied one at a time so a
 * failure partway through a batch still returns which picks succeeded.
 */
export async function POST(request, { params }) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id: orderId } = await params;
    const body = await request.json();
    const picks = Array.isArray(body.picks) ? body.picks : [body];

    if (picks.length === 0) {
      return NextResponse.json({ error: "No picks provided" }, { status: 400 });
    }

    const results = [];
    let latestOrder = null;
    for (const pick of picks) {
      if (!pick.orderLineMaterialId) {
        return NextResponse.json(
          { error: "orderLineMaterialId is required for every pick", results },
          { status: 400 },
        );
      }
      try {
        const result = await pickOrderLineMaterial({
          orderId,
          orderLineMaterialId: pick.orderLineMaterialId,
          pickedQty: pick.pickedQty,
          proofUrls: pick.proofUrls,
          actingUserId: authResult.session.user.id,
        });
        results.push({ orderLineMaterialId: pick.orderLineMaterialId, success: true, released: result.released });
        // Latest order snapshot always wins — every pick in the batch
        // targets the same order, so the last result reflects all of them.
        latestOrder = result.order;
      } catch (pickError) {
        return NextResponse.json(
          {
            error: pickError.message || "Failed to record pick",
            results,
          },
          { status: pickError.status || 400 },
        );
      }
    }

    // Warehouse never sees sales prices/totals/profit or material cost
    // figures — this endpoint is warehouse-only, so strip unconditionally.
    const orderOut = latestOrder
      ? (({ subtotal, discount, total, proposedTotal, approvedTotal, ...orderRest }) =>
          withoutOrderMaterialCost({
            ...orderRest,
            lines: orderRest.lines.map(({ unitPrice, lineTotal, ...l }) => l),
          }))(latestOrder)
      : null;

    return NextResponse.json({ results, order: serializeModel(orderOut) });
  } catch (error) {
    console.error("POST /api/orders/[id]/pick-materials error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
