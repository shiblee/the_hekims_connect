import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { PRIORITIES } from "@/lib/tashkhees";
import { getAuthUser } from "@/lib/api-auth";
import { logClinicEvent } from "@/lib/clinic-audit";

const parse = <T,>(s: string | null | undefined, fallback: T): T => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
const str = (v: unknown, max = 4000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const strArr = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()))] : []);

async function visitFor(req: NextRequest, id: string) {
  const actor = await getClinicActor(req);
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { actor };
}

function serialize(d: NonNullable<Awaited<ReturnType<typeof load>>>) {
  return {
    status: d.status, finalizedAt: d.finalizedAt, finalizedByName: d.finalizedByName, updatedAt: d.updatedAt,
    mizajAsli: d.mizajAsli, suMizajType: d.suMizajType, suMizajQuality: d.suMizajQuality, suMizajGrade: d.suMizajGrade,
    organs: parse<string[]>(d.organs, []), diagnosisNote: d.diagnosisNote,
    usool: parse<string[]>(d.usool, []), usoolNote: d.usoolNote,
    ghizaRecommended: parse<string[]>(d.ghizaRecommended, []), ghizaAvoid: parse<string[]>(d.ghizaAvoid, []), ghizaNote: d.ghizaNote,
    tadbeer: parse<unknown[]>(d.tadbeer, []),
    prescriptions: d.prescriptions.map((p) => ({ tagId: p.tagId, name: p.name, form: p.form ?? "", dose: p.dose ?? "", timing: p.timing ?? "", duration: p.duration ?? "", adjuvant: p.adjuvant ?? "", instructions: p.instructions ?? "" })),
    prognosis: d.prognosis, followUpDate: d.followUpDate, followUpNote: d.followUpNote,
    urgentDirectives: d.urgentDirectives, priority: d.priority, handoverNote: d.handoverNote,
    revision: d.revision,
    versions: d.versions.map((v) => ({ version: v.version, kind: v.kind, reason: v.reason, byName: v.byName, createdAt: v.createdAt })),
  };
}
const load = (visitId: string) => db.tashkheesDossier.findUnique({
  where: { visitId },
  include: { prescriptions: { orderBy: { sortOrder: "asc" } }, versions: { orderBy: { version: "desc" }, select: { version: true, kind: true, reason: true, byName: true, createdAt: true } } },
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await visitFor(req, id);
  if (error) return error;
  const d = await load(id);
  return NextResponse.json({ dossier: d && serialize(d) });
}

/**
 * Body: the dossier fields, plus { finalize?: true, revision?: number, amendReason?: string }.
 * Finalising needs Mizaj-e-Asli and the Su-e-Mizaj quality, and stores a numbered version.
 * A finalised dossier is changed only by amending it (finalize + a reason) — never by a draft save.
 * A save based on an older revision than the stored one is refused, so two people can't overwrite each other.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await visitFor(req, id);
  if (error) return error;
  const b = await req.json().catch(() => ({}));

  const grade = Number(b.suMizajGrade);
  const data = {
    mizajAsli: str(b.mizajAsli, 120), suMizajType: b.suMizajType === "Sada" || b.suMizajType === "Maddi" ? b.suMizajType : null,
    suMizajQuality: str(b.suMizajQuality, 120), suMizajGrade: Number.isInteger(grade) && grade >= 1 && grade <= 4 ? grade : null,
    organs: JSON.stringify(strArr(b.organs)), diagnosisNote: str(b.diagnosisNote),
    usool: JSON.stringify(strArr(b.usool)), usoolNote: str(b.usoolNote),
    ghizaRecommended: JSON.stringify(strArr(b.ghizaRecommended)), ghizaAvoid: JSON.stringify(strArr(b.ghizaAvoid)), ghizaNote: str(b.ghizaNote),
    tadbeer: JSON.stringify((Array.isArray(b.tadbeer) ? b.tadbeer : [])
      .filter((t: any) => str(t?.label))
      .map((t: any) => ({ label: str(t.label, 160), frequency: str(t.frequency, 160) ?? "", duration: str(t.duration, 160) ?? "", notes: str(t.notes, 1000) ?? "" }))),
    prognosis: str(b.prognosis, 120),
    followUpDate: typeof b.followUpDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.followUpDate) ? new Date(`${b.followUpDate}T00:00:00Z`) : null,
    followUpNote: str(b.followUpNote), urgentDirectives: str(b.urgentDirectives),
    priority: PRIORITIES.some((p) => p.value === b.priority) ? b.priority : "routine",
    handoverNote: str(b.handoverNote, 8000),
    recordedById: actor!.type === "staff" ? actor!.id : null,
  };
  const prescriptions = (Array.isArray(b.prescriptions) ? b.prescriptions : [])
    .filter((p: any) => str(p?.name))
    .slice(0, 40)
    .map((p: any, i: number) => ({
      tagId: str(p.tagId, 60), name: str(p.name, 200)!, form: str(p.form, 80), dose: str(p.dose, 120), timing: str(p.timing, 120),
      duration: str(p.duration, 80), adjuvant: str(p.adjuvant, 160), instructions: str(p.instructions, 1000), sortOrder: i,
    }));

  if (b.finalize) {
    const missing = [!data.mizajAsli && "Mizaj-e-Asli", !data.suMizajQuality && "Su-e-Mizaj"].filter(Boolean);
    if (missing.length) return NextResponse.json({ error: `Record the ${missing.join(" and ")} before finalising` }, { status: 400 });
  }
  const existing = await db.tashkheesDossier.findUnique({ where: { visitId: id }, select: { id: true, status: true, revision: true } });
  if (existing && typeof b.revision === "number" && b.revision !== existing.revision) {
    return NextResponse.json({ error: "Someone else saved this dossier after you opened it. Reload to see their changes, then save again.", conflict: true }, { status: 409 });
  }
  const amending = existing?.status === "finalized";
  const amendReason = str(b.amendReason, 500);
  if (amending && !b.finalize) return NextResponse.json({ error: "This dossier is finalised. Use Amend to change it." }, { status: 409 });
  if (amending && (!amendReason || amendReason.length < 3)) return NextResponse.json({ error: "Give a reason for the amendment" }, { status: 400 });
  const finalize = b.finalize ? { status: "finalized", finalizedAt: new Date(), finalizedByName: actor!.name } : {};

  const saved = await db.$transaction(async (tx) => {
    const d = await tx.tashkheesDossier.upsert({
      where: { visitId: id }, update: { ...data, ...finalize, revision: { increment: 1 } }, create: { visitId: id, ...data, ...finalize, revision: 1 },
    });
    await tx.dossierPrescription.deleteMany({ where: { dossierId: d.id } });
    if (prescriptions.length) await tx.dossierPrescription.createMany({ data: prescriptions.map((p: any) => ({ ...p, dossierId: d.id })) });
    return d;
  });
  let d = await load(id);
  if (b.finalize && d) {
    const version = (d.versions[0]?.version ?? 0) + 1;
    await db.dossierVersion.create({
      data: {
        dossierId: saved.id, version, kind: amending ? "amended" : "finalized", reason: amending ? amendReason : null,
        snapshot: JSON.stringify(serialize(d)), byName: actor!.name, byStaffId: actor!.type === "staff" ? actor!.id : null,
      },
    });
    const v = await db.visit.findUnique({ where: { id }, select: { visitCode: true, patient: { select: { name: true } } } });
    const auth = await getAuthUser(req);
    const label = `${v?.visitCode ?? ""} · ${v?.patient.name ?? ""}`;
    if (auth) {
      await logClinicEvent(req, auth, amending
        ? { action: "dossier.amended", summary: `Amended the Tashkhees dossier (v${version}) for ${label}: ${amendReason}`, entityType: "visit", entityId: id, entityLabel: label, details: { version, reason: amendReason } }
        : { action: "dossier.finalized", summary: `Finalised the Tashkhees dossier (v${version}) for ${label}`, entityType: "visit", entityId: id, entityLabel: label, details: { version } });
    }
    d = await load(id);
  }
  return NextResponse.json({ dossier: d && serialize(d) });
}
