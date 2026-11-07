import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { sortByLabel } from "@/lib/sort-options";
import { pendingRequests } from "@/lib/master-requests";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allergies = await db.allergyTag.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true, synonyms: true } });
  // This clinic's own allergens still waiting for review.
  const pending = auth.type === "facility" ? await pendingRequests("allergy", auth.id) : [];
  return NextResponse.json({ allergies: sortByLabel(allergies), pending });
}
