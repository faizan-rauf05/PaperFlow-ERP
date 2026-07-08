import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { convertQuantity } from "@/lib/services/unit-conversion.service";
import { serializeModel } from "@/lib/serialize";

export async function POST(request) {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      const { requireWorker } = await import("@/lib/apiAuth");
      const workerResult = await requireWorker();
      if (workerResult.error) {
        return NextResponse.json(authResult.error.body, { status: authResult.error.status });
      }
    }

    const body = await request.json();
    const result = convertQuantity({
      quantity: body.quantity,
      fromUnit: body.fromUnit,
      toUnit: body.toUnit,
      context: body.context || {},
    });

    return NextResponse.json({ result: serializeModel(result) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
