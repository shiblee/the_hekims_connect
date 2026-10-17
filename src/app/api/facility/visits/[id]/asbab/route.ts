import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { loadAsbabConfig, toPillarCfg, frameworkOf } from "@/lib/asbab-server";
import { computeDrift, isAnswered, questionVisible, type AsbabAnswer } from "@/lib/asbab";

async function visitFor(req: NextRequest, id: string) {
  const actor = await getClinicActor(req);
  if (!actor) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const visit = await db.visit.findFirst({ where: { id, facilityId: actor.facilityId }, select: { id: true } });
  if (!visit) return { error: NextResponse.json({ error: "Visit not found" }, { status: 404 }) };
  return { actor };
}

const parse = <T,>(s: string, fallback: T): T => { try { return JSON.parse(s); } catch { return fallback; } };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await visitFor(req, id);
  if (error) return error;
  const framework = frameworkOf(req.nextUrl.searchParams.get("framework"));
  const [a, activeQuestions] = await Promise.all([
    db.asbabAssessment.findUnique({ where: { visitId_framework: { visitId: id, framework } }, include: { responses: true } }),
    db.asbabQuestion.findMany({ where: { active: true, pillar: { active: true, framework } }, select: { id: true } }),
  ]);
  const active = new Set(activeQuestions.map((q) => q.id));
  const isLive = (qid: string | null) => !!qid && active.has(qid);
  return NextResponse.json({
    assessment: a && {
      status: a.status, completedAt: a.completedAt, updatedAt: a.updatedAt,
      answers: Object.fromEntries(a.responses.filter((r) => isLive(r.questionId)).map((r) => [r.questionId!, parse<AsbabAnswer>(r.value, "")])),
      // Answers to questions since disabled — shown read-only (as recorded) so nothing is hidden.
      archived: a.responses.filter((r) => !isLive(r.questionId)).map((r) => ({ pillarKey: r.pillarKey, question: r.questionLabel, value: parse<AsbabAnswer>(r.value, "") })),
    },
  });
}

/** Body { answers: { [questionId]: string[] | string }, complete?: boolean } */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, error } = await visitFor(req, id);
  if (error) return error;
  const b = await req.json().catch(() => ({}));
  const framework = frameworkOf(req.nextUrl.searchParams.get("framework"));
  const incoming: Record<string, AsbabAnswer> = b.answers && typeof b.answers === "object" ? b.answers : {};
  const pillars = toPillarCfg(await loadAsbabConfig(true, framework));

  // Keep only answers to active questions, normalised to valid options.
  const answers: Record<string, AsbabAnswer> = {};
  for (const p of pillars) for (const q of p.questions) {
    const v = incoming[q.id];
    if (v === undefined) continue;
    if (q.type === "single_select" || q.type === "multi_select") {
      const labels = (Array.isArray(v) ? v : [v]).filter((x) => typeof x === "string" && q.options.some((o) => o.label === x));
      if (labels.length) answers[q.id] = q.type === "single_select" ? labels.slice(0, 1) : [...new Set(labels)];
    } else if (q.type === "numeric") {
      const n = Number(v);
      if (String(v).trim() !== "" && Number.isFinite(n)) answers[q.id] = String(n);
    } else if (typeof v === "string" && v.trim()) {
      answers[q.id] = v.trim().slice(0, 2000);
    }
  }

  if (b.complete) {
    const missing = pillars.flatMap((p) => p.questions
      .filter((q) => q.required && questionVisible(q, answers) && !isAnswered(answers[q.id]))
      .map((q) => `${p.label}: ${q.label}`));
    if (missing.length) return NextResponse.json({ error: `Answer the required questions first (${missing.length})`, missing }, { status: 400 });
  }

  const drift = computeDrift(pillars, answers);
  const qById = new Map(pillars.flatMap((p) => p.questions.map((q) => [q.id, { q, pillarKey: p.key }] as const)));

  await db.$transaction(async (tx) => {
    const assessment = await tx.asbabAssessment.upsert({
      where: { visitId_framework: { visitId: id, framework } },
      update: {
        humoral: JSON.stringify({ total: drift.total, percent: drift.percent, dominant: drift.dominant, pillars: drift.perPillar }),
        recordedById: actor!.type === "staff" ? actor!.id : null,
        ...(b.complete ? { status: "completed", completedAt: new Date() } : {}),
      },
      create: {
        visitId: id, framework,
        humoral: JSON.stringify({ total: drift.total, percent: drift.percent, dominant: drift.dominant, pillars: drift.perPillar }),
        recordedById: actor!.type === "staff" ? actor!.id : null,
        status: b.complete ? "completed" : "draft", completedAt: b.complete ? new Date() : null,
      },
    });
    // Replace answers to ACTIVE questions; answers to since-disabled questions are left untouched.
    const activeIds = [...qById.keys()];
    await tx.asbabResponse.deleteMany({ where: { assessmentId: assessment.id, questionId: { in: activeIds } } });
    for (const [qid, value] of Object.entries(answers)) {
      const { q, pillarKey } = qById.get(qid)!;
      const selected = Array.isArray(value) ? q.options.filter((o) => value.includes(o.label)) : [];
      await tx.asbabResponse.create({
        data: {
          assessmentId: assessment.id, questionId: qid, pillarKey, questionLabel: q.label, questionType: q.type,
          questionVersion: q.version, weight: q.weight, value: JSON.stringify(value),
          selectedOptions: JSON.stringify(selected.map((o) => ({ label: o.label, safra: o.safra, dam: o.dam, balgham: o.balgham, sauda: o.sauda }))),
        },
      });
    }
  });
  return NextResponse.json({ ok: true, status: b.complete ? "completed" : "draft", drift: { percent: drift.percent, dominant: drift.dominant } });
}
