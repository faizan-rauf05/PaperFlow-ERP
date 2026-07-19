import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Unlock removed — use Record input from admin production detail" },
    { status: 410 },
  );
}
