import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { getAuthUser } from "@/lib/api-auth";
import { logClinicEvent } from "@/lib/clinic-audit";
import { computeSafetyReview } from "@/lib/safety-review";

/** The visit's safety review: every high / caution item, with any acknowledgement. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await computeSafetyReview(id, actor.facilityId);
  if (!r) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  return NextResponse.json(r);
}

/** Body { key, reason } — acknowledge a safety item with the reason for continuing; { key, remove: true } withdraws it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const review = await computeSafetyReview(id, actor.facilityId);
  if (!review) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const item = review.items.find((i) => i.key === b.key);
  if (!item) return NextResponse.json({ error: "This safety item no longer applies — refresh the list" }, { status: 404 });
  if (b.remove) {
    await db.safetyAcknowledgement.deleteMany({ where: { visitId: id, key: item.key } });
  } else {
    const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
    if (reason.length < 3) return NextResponse.json({ error: "Give the reason for continuing" }, { status: 400 });
    const text = item.text ? `${item.medicine ? `${item.medicine}: ` : ""}${item.text}` : `${item.alertKey}${item.params ? ` ${JSON.stringify(item.params)}` : ""}`;
    await db.safetyAcknowledgement.upsert({
      where: { visitId_key: { visitId: id, key: item.key } },
      create: { visitId: id, key: item.key, level: item.level, text: text.slice(0, 1000), reason, byName: actor.name, byStaffId: actor.type === "staff" ? actor.id : null },
      update: { reason, byName: actor.name, byStaffId: actor.type === "staff" ? actor.id : null, text: text.slice(0, 1000) },
    });
    const auth = await getAuthUser(req);
    const v = await db.visit.findUnique({ where: { id }, select: { visitCode: true, patient: { select: { name: true } } } });
    if (auth) await logClinicEvent(req, auth, { action: "safety.acknowledged", summary: `Acknowledged a ${item.level} safety item for ${v?.visitCode} · ${v?.patient.name}: ${text.slice(0, 160)} — ${reason}`, entityType: "visit", entityId: id, entityLabel: `${v?.visitCode} · ${v?.patient.name}` });
  }
  const r = await computeSafetyReview(id, actor.facilityId);
  return NextResponse.json(r);
}
