import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { buildCaseContext } from "@/lib/case-context";
import { computeDifferentials } from "@/lib/differential-engine";
import { loadCatalogue, loadDalailQuestions } from "@/lib/amraz";
import { runTashkheesEngine } from "@/lib/tashkhees-engine";
import { claudeMessage, extractJson, reasoningStatusFor, type ClaudeMode } from "@/lib/claude";
import { buildReasoningInput, inputHash, PROMPT_VERSION, SYSTEM_PROMPT, validateReasoning } from "@/lib/reasoning-engine";

const parse = <T,>(raw: string | null | undefined, fb: T): T => { try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; } };
const MAX_RUNS_PER_DAY = 10;

const view = (r: { id: string; output: string; removed: string; model: string; mode: string; createdAt: Date; createdByName: string | null; latencyMs: number | null; feedback?: { rating: string }[] }) => ({
  id: r.id, output: parse(r.output, {}), removed: parse<unknown[]>(r.removed, []), model: r.model, mode: r.mode, createdAt: r.createdAt, by: r.createdByName, latencyMs: r.latencyMs,
  feedback: r.feedback?.[0]?.rating ?? null,
});

/** The latest reasoning run for the visit, and whether the assistant is available. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const [status, run] = await Promise.all([
    reasoningStatusFor(actor.facilityId),
    db.aiReasoningRun.findFirst({ where: { visitId: id, status: "ok" }, orderBy: { createdAt: "desc" }, include: { feedback: { where: { byName: actor.name }, orderBy: { createdAt: "desc" }, take: 1, select: { rating: true } } } }),
  ]);
  return NextResponse.json({ status, run: run ? view(run) : null });
}

/**
 * Body { mode?: "standard" | "deep", force?: boolean } — runs the assistant on the saved record.
 * Body { feedback: { runId, rating, note? } } — the Hakim's verdict on a run.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  if (b.feedback) {
    const run = await db.aiReasoningRun.findFirst({ where: { id: String(b.feedback.runId || ""), visitId: id, facilityId: actor.facilityId }, select: { id: true } });
    if (!run) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
    const rating = ["useful", "incomplete", "wrong", "unsafe"].includes(b.feedback.rating) ? b.feedback.rating : null;
    if (!rating) return NextResponse.json({ error: "Unknown field" }, { status: 400 });
    await db.aiFeedback.create({ data: { runId: run.id, rating, note: typeof b.feedback.note === "string" ? b.feedback.note.trim().slice(0, 1000) || null : null, byName: actor.name, byStaffId: actor.type === "staff" ? actor.id : null } });
    return NextResponse.json({ ok: true });
  }

  if ((await reasoningStatusFor(actor.facilityId)) !== "on") return NextResponse.json({ error: "Clinical reasoning is switched off", off: true }, { status: 409 });
  const mode: ClaudeMode = b.mode === "deep" ? "deep" : "standard";
  const ctx = await buildCaseContext(id, actor.facilityId);
  if (!ctx) return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  const [catalogue, bank, dossierRow, engine, organs] = await Promise.all([
    loadCatalogue(), loadDalailQuestions(),
    db.tashkheesDossier.findUnique({ where: { visitId: id }, select: { mizajAsli: true, suMizajType: true, suMizajQuality: true, suMizajGrade: true, organs: true, sabab: true, treatmentResponse: true, treatmentResponseNote: true, diagnoses: { select: { label: true, role: true, certainty: true } } } }),
    runTashkheesEngine(id, actor.facilityId).catch(() => null),
    db.tashkheesOption.findMany({ where: { list: "organ", active: true }, select: { label: true } }),
  ]);
  const dossier = dossierRow ? { ...dossierRow, organs: parse<string[]>(dossierRow.organs, []), sabab: parse<string[]>(dossierRow.sabab, []) } : null;
  const basis = dossier?.suMizajQuality || dossier?.organs.length
    ? { suMizaj: dossier?.suMizajQuality ?? null, organs: dossier?.organs ?? [], from: "hakim" as const }
    : { suMizaj: engine?.suggestion.suMizaj?.label ?? null, organs: engine?.suggestion.organs.map((o) => o.label) ?? [], from: engine ? "engine" as const : "none" as const };
  const diff = computeDifferentials(ctx, catalogue, basis, bank);
  const input = buildReasoningInput(ctx, diff, engine?.suggestion ?? null, dossier, catalogue, organs.map((o) => o.label));
  const hash = inputHash({ input, mode, v: PROMPT_VERSION });

  // Same record, same mode, recently: reuse the run instead of paying for another.
  if (!b.force) {
    const recent = await db.aiReasoningRun.findFirst({ where: { visitId: id, contextHash: hash, status: "ok", createdAt: { gte: new Date(Date.now() - 86_400_000) } }, orderBy: { createdAt: "desc" } });
    if (recent) return NextResponse.json({ run: view(recent), reused: true });
  }
  const today = await db.aiReasoningRun.count({ where: { visitId: id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= MAX_RUNS_PER_DAY) return NextResponse.json({ error: "Reasoning has run 10 times for this visit today — try again tomorrow" }, { status: 429 });

  const result = await claudeMessage({ system: SYSTEM_PROMPT, user: `CASE:\n${JSON.stringify(input)}`, mode, maxTokens: mode === "deep" ? 6000 : 4000 });
  const base = { visitId: id, facilityId: actor.facilityId, mode, promptVersion: PROMPT_VERSION, contextHash: hash, input: JSON.stringify(input), createdByName: actor.name, createdById: actor.type === "staff" ? actor.id : null };
  if ("error" in result) {
    await db.aiReasoningRun.create({ data: { ...base, model: mode, status: "failed", error: result.error } });
    const msg = result.error === "quota" ? "The AI service has no credit left — ask the administrator" : result.error === "timeout" ? "The AI service took too long — try again" : result.error === "off" ? "Clinical reasoning is switched off" : "The AI service is unavailable right now — try again";
    return NextResponse.json({ error: msg, off: result.error === "off" }, { status: 503 });
  }
  const raw = extractJson<unknown>(result.text);
  if (!raw) {
    await db.aiReasoningRun.create({ data: { ...base, model: result.model, status: "failed", error: "unreadable", inputTokens: result.inputTokens, outputTokens: result.outputTokens, latencyMs: result.latencyMs } });
    return NextResponse.json({ error: "The AI answer couldn't be read — try again" }, { status: 502 });
  }
  const { output, removed } = validateReasoning(raw, input, catalogue);
  const run = await db.aiReasoningRun.create({
    data: { ...base, model: result.model, output: JSON.stringify(output), removed: JSON.stringify(removed), inputTokens: result.inputTokens, outputTokens: result.outputTokens, latencyMs: result.latencyMs },
  });
  return NextResponse.json({ run: view(run) });
}
