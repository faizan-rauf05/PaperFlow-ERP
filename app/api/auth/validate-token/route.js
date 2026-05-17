import { NextResponse } from "next/server";
import { validateResetToken } from "@/lib/tokens";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const validation = await validateResetToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        { valid: false, reason: validation.reason },
        { status: 400 },
      );
    }

    return NextResponse.json({
      valid: true,
      userName: validation.userName,
    });
  } catch (error) {
    console.error("GET /api/auth/validate-token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
