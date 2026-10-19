import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

const HFR_PATTERN = /^IN\d{10}$/;

/** ?hfr=IN0123456789 → { valid, available } — lets the profile form flag a taken HFR number as it's typed. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hfr = (req.nextUrl.searchParams.get("hfr") || "").trim().toUpperCase();
  if (!HFR_PATTERN.test(hfr)) return NextResponse.json({ valid: false, available: false });
  const taken = await db.facility.findFirst({ where: { hfrNumber: hfr, id: { not: auth.id } }, select: { id: true } });
  return NextResponse.json({ valid: true, available: !taken });
}
