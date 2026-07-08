import { NextResponse } from "next/server";
import { requireAdminOrManager, requireWorker } from "@/lib/apiAuth";
import { postInventoryTransaction } from "@/lib/services/inventory.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

export async function POST(request) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    const { materialId, rollId, transactionType, quantity, unit, referenceId, remarks } = body;

    if (!materialId || !transactionType || !quantity || !unit) {
      return NextResponse.json(
        { error: "materialId, transactionType, quantity, and unit are required" },
        { status: 400 },
      );
    }

    const record = await postInventoryTransaction({
      materialId,
      rollId: rollId || null,
      transactionType,
      quantity,
      unit,
      referenceId,
      remarks,
      createdById: authResult.session.user.id,
    });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.INVENTORY_TRANSACTION,
      model: "InventoryTransaction",
      recordId: record.id,
      newValue: { transactionType, materialId, quantity, unit },
    });

    return NextResponse.json({ transaction: serializeModel(record) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inventory/transactions error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
