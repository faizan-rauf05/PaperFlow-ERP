import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    {
      error:
        "Whole-order worker assignment is retired — workers now claim individual stages (POST /api/production/orders/[id]/stages/[stageId]/start).",
    },
    { status: 410 },
  );
}
