import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWarehouse } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { getMaterialStock } from "@/lib/services/inventory.service";

// Same "no cost figures outside admin/manager" rule as /api/materials.
const COST_HIDDEN_ROLES = ["WORKER", "WAREHOUSE"];

export async function GET(request, { params }) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { code } = await params;
    const barCode = decodeURIComponent(code || "").trim();
    if (!barCode) {
      return NextResponse.json({ error: "Barcode is required" }, { status: 400 });
    }

    const material = await prisma.material.findUnique({
      where: { barCode },
      include: { supplier: { select: { id: true, name: true } } },
    });

    if (!material) {
      return NextResponse.json({ error: "No material found for this barcode" }, { status: 404 });
    }

    const currentStock = (await getMaterialStock(material.id)).toNumber();
    let out = {
      ...material,
      currentStock,
      isLowStock: currentStock < Number(material.minimumStock || 0),
    };

    if (COST_HIDDEN_ROLES.includes(authResult.session.user.role)) {
      const {
        costPricePerUnit,
        costPriceCurrency,
        costPriceEntryBasis,
        costPriceOriginalAmount,
        costPriceExchangeRate,
        costPriceRateDate,
        ...rest
      } = out;
      out = rest;
    }

    return NextResponse.json({ material: serializeModel(out) });
  } catch (error) {
    console.error("GET /api/materials/by-barcode/[code] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
