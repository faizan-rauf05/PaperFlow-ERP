import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";

export async function GET(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const materialId = searchParams.get("materialId");
    const skip = (page - 1) * limit;

    const where = materialId ? { materialId } : {};

    const [total, transactions] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          material: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      transactions: serializeModel(transactions),
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error("GET /api/inventory/history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
