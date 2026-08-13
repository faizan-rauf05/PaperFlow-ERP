import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { serializeModel } from "@/lib/serialize";

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
    const data = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim() || null;
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

    const customer = await prisma.customer.update({ where: { id }, data });
    return NextResponse.json({ customer: serializeModel(customer) });
  } catch (error) {
    console.error("PUT /api/customers/[id] error:", error);
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
    const orderCount = await prisma.productionOrder.count({
      where: { customerId: id },
    });
    if (orderCount > 0) {
      return NextResponse.json(
        { error: "Customer has orders and cannot be deleted" },
        { status: 409 },
      );
    }

    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
