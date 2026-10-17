import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnrichmentStatus } from "@/lib/supplement-enrichment";

/** Enrichment progress + jobs, and each record's profile state (for list badges). ?kind=supplement|medication */
const kindOf = (v: unknown): "supplement" | "medication" => (v === "medication" ? "medication" : "supplement");

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const kind = kindOf(req.nextUrl.searchParams.get("kind"));
  const [status, profiles] = await Promise.all([
    getEnrichmentStatus(kind),
    db.supplementProfile.findMany({
      where: { tag: { kind } },
      select: {
        tagId: true, status: true, enrichmentVersion: true, completeness: true,
        _count: { select: { safetyItems: { where: { verificationStatus: "unverified" } }, fieldReviews: { where: { verificationStatus: "conflict" } } } },
      },
    }),
  ]);
  return NextResponse.json({
    status,
    statuses: Object.fromEntries(profiles.map((p) => [p.tagId, {
      status: p.status, sourced: p.enrichmentVersion >= 2, completeness: p.completeness,
      pendingReview: p._count.safetyItems + p._count.fieldReviews,
    }])),
  });
}
