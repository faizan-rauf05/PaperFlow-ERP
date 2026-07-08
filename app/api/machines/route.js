import { NextResponse } from "next/server";
import { requireAdminOrManager, requireWorker } from "@/lib/apiAuth";
import { listMachines, createMachine } from "@/lib/services/machine.service";
import { serializeModel } from "@/lib/serialize";

export async function GET(request) {
  try {
    const authResult = await requireWorker();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const machines = await listMachines({
      stageType: searchParams.get("stageType") || undefined,
      status: searchParams.get("status") || undefined,
    });

    return NextResponse.json({ machines: serializeModel(machines) });
  } catch (error) {
    console.error("GET /api/machines error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    if (!body.name || !body.machineCode || !body.stageType) {
      return NextResponse.json(
        { error: "name, machineCode, and stageType are required" },
        { status: 400 },
      );
    }

    const machine = await createMachine(body);
    return NextResponse.json({ machine: serializeModel(machine) }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Machine code already exists" }, { status: 409 });
    }
    console.error("POST /api/machines error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
