import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/apiAuth";
import { updateMachine } from "@/lib/services/machine.service";
import { serializeModel } from "@/lib/serialize";

export async function PUT(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    const body = await request.json();
    const machine = await updateMachine(id, body);
    return NextResponse.json({ machine: serializeModel(machine) });
  } catch (error) {
    console.error("PUT /api/machines/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
