import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { createEnrichmentJob, pickPilotItems } from "@/lib/supplement-enrichment";

/**
 * Starts an enrichment job. Body { mode: "pilot" } re-researches up to 8
 * representative not-yet-sourced items; { mode: "batch" } queues every
 * remaining not-yet-sourced or failed item. Jobs run in the background and
 * can be paused/resumed/cancelled via /jobs/[id].
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { mode, kind: rawKind } = await req.json().catch(() => ({}));
  const kind = rawKind === "medication" ? "medication" : "supplement";
  const noun = kind === "medication" ? "allopathic medicines" : "Unani medicines";
  const open = await db.supplementEnrichmentJob.count({ where: { kind, mode: { in: ["pilot", "batch"] }, status: { in: ["running", "paused"] } } });
  if (open) return NextResponse.json({ error: "A pilot or batch run is already in progress — pause or cancel it first." }, { status: 409 });

  let tagIds: string[];
  if (mode === "pilot") {
    tagIds = (await pickPilotItems(kind)).map((t) => t.id);
  } else if (mode === "batch") {
    const remaining = await db.medicationTag.findMany({
      where: { kind, OR: [{ profile: null }, { profile: { enrichmentVersion: { lt: 2 } } }, { profile: { status: "failed" } }] },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    tagIds = remaining.map((t) => t.id);
  } else {
    return NextResponse.json({ error: "mode must be \"pilot\" or \"batch\"" }, { status: 400 });
  }
  if (!tagIds.length) return NextResponse.json({ error: "Nothing left to enrich" }, { status: 400 });

  const job = await createEnrichmentJob(mode, tagIds, session.admin.id, kind);
  await logAdminActivity(
    session.admin.id, "supplement_enrichment_job",
    `Started a search-backed ${mode === "pilot" ? "pilot" : "batch"} enrichment of ${tagIds.length} ${noun}`,
    getClientIp(req)
  );
  return NextResponse.json({ jobId: job?.id, count: tagIds.length });
}
