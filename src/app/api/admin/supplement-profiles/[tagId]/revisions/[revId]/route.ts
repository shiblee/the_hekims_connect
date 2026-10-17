import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { parseJson, snapshotView, currentSnapshot, type ProfileSnapshot } from "@/lib/supplement-profile-store";

/** A revision and the current profile, flattened for side-by-side compare. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tagId: string; revId: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tagId, revId } = await params;
  const rev = await db.supplementProfileRevision.findUnique({ where: { id: revId }, include: { profile: { select: { tagId: true } } } });
  if (!rev || rev.profile.tagId !== tagId) return NextResponse.json({ error: "Revision not found" }, { status: 404 });

  const current = await currentSnapshot(rev.profileId);
  const before = parseJson<ProfileSnapshot | null>(rev.snapshot, null);
  if (!before || !current) return NextResponse.json({ error: "Revision is unreadable" }, { status: 422 });
  return NextResponse.json({ revision: { id: rev.id, createdAt: rev.createdAt, reason: rev.reason }, before: snapshotView(before), current: snapshotView(current) });
}
