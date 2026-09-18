import { NextResponse } from "next/server";
import { requireAdminOrManager, requireWorkerOrWarehouse } from "@/lib/apiAuth";
import { postInventoryTransaction, getMaterialStock } from "@/lib/services/inventory.service";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";

const STOCK_OUT_TYPES = ["STOCK_OUT", "WASTE"];

export async function POST(request) {
  try {
    const authResult = await requireWorkerOrWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    const { materialId, transactionType, quantity, unit, referenceId, remarks } = body;

    if (!materialId || !transactionType || !quantity || !unit) {
      return NextResponse.json(
        { error: "materialId, transactionType, quantity, and unit are required" },
        { status: 400 },
      );
    }

    // Manual stock-out/waste postings are hard-blocked at this endpoint when they'd
    // take stock below zero — unlike postInventoryTransaction's shared soft warning,
    // which stays as-is for production's automatic consumption postings.
    if (STOCK_OUT_TYPES.includes(transactionType)) {
      const currentStock = await getMaterialStock(materialId);
      if (currentStock.lessThan(quantity)) {
        return NextResponse.json(
          { error: `Insufficient stock: only ${currentStock.toString()} ${unit} available` },
          { status: 400 },
        );
      }
    }

    const record = await postInventoryTransaction({
      materialId,
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
