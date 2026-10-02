import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWarehouse, requireWorkerOrWarehouse } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { canSeeCost, withoutMaterialCost } from "@/lib/api/cost-visibility";
import { catalogMaterialSchema } from "@/lib/validations/inventory";
import { createCatalogMaterial } from "@/lib/services/material-catalog.service";
import { withStock } from "@/lib/services/stock.service";

/**
 * GET /api/materials — catalog materials and paper rolls with stock per
 * location. Optional filters: ?type=GLUE, ?kind=catalog|rolls,
 * ?inStock=1 (only materials with stock somewhere).
 */
export async function GET(request) {
  try {
    // Workers read materials for stage recording, warehouse for receiving/picking.
    const authResult = await requireWorkerOrWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const kind = searchParams.get("kind");
    const where = {
      ...(type ? { materialType: type } : {}),
      ...(kind === "rolls" ? { materialType: "PAPER_ROLL" } : {}),
      ...(kind === "catalog" ? { NOT: { materialType: "PAPER_ROLL" } } : {}),
    };

    const rows = await prisma.material.findMany({
      where,
      orderBy: [{ materialType: "asc" }, { name: "asc" }, { createdAt: "desc" }],
      include: {
        supplier: { select: { id: true, name: true } },
        // Latest delivery — a paper roll's received date (FIFO order), a catalog material's
        // last restock and its pack size (so stock can be moved/adjusted in packs).
        receipts: {
          select: { receivedAt: true, packSize: true, costAmount: true, costCurrency: true, costEntryBasis: true },
          orderBy: { receivedAt: "desc" },
          take: 1,
        },
      },
    });
    const materials = rows.map(({ receipts, ...m }) => ({
      ...m,
      lastReceivedAt: receipts[0]?.receivedAt ?? null,
      lastPackSize: receipts[0]?.packSize ?? null,
      // The latest delivery's price as it was entered (a paper roll's only one)
      lastPriceEntered: receipts[0]
        ? { amount: receipts[0].costAmount, currency: receipts[0].costCurrency, basis: receipts[0].costEntryBasis }
        : null,
    }));

    let out = await withStock(materials);
    if (searchParams.get("inStock") === "1") out = out.filter((m) => m.stock.total > 0);
    if (!canSeeCost(authResult.session.user.role)) out = out.map(withoutMaterialCost);

    return NextResponse.json({ materials: serializeModel(out) });
  } catch (error) {
    console.error("GET /api/materials error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/materials — add a catalog material (supplier + type + subtype). */
export async function POST(request) {
  try {
    const authResult = await requireWarehouse();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const parsed = catalogMaterialSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid material" }, { status: 400 });
    }

    const material = await createCatalogMaterial(parsed.data, authResult.session.user.id);
    return NextResponse.json({ material: serializeModel(material) }, { status: 201 });
  } catch (error) {
    if (error.status) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("POST /api/materials error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
