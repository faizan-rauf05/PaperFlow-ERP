import { NextResponse } from "next/server";
import { AuthError } from "@auth/core/errors";
import { signIn } from "@/lib/auth";
import { ACTIONS, writeAuditLog } from "@/lib/auditLog";
import { validateCredentials } from "@/lib/validateCredentials";

function isInvalidCredentialsError(error) {
  return (
    error instanceof AuthError ||
    error?.name === "CredentialsSignin" ||
    error?.type === "CredentialsSignin" ||
    error?.code === "credentials"
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const validation = await validateCredentials(email, password);
    if (!validation.ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    await writeAuditLog({
      userId: validation.user.id,
      action: ACTIONS.USER_LOGIN,
      model: "User",
      recordId: validation.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isInvalidCredentialsError(error)) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    console.error("POST /api/auth/login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
