import { NextResponse } from "next/server";
import { requireWarehouse } from "@/lib/apiAuth";
import { FX_CURRENCIES, getRateToKwd } from "@/lib/exchange-rate";

export async function GET(request) {
  // Anyone who receives stock (Warehouse/Manager/Admin) may price it in USD/EUR.
  const authResult = await requireWarehouse();
  if (authResult.error) {
    return NextResponse.json(authResult.error.body, {
      status: authResult.error.status,
    });
  }

  const currency = (new URL(request.url).searchParams.get("currency") || "USD").toUpperCase();
  if (!FX_CURRENCIES.includes(currency)) {
    return NextResponse.json(
      { error: `Unsupported currency. Use one of: ${FX_CURRENCIES.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const { rate, date, stale } = await getRateToKwd(currency);
    return NextResponse.json({ currency, rate, date, stale: Boolean(stale) });
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
