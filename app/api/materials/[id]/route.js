import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { buildMaterialRecord } from "@/lib/material-code";
import { materialSchema } from "@/lib/validations/admin-forms";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

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

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
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
        where: {
          name: { equals: supplierName, mode: "insensitive" },
        },
      });
      data.supplierId = sup ? sup.id : null;
    } else {
      data.supplierId = null;
    }

    // Upload base64 label image to Cloudinary CDN if provided
    if (data.imageUrl && data.imageUrl.startsWith("data:image")) {
      data.imageUrl = await uploadImageToCloudinary(data.imageUrl, "materials");
    }

    const material = await prisma.material.update({ where: { id }, data });

    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_UPDATED,
      model: "Material",
      recordId: id,
      newValue: {
        code: material.code,
        name: material.name,
        materialType: material.materialType,
      },
    });

    return NextResponse.json({ material: serializeModel(material) });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: duplicateMaterialErrorMessage(error) },
        { status: 409 },
      );
    }
    console.error("PUT /api/materials/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const existing = await prisma.material.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json(
        { error: "Material not found" },
        { status: 404 },
      );
    }

    const count = await prisma.inventoryTransaction.count({
      where: {
        materialId: id,
      },
    });

    if (count > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete material because it has inventory transactions.",
        },
        { status: 400 },
      );
    }

    await prisma.material.delete({ where: { id } });
    await writeAuditLog({
      userId: authResult.session.user.id,
      action: ACTIONS.MATERIAL_DELETED,
      model: "Material",
      recordId: id,
      oldValue: existing ? { code: existing.code, name: existing.name } : null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/materials/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
