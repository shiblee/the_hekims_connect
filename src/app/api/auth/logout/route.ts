import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

/** Closes the most recent still-open session for the authenticated Facility/Patient. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where = auth.type === "facility" ? { facilityId: auth.id } : { patientId: auth.id };
  const openSession = await db.userSession.findFirst({
    where: { ...where, logoutAt: null },
    orderBy: { loginAt: "desc" },
  });

  if (openSession) {
    await db.userSession.update({
      where: { id: openSession.id },
      data: { logoutAt: new Date(), logoutType: "manual" },
    });
  }

  return NextResponse.json({ success: true });
}
