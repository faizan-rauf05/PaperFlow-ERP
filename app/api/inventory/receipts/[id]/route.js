import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager, requireWarehouse } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { canSeeCost, withoutReceiptCost } from "@/lib/api/cost-visibility";
import { stockReceiptSchema } from "@/lib/validations/inventory";
import { RECEIPT_INCLUDE, deleteReceipt, updateReceipt } from "@/lib/services/stock-receipt.service";

function errorResponse(error, label) {
  if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error.code === "COST_PRICE_DIVISOR_MISSING") return NextResponse.json({ error: error.message }, { status: 400 });
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** GET /api/inventory/receipts/[id] */
export async function GET(_request, { params }) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }
    const { id } = await params;
    const receipt = await prisma.stockReceipt.findUnique({ where: { id }, include: RECEIPT_INCLUDE });
    if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    const out = canSeeCost(authResult.session.user.role) ? receipt : withoutReceiptCost(receipt);
    return NextResponse.json({ receipt: serializeModel(out) });
  } catch (error) {
    return errorResponse(error, "GET /api/inventory/receipts/[id]");
  }
}

/** PUT /api/inventory/receipts/[id] — correct a delivery (Admin/Manager). */
export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }
    const parsed = stockReceiptSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid receipt" }, { status: 400 });
    }
    const { id } = await params;
    const receipt = await updateReceipt(id, parsed.data, authResult.session.user.id);
    return NextResponse.json({ receipt: serializeModel(receipt) });
  } catch (error) {
    return errorResponse(error, "PUT /api/inventory/receipts/[id]");
  }
}

/** DELETE /api/inventory/receipts/[id] — remove a delivery entered by mistake (Admin/Manager). */
export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }
    const { id } = await params;
    await deleteReceipt(id, authResult.session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "DELETE /api/inventory/receipts/[id]");
  }
}
