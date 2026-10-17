import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { loadFullProfile, serializeProfile, parseJson } from "@/lib/supplement-profile-store";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tagId } = await params;
  const tag = await db.medicationTag.findUnique({ where: { id: tagId }, select: { id: true, label: true, kind: true } });
  if (!tag || (tag.kind !== "supplement" && tag.kind !== "medication")) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const [profile, openJobs] = await Promise.all([
    loadFullProfile({ tagId }),
    db.supplementEnrichmentJob.findMany({ where: { status: { in: ["running", "paused"] } }, select: { tagIds: true, processedIds: true, failedItems: true } }),
  ]);
  const queued = openJobs.some((j) =>
    parseJson<string[]>(j.tagIds, []).includes(tagId)
    && !parseJson<string[]>(j.processedIds, []).includes(tagId)
    && !parseJson<{ tagId: string }[]>(j.failedItems, []).some((f) => f.tagId === tagId));

  const revisions = profile
    ? await db.supplementProfileRevision.findMany({
        where: { profileId: profile.id }, orderBy: { createdAt: "desc" }, take: 30,
        select: { id: true, reason: true, summary: true, actorId: true, createdAt: true },
      })
    : [];
  const actorIds = [...new Set(revisions.map((r) => r.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await db.admin.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];

  return NextResponse.json({
    tag, queued,
    profile: profile && serializeProfile(profile),
    revisions: revisions.map((r) => ({ ...r, actorName: actors.find((a) => a.id === r.actorId)?.name ?? null })),
  });
}
