import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { parseJson, restoreSnapshot, snapshotProfile, type ProfileSnapshot } from "@/lib/supplement-profile-store";

/** Restores a profile to a saved revision. The current state is snapshotted first, so a restore can itself be undone. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tagId: string; revId: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tagId, revId } = await params;
  const rev = await db.supplementProfileRevision.findUnique({ where: { id: revId }, include: { profile: { select: { tagId: true, tag: { select: { label: true } } } } } });
  if (!rev || rev.profile.tagId !== tagId) return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  const snap = parseJson<ProfileSnapshot | null>(rev.snapshot, null);
  if (!snap) return NextResponse.json({ error: "Revision is unreadable" }, { status: 422 });

  const when = rev.createdAt.toISOString().slice(0, 16).replace("T", " ");
  await db.$transaction(async (tx) => {
    await snapshotProfile(tx, rev.profileId, "restore", `Before restoring the version from ${when}`, session.admin.id);
    await restoreSnapshot(tx, rev.profileId, snap);
  }, { timeout: 60000, maxWait: 30000 });

  await logAdminActivity(session.admin.id, "supplement_profile_restored", `Restored the Unani profile of "${rev.profile.tag.label}" to its version from ${when} UTC`, getClientIp(req));
  return NextResponse.json({ ok: true });
}
