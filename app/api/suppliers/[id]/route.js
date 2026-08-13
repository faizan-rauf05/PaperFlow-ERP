import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { supplierSchema } from "@/lib/validations/admin-forms";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.errors[0]?.message ?? "Invalid supplier data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: parsed.data.name,
        contactPerson: parsed.data.contactPerson || null,
        contactNumber: parsed.data.contactNumber || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json({ supplier: serializeModel(supplier) });
  } catch (error) {
    console.error("PUT /api/suppliers/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { id } = await params;
    const materialCount = await prisma.material.count({
      where: { supplierId: id },
    });
    if (materialCount > 0) {
      return NextResponse.json(
        { error: "Supplier has associated materials and cannot be deleted" },
        { status: 409 },
      );
    }

    await prisma.supplier.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/suppliers/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
