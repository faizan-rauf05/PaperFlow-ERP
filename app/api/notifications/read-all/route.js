import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { markAllNotificationsRead } from "@/lib/services/notification.service";

export async function PATCH() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    await markAllNotificationsRead(authResult.session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/notifications/read-all error:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
