import { NextResponse } from "next/server";
import { requireAdminOrManager } from "@/lib/apiAuth";
import { getUsdToKwdRate } from "@/lib/exchange-rate";

export async function GET() {
  const authResult = await requireAdminOrManager();
  if (authResult.error) {
    return NextResponse.json(authResult.error.body, {
      status: authResult.error.status,
    });
  }

  try {
    const { rate, date, stale } = await getUsdToKwdRate();
    return NextResponse.json({ rate, date, stale: Boolean(stale) });
  } catch (error) {
    console.error("GET /api/exchange-rate error:", error);
    return NextResponse.json(
      {
        error:
          "Exchange rate service is unavailable right now. You can still enter the cost price in KWD.",
      },
      { status: 503 },
    );
  }
}
