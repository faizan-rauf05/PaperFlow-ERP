import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWarehouse } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";

/**
 * GET /api/inventory/history — stock movements, newest first.
 * Filters: ?materialId, ?location, ?type (InventoryTransactionType), ?page, ?limit (≤ 100).
 */
export async function GET(request) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const where = {
      ...(searchParams.get("materialId") ? { materialId: searchParams.get("materialId") } : {}),
      ...(searchParams.get("location") ? { location: searchParams.get("location") } : {}),
      ...(searchParams.get("type") ? { transactionType: searchParams.get("type") } : {}),
    };

    const [total, movements] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          material: { select: { id: true, name: true, materialType: true, barCode: true, unit: true, supplier: { select: { name: true } } } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      movements: serializeModel(movements),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("GET /api/inventory/history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
