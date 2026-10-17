import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

/** Active Anatomical Region & Organ System cards for the Stage 3 selector. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const regions = await db.anatomicalRegionTag.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, localTerms: true, icon: true, gender: true, bodyZone: true },
  });
  return NextResponse.json({ regions });
}
