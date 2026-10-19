import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { sortByLabel } from "@/lib/sort-options";

/** Active "Onset Nature & Rhythm" options for Stage 3. */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const patterns = await db.onsetPatternTag.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, description: true },
  });
  return NextResponse.json({ patterns: sortByLabel(patterns) });
}
