import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { bankVersionOf, buildDalailContext, contextHashOf, loadDalailBank, selectDalailQuestions } from "@/lib/dalail-engine";

const parse = <T,>(raw: string | null | undefined, fallback: T): T => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };

async function guard(req: NextRequest, id: string) {
  const actor = await getClinicActor(req);
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { actor };
}

/**
 * The Dala'il questions selected for this visit. Re-selects only when the
 * recorded context (complaints, symptoms, regions, onset, vitals) or the
 * approved question bank has changed since the last selection — otherwise the
 * stored selection is returned, so the list is stable while the doctor works.
 * `newIds` lists questions that joined on the latest re-selection.
 */
async function selection(visitId: string, facilityId: string, force: boolean) {
  const [ctx, bank, existing] = await Promise.all([
    buildDalailContext(visitId, facilityId),
    loadDalailBank(),
    db.dalailSelection.findUnique({ where: { visitId } }),
  ]);
  if (!ctx) return null;
  const ctxHash = contextHashOf(ctx);
  const bankVersion = bankVersionOf(bank);
  let row = existing;
  let newIds: string[] = [];
  if (force || !row || row.contextHash !== ctxHash || row.bankVersion !== bankVersion) {
    const r = await selectDalailQuestions(ctx, bank);
    const prev = parse<string[]>(row?.questionIds, []);
    newIds = row ? r.questionIds.filter((id) => !prev.includes(id)) : [];
    const data = {
      questionIds: JSON.stringify(r.questionIds), reasons: JSON.stringify(r.reasons), method: r.method,
      bankVersion: r.bankVersion, contextHash: r.contextHash, eligibleCount: r.eligibleCount, latencyMs: r.latencyMs,
    };
    row = await db.dalailSelection.upsert({ where: { visitId }, create: { visitId, ...data }, update: data });
  }
  return {
    questionIds: parse<string[]>(row.questionIds, []),
    reasons: parse<Record<string, string>>(row.reasons, {}),
    addedIds: parse<string[]>(row.addedIds, []),
    newIds,
    method: row.method,
    eligibleCount: row.eligibleCount,
    bankSize: bank.length,
    safetyIds: bank.filter((q) => q.safetyCritical).map((q) => q.id),
    context: {
      complaints: ctx.complaints.map((c) => ({ label: c.label, primary: c.primary })),
      symptoms: ctx.symptoms,
      regions: ctx.regions.map((r) => r.label),
    },
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await guard(req, id);
  if (error) return error;
  const s = await selection(id, actor!.facilityId, req.nextUrl.searchParams.get("refresh") === "1");
  if (!s) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  return NextResponse.json({ selection: s });
}

/** Body { add?: questionId, remove?: questionId } — the doctor's own additions ("+ Add a question"). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await guard(req, id);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const q = typeof (b.add || b.remove) === "string"
    ? await db.asbabQuestion.findFirst({ where: { id: b.add || b.remove, active: true, reviewStatus: "approved", pillar: { framework: "dalail", active: true } }, select: { id: true } })
    : null;
  if (!q) return NextResponse.json({ error: "Question not found" }, { status: 400 });
  await selection(id, actor!.facilityId, false); // make sure a selection row exists
  const row = await db.dalailSelection.findUnique({ where: { visitId: id } });
  const added = parse<string[]>(row?.addedIds, []);
  const next = b.add ? [...new Set([...added, q.id])] : added.filter((x) => x !== q.id);
  await db.dalailSelection.update({ where: { visitId: id }, data: { addedIds: JSON.stringify(next) } });
  return NextResponse.json({ addedIds: next });
}
