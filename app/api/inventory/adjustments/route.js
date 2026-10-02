import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { stockAdjustmentSchema } from "@/lib/validations/inventory";
import { adjustStock } from "@/lib/services/stock.service";
import { checkFactoryGlueLevels } from "@/lib/services/transfer-task.service";

/** POST /api/inventory/adjustments — stock-count correction at one location (Admin/Manager). */
export async function POST(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const parsed = stockAdjustmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid adjustment" }, { status: 400 });
    }

    const userId = authResult.session.user.id;
    const { transaction, warning } = await adjustStock({ ...parsed.data, createdById: userId });
    await writeAuditLog({
      userId,
      action: ACTIONS.STOCK_ADJUSTED,
      model: "InventoryTransaction",
      recordId: transaction.id,
      newValue: { materialId: parsed.data.materialId, location: parsed.data.location, quantity: parsed.data.quantity, remarks: parsed.data.remarks },
    });
    if (parsed.data.location === "FACTORY" && Number(parsed.data.quantity) < 0) await checkFactoryGlueLevels();
    return NextResponse.json({ transaction: serializeModel(transaction), warning }, { status: 201 });
  } catch (error) {
    if (/not found|can't be zero|reason/i.test(error.message || "")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/inventory/adjustments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
