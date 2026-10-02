import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWarehouse } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { canSeeCost, withoutMaterialCost } from "@/lib/api/cost-visibility";
import { withStock } from "@/lib/services/stock.service";

/** GET /api/materials/by-barcode/[code] — a paper roll by its barcode, with stock per location. */
export async function GET(_request, { params }) {
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
      return NextResponse.json({ error: "No paper roll found for this barcode" }, { status: 404 });
    }

    const [out] = await withStock([material]);
    return NextResponse.json({
      material: serializeModel(canSeeCost(authResult.session.user.role) ? out : withoutMaterialCost(out)),
    });
  } catch (error) {
    console.error("GET /api/materials/by-barcode/[code] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
