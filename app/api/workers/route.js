import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrManager } from "@/lib/apiAuth";

/** Active workers for production order assignment. */
export async function GET() {
  try {
    const authResult = await requireAdminOrManager();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const workers = await prisma.user.findMany({
      where: { role: "WORKER", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ workers });
  } catch (error) {
    console.error("GET /api/workers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
