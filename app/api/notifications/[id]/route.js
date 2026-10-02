import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/apiAuth";
import { markNotificationRead } from "@/lib/services/notification.service";

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) {
      return NextResponse.json(authResult.error.body, { status: authResult.error.status });
    }

    const { id } = await params;
    await markNotificationRead(id, authResult.session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
