import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { getCdsConfig, runCdsEngine } from "@/lib/cds-engine";

async function guard(req: NextRequest, id: string) {
  const actor = await getClinicActor(req);
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  // Doctors only: the clinic account, or staff whose role / designation is a clinician.
  if (actor.type === "staff") {
    const st = await db.staff.findUnique({ where: { id: actor.id }, select: { role: true, designation: true } });
    if (!DOCTOR.test(`${st?.role || ""} ${st?.designation || ""}`)) return { error: NextResponse.json({ error: "Clinical decision support is available to doctors only", doctorsOnly: true }, { status: 403 }) };
  }
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { actor };
}

const DOCTOR = /hakim|hakeem|doctor|physician|medical officer|\bbums\b|\bmd\b|\bmbbs\b|consultant/i;

/**
 * Clinical decision support for this visit (clinic staff only). Returns
 * { enabled:false } while the pilot is switched off in Admin. Each run is
 * stored as a new session (history kept); prior doctor decisions are returned.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await guard(req, id);
  if (error) return error;
  const cfg = await getCdsConfig();
  if (!cfg.enabled) return NextResponse.json({ enabled: false });
  const r = await runCdsEngine(id, actor!.facilityId);
  if (!r) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const last = await db.cdsSession.findFirst({ where: { visitId: id }, orderBy: { createdAt: "desc" }, select: { id: true, contextHash: true, configVersion: true } });
  // Re-use the latest session when nothing relevant changed; otherwise start a new one (old ones are kept).
  const session = last && last.contextHash === r.contextHash && last.configVersion === r.configVersion
    ? await db.cdsSession.update({ where: { id: last.id }, data: { result: JSON.stringify(r.result), method: r.method, latencyMs: r.latencyMs } })
    : await db.cdsSession.create({ data: { visitId: id, contextHash: r.contextHash, configVersion: r.configVersion, method: r.method, context: JSON.stringify(r.context), result: JSON.stringify(r.result), latencyMs: r.latencyMs } });
  const decisions = await db.cdsDecision.findMany({ where: { visitId: id }, orderBy: { createdAt: "asc" }, select: { tagId: true, label: true, action: true, reason: true, createdAt: true } });
  return NextResponse.json({ enabled: true, sessionId: session.id, method: r.method, result: r.result, changed: !!last && last.contextHash !== r.contextHash, decisions });
}

const ACTIONS = new Set(["considered", "accepted", "rejected", "added_to_prescription"]);

/** Body { sessionId, tagId, label, action, reason? } — the doctor's action on a candidate (audited). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await guard(req, id);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  if (!ACTIONS.has(b.action) || typeof b.tagId !== "string" || typeof b.sessionId !== "string") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  if (b.action === "rejected" && !(typeof b.reason === "string" && b.reason.trim())) return NextResponse.json({ error: "Give a reason for rejecting" }, { status: 400 });
  const session = await db.cdsSession.findFirst({ where: { id: b.sessionId, visitId: id }, select: { id: true } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  const d = await db.cdsDecision.create({
    data: {
      sessionId: session.id, visitId: id, tagId: b.tagId, label: String(b.label || "").slice(0, 200), action: b.action,
      reason: typeof b.reason === "string" ? b.reason.trim().slice(0, 500) || null : null,
      actorId: actor!.type === "staff" ? actor!.id : actor!.facilityId, actorType: actor!.type,
    },
  });
  return NextResponse.json({ decision: d });
}
