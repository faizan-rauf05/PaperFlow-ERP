import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { buildMaterialRecord, computeInitialStockQty } from "@/lib/material-code";
import { materialSchema } from "@/lib/validations/admin-forms";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { Prisma } from "@prisma/client";

const { Decimal } = Prisma;

const STOCK_IN_TYPES = ["STOCK_IN", "RETURN", "ADJUSTMENT"];
const STOCK_OUT_TYPES = ["STOCK_OUT", "WASTE"];

function duplicateMaterialErrorMessage(error) {
  // error.meta.target can be an array of column names (classic engine) or a
  // single constraint-name string like "Material_batchNo_receivingDate_key"
  // (driver adapter mode) — join to one string and substring-match either way.
  const raw = error.meta?.target;
  const target = (Array.isArray(raw) ? raw.join(" ") : raw || "").toString();
  if (target.includes("barCode")) {
    return "A material with this barcode already exists.";
  }
  if (target.includes("batchNo")) {
    return "This batch number and date combination already exists.";
  }
  return "Material code already exists.";
}

export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const materials = await prisma.material.findMany({
      orderBy: [{ materialType: "asc" }, { name: "asc" }],
      include: {
        supplier: true,
        transactions: {
          select: {
            transactionType: true,
            quantity: true,
            unit: true,
          },
        },
      },
    });

    const enriched = materials.map((m) => {
      let initialStock = new Decimal(0);
      let currentStock = new Decimal(0);

      for (const tx of m.transactions) {
        const q = new Decimal(tx.quantity ? tx.quantity.toString() : "0");
        if (tx.transactionType === "STOCK_IN") {
          initialStock = initialStock.add(q);
        }
        if (STOCK_IN_TYPES.includes(tx.transactionType)) {
          currentStock = currentStock.add(q);
        } else if (STOCK_OUT_TYPES.includes(tx.transactionType)) {
          currentStock = currentStock.sub(q);
        }
      }

      const { transactions, supplier, ...rest } = m;
      return {
        ...rest,
        supplier: supplier?.name || null,
        supplierId: m.supplierId || null,
        initialStock: initialStock.toNumber(),
        availableStock: currentStock.toNumber(),
        isLowStock: currentStock.lessThan(m.minimumStock || 0),
      };
    });

    return NextResponse.json({ materials: serializeModel(enriched) });
  } catch (error) {
    console.error("GET /api/materials error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const body = await request.json();
    const parsed = materialSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.errors[0]?.message ?? "Invalid material data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = buildMaterialRecord(parsed.data);

    // Resolve supplier relation to supplierId
    const supplierName = data.supplier;
    delete data.supplier;

    if (supplierName) {
      const sup = await prisma.supplier.findFirst({
        where: { name: { equals: supplierName, mode: "insensitive" } },
      });
      data.supplierId = sup ? sup.id : null;
    } else {
      data.supplierId = null;
    }

    // Upload base64 label image to Cloudinary CDN if provided
    if (data.imageUrl && data.imageUrl.startsWith("data:image")) {
      data.imageUrl = await uploadImageToCloudinary(data.imageUrl, "materials");
    }

    const material = await prisma.material.create({ data });

    const initQty = computeInitialStockQty(material.materialType, data);

    if (initQty > 0) {
      const { postInventoryTransaction } =
        await import("@/lib/services/inventory.service");
      await postInventoryTransaction({
        materialId: material.id,
        transactionType: "STOCK_IN",
        quantity: initQty,
        unit: material.unit || "METER",
        remarks: "Initial stock on material creation",
        createdById: authResult.session.user.id,
      });
    }

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_CREATED,
      model: "Material",
      recordId: material.id,
      newValue: {
        code: material.code,
        name: material.name,
        materialType: material.materialType,
        initialStock: initQty,
      },
    });

    return NextResponse.json(
      { material: serializeModel(material) },
      { status: 201 },
    );
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: duplicateMaterialErrorMessage(error) },
        { status: 409 },
      );
    }
    console.error("POST /api/materials error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
