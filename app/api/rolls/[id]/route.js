import { NextResponse } from "next/server";

/** Rolls module removed — inventory is material-only. */
export async function GET() {
  return NextResponse.json({ error: "Rolls module has been removed" }, { status: 410 });
}

export async function PUT() {
  return NextResponse.json({ error: "Rolls module has been removed" }, { status: 410 });
}
