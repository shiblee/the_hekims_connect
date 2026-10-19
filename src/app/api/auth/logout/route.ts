import { NextRequest, NextResponse } from "next/server";
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
  return NextResponse.json({ success: true });
}
