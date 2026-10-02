import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager, requireWarehouse } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { canSeeCost, withoutMaterialCost, withoutReceiptCost } from "@/lib/api/cost-visibility";
import { catalogMaterialSchema } from "@/lib/validations/inventory";
import { deleteCatalogMaterial, updateCatalogMaterial } from "@/lib/services/material-catalog.service";
import { withStock } from "@/lib/services/stock.service";
import { RECEIPT_INCLUDE } from "@/lib/services/stock-receipt.service";

const HISTORY_LIMIT = 100;

function errorResponse(error, label) {
  if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error(`${label} error:`, error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

/** GET /api/materials/[id] — material with stock per location, its receipts and recent movements. */
export async function GET(_request, { params }) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true } },
        // A recycled roll's parent, and the rolls recycled from this one
        parentRoll: { select: { id: true, barCode: true, name: true } },
        recycledRolls: { select: { id: true, barCode: true }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

    const [[withStockRow], receipts, movements, receiptCount, movementCount] = await Promise.all([
      withStock([material]),
      prisma.stockReceipt.findMany({
        where: { materialId: id },
        include: RECEIPT_INCLUDE,
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        take: HISTORY_LIMIT,
      }),
      prisma.inventoryTransaction.findMany({
        where: { materialId: id },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
      }),
      prisma.stockReceipt.count({ where: { materialId: id } }),
      prisma.inventoryTransaction.count({ where: { materialId: id } }),
    ]);

    const showCost = canSeeCost(authResult.session.user.role);
    return NextResponse.json({
      material: serializeModel(showCost ? withStockRow : withoutMaterialCost(withStockRow)),
      receipts: serializeModel(showCost ? receipts : receipts.map(withoutReceiptCost)),
      movements: serializeModel(movements),
      hasHistory: receiptCount + movementCount > 0,
    });
  } catch (error) {
    return errorResponse(error, "GET /api/materials/[id]");
  }
}

/** PUT /api/materials/[id] — correct a catalog material that has no history yet. */
export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const parsed = catalogMaterialSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid material" }, { status: 400 });
    }

    const { id } = await params;
    const material = await updateCatalogMaterial(id, parsed.data, authResult.session.user.id);
    return NextResponse.json({ material: serializeModel(material) });
  } catch (error) {
    return errorResponse(error, "PUT /api/materials/[id]");
  }
}

/** DELETE /api/materials/[id] — remove a catalog material that has never been used. */
export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    await deleteCatalogMaterial(id, authResult.session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "DELETE /api/materials/[id]");
  }
}
