import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { getNotifications, getUnreadCount } from "@/lib/services/notification.service";
import { serializeModel } from "@/lib/serialize";

export async function GET(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const userId = authResult.session.user.id;
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = Number(searchParams.get("limit")) || 20;

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(userId, { unreadOnly, limit }),
      getUnreadCount(userId),
    ]);

    return NextResponse.json({
      notifications: serializeModel(notifications),
      unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}
