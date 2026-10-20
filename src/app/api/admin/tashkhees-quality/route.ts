import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const parse = <T,>(raw: string | null | undefined, fb: T): T => { try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; } };

/** Stage 5 quality: how dossiers, the engines, the AI assistant and the safety review are used and how well they agree with Hakims. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [dossiers, versions, returned, diagnoses, runs, feedback, suggestions, acks, catalogue] = await Promise.all([
    db.tashkheesDossier.groupBy({ by: ["status"], _count: { _all: true } }),
    db.dossierVersion.groupBy({ by: ["kind"], _count: { _all: true } }),
    db.facilityAuditEvent.count({ where: { action: "dossier.returned" } }),
    db.dossierDiagnosis.findMany({ where: { role: "working", dossier: { status: "finalized" } }, select: { label: true, marzId: true, source: true, dossier: { select: { visitId: true } } } }),
    db.aiReasoningRun.findMany({ select: { visitId: true, status: true, mode: true, latencyMs: true, inputTokens: true, outputTokens: true, output: true, removed: true, createdAt: true } }),
    db.aiFeedback.groupBy({ by: ["rating"], _count: { _all: true } }),
    db.tashkheesSuggestion.findMany({ select: { accepted: true } }),
    db.safetyAcknowledgement.groupBy({ by: ["level"], _count: { _all: true } }),
    db.marzEntry.groupBy({ by: ["reviewStatus"], _count: { _all: true } }),
  ]);

  // AI agreement: for visits with a finalised working diagnosis, was it among the assistant's top 3?
  const workingByVisit = new Map(diagnoses.map((d) => [d.dossier.visitId, d.marzId]));
  let judged = 0, hits = 0;
  const removedReasons = new Map<string, number>();
  for (const r of runs) {
    for (const x of parse<{ why: string }[]>(r.removed, [])) removedReasons.set(x.why, (removedReasons.get(x.why) ?? 0) + 1);
    const w = workingByVisit.get(r.visitId);
    if (r.status !== "ok" || !w) continue;
    judged++;
    const keys = parse<{ differentials?: { marzId: string }[] }>(r.output, {}).differentials?.slice(0, 3).map((d) => d.marzId) ?? [];
    if (keys.includes(w)) hits++;
  }
  const ok = runs.filter((r) => r.status === "ok");
  const top = new Map<string, number>();
  for (const d of diagnoses) top.set(d.label, (top.get(d.label) ?? 0) + 1);
  const accepted = suggestions.filter((s) => Object.keys(parse(s.accepted, {})).length > 0).length;

  return NextResponse.json({
    dossiers: Object.fromEntries(dossiers.map((d) => [d.status, d._count._all])),
    versions: Object.fromEntries(versions.map((v) => [v.kind, v._count._all])),
    returned,
    working: { total: diagnoses.length, fromCatalogue: diagnoses.filter((d) => d.marzId).length, bySource: { hakim: diagnoses.filter((d) => d.source === "hakim").length, engine: diagnoses.filter((d) => d.source === "engine").length, ai: diagnoses.filter((d) => d.source === "ai").length } },
    topDiagnoses: [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, count]) => ({ label, count })),
    ai: {
      runs: runs.length, failed: runs.length - ok.length, deep: runs.filter((r) => r.mode === "deep").length,
      avgLatencyMs: ok.length ? Math.round(ok.reduce((n, r) => n + (r.latencyMs ?? 0), 0) / ok.length) : null,
      inputTokens: ok.reduce((n, r) => n + (r.inputTokens ?? 0), 0), outputTokens: ok.reduce((n, r) => n + (r.outputTokens ?? 0), 0),
      feedback: Object.fromEntries(feedback.map((f) => [f.rating, f._count._all])),
      agreement: { judged, top3: hits },
      removed: [...removedReasons.entries()].sort((a, b) => b[1] - a[1]).map(([why, count]) => ({ why, count })),
    },
    engine: { runs: suggestions.length, accepted },
    safety: Object.fromEntries(acks.map((a) => [a.level, a._count._all])),
    catalogue: Object.fromEntries(catalogue.map((c) => [c.reviewStatus, c._count._all])),
  });
}
