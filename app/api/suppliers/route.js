import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";
import { supplierSchema } from "@/lib/validations/admin-forms";

export async function GET(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    const suppliers = await prisma.supplier.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contactPerson: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { contactNumber: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ suppliers: serializeModel(suppliers) });
  } catch (error) {
    console.error("GET /api/suppliers error:", error);
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
    const parsed = supplierSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.errors[0]?.message ?? "Invalid supplier data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
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

    return NextResponse.json(
      { supplier: serializeModel(supplier) },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/suppliers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
