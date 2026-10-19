import { NextRequest, NextResponse } from "next/server";
import { logClinicEvent } from "@/lib/clinic-audit";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

/** Ends this login session — the token stops working at once — and records a manual logout. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || !auth.sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.userSession.update({
    where: { id: auth.sessionId },
    data: { logoutAt: new Date(), logoutType: "manual" },
  });
  await logClinicEvent(req, auth, { action: "auth.logout", summary: "Signed out", entityType: "session", entityId: auth.sessionId });
  return NextResponse.json({ success: true });
}
