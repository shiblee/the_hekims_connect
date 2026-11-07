import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { regimensForVisit } from "@/lib/mamool";

// Mamool-e-Matab for the prescription: approved, active regimens (their approved
// version only), with why each one matches this visit's chief complaints.
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const visitId = req.nextUrl.searchParams.get("visitId");
  if (visitId) {
    const v = await db.visit.findFirst({ where: { id: visitId, facilityId: auth.id }, select: { id: true } });
    if (!v) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }
  return NextResponse.json(await regimensForVisit(visitId));
}
