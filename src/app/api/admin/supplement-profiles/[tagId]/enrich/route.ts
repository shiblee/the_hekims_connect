import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { createEnrichmentJob } from "@/lib/supplement-enrichment";

/**
 * Queues a search-backed refresh of one supplement. Runs in the background
 * (a single item takes 1-2 minutes) — the profile dialog polls until done.
 * Verified and rejected claims are kept as they are.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tagId } = await params;
  const tag = await db.medicationTag.findUnique({ where: { id: tagId }, select: { label: true, kind: true } });
  if (!tag || (tag.kind !== "supplement" && tag.kind !== "medication")) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const job = await createEnrichmentJob("single", [tagId], session.admin.id, tag.kind);
  await logAdminActivity(
    session.admin.id, "supplement_profile_enriched",
    `Queued a search-backed refresh of the ${tag.kind === "medication" ? "medication" : "Unani"} profile for "${tag.label}"`,
    getClientIp(req)
  );
  return NextResponse.json({ jobId: job?.id ?? null });
}
