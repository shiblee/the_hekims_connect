import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildSupplementReport } from "@/lib/supplement-profile-store";

/** Data-quality & enrichment report with a record-level summary. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("kind") === "medication" ? "medication" : "supplement";
  return NextResponse.json(await buildSupplementReport(kind));
}
