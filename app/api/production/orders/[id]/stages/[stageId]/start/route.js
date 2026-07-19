import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Worker start is deferred — use Admin Record input" },
    { status: 410 },
  );
}
