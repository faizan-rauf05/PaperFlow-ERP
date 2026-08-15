import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { getSalesRepresentatives } from "@/lib/services/order-workflow.service";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const salesReps = await getSalesRepresentatives();
    return NextResponse.json({ salesReps });
  } catch (error) {
    console.error("GET /api/users/sales-reps error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
