import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await db.adminSession.update({
    where: { id: session.sessionId },
    data: { logoutAt: new Date(), logoutType: "manual" },
  });
  await logAdminActivity(session.admin.id, "logout", "Signed out", getClientIp(req));

  return NextResponse.json({ success: true });
}
