import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, {
        status: authResult.error.status,
      });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
    );
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const model = searchParams.get("model");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (model) where.model = model;

    if (from || to) {
      where.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        if (Number.isNaN(fromDate.getTime())) {
          return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
        }
        where.createdAt.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        if (Number.isNaN(toDate.getTime())) {
          return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
        }
        where.createdAt.lte = toDate;
      }
    }

    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      userId: log.userId,
      userName: log.user?.name ?? null,
      userEmail: log.user?.email ?? null,
      action: log.action,
      model: log.model,
      recordId: log.recordId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      createdAt: log.createdAt,
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      logs: formattedLogs,
      total,
      page,
      totalPages,
    });
  } catch (error) {
    console.error("GET /api/audit-logs error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
