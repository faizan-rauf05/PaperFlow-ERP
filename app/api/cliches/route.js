import { NextResponse } from "next/server";
import { requireSalesOrAbove } from "@/lib/apiAuth";
import { searchCliches, createCliche } from "@/lib/services/cliche.service";
import { serializeModel } from "@/lib/serialize";

export async function GET(request) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { searchParams } = new URL(request.url);
    const cliches = await searchCliches({
      query: searchParams.get("search") || undefined,
      customerId: searchParams.get("customerId") || undefined,
    });

    return NextResponse.json({ cliches: serializeModel(cliches) });
  } catch (error) {
    console.error("GET /api/cliches error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const authResult = await requireSalesOrAbove();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const body = await request.json();
    if (!body.ownership || !body.source) {
      return NextResponse.json({ error: "ownership and source are required" }, { status: 400 });
    }

    const cliche = await createCliche(body, authResult.session.user.id);
    return NextResponse.json({ cliche: serializeModel(cliche) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/cliches error:", error);
    return NextResponse.json({ error: error.message || "Failed to create cliche" }, { status: 400 });
  }
}
