// Stage 5 Tashkhees engine — suggests Mizaj-e-Asli, Su-e-Mizaj (quality, Sada /
// Maddi, Darja) and the affected organs from everything recorded for the
// visit, each with a confidence and the evidence behind it. It never decides:
// the Hakim accepts, changes or ignores each suggestion. All thresholds,
// weights, constitutional sections, morbid-matter signs and organ links are
// configured in Admin → Meta → Tashkhees & Ilaj → Tashkhees Engine.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { buildDalailContext, parseAppliesTo, type AppliesTo, type DalailContext } from "@/lib/dalail-engine";
import { rankTashkheesOrgans } from "@/lib/gemini";

export type Humour = "safra" | "dam" | "balgham" | "sauda";
export type Points = Record<Humour, number>;
const HUMOURS: Humour[] = ["safra", "dam", "balgham", "sauda"];
const HUMOUR_LABEL: Record<Humour, string> = { safra: "Safra", dam: "Dam", balgham: "Balgham", sauda: "Sauda" };
/** The compound temperament each humour's dominance indicates (option labels in the "mizaj" list). */
export const MIZAJ_OF: Record<Humour, string> = { safra: "Safrawi", dam: "Damawi", balgham: "Balghami", sauda: "Saudawi" };

export interface EngineConfig {
  /** assessment = the patient's Mizaj assessment (Stage 3), used for Mizaj-e-Asli only. */
  weights: { complaints: number; asbab: number; dalail: number; assessment: number };
  /** Sections (Dala'il or Asbab-e-Sittah keys) whose answers describe the constitution, for Mizaj-e-Asli. */
  constitutionalSections: string[];
  /** Minimum evidence (summed humoral points) before any temperament is suggested. */
  minEvidence: number;
  /** Lead (percentage points) of the top humour below which the picture is treated as balanced. */
  balancedMargin: number;
  /** Lead thresholds for Darja 2, 3 and 4 (below the first = Darja 1). */
  darjaBands: [number, number, number];
  /** Add one Darja when the primary complaint's severity is 7/10 or more. */
  severityBoost: boolean;
  /** Summed morbid-matter weight at which Su-e-Mizaj is suggested as Maddi. */
  maddiThreshold: number;
  maxOrgans: number;
  ranking: boolean;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  weights: { complaints: 1, asbab: 0.75, dalail: 1.25, assessment: 1 },
  constitutionalSections: ["zahiri", "nabz", "harkat_nafsani", "naum"],
  minEvidence: 3,
  balancedMargin: 8,
  darjaBands: [12, 22, 35],
  severityBoost: true,
  maddiThreshold: 2,
  maxOrgans: 4,
  ranking: true,
};

export async function getEngineConfig(): Promise<EngineConfig> {
  const row = await db.portalSetting.findUnique({ where: { category_key: { category: "tashkhees_engine", key: "config" } } }).catch(() => null);
  try {
    const v = JSON.parse(row?.value || "{}");
    return { ...DEFAULT_ENGINE_CONFIG, ...v, weights: { ...DEFAULT_ENGINE_CONFIG.weights, ...(v.weights || {}) } };
  } catch { return DEFAULT_ENGINE_CONFIG; }
}

const zero = (): Points => ({ safra: 0, dam: 0, balgham: 0, sauda: 0 });
const sum = (p: Points) => HUMOURS.reduce((n, h) => n + p[h], 0);
const pct = (p: Points): Points => { const s = sum(p); const o = zero(); if (s > 0) for (const h of HUMOURS) o[h] = Math.round((p[h] / s) * 1000) / 10; return o; };
const parse = <T,>(raw: string | null | undefined, fb: T): T => { try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; } };

export interface Evidence { label: string; humour: Humour; points: number }
export type ReadingKey = "complaints" | "asbab" | "dalail" | "assessment";
/** Sections that count as a core examination for Mizaj-e-Asli (pulse, physique / complexion). */
export const CORE_EXAM_SECTIONS = ["nabz", "zahiri"];
export interface TemperamentSuggestion {
  label: string | null; // option label, e.g. "Safrawi", "Haar", "Mu'tadil"
  humour: Humour | null;
  percent: Points;
  lead: number;
  confidence: "strong" | "moderate" | "weak";
  evidence: Evidence[];
  note?: string;
  /** The readings point to different humours — shown so the Hakim resolves it; label is null when nothing leads. */
  conflict?: { leans: { source: ReadingKey; humour: Humour }[] };
  /** Why confidence was capped: no examination at all, or no core examination (pulse / physique). */
  cap?: "no_exam" | "no_core_exam";
  /** Mizaj-e-Asli: the Stage 3 Mizaj assessment that was blended in. */
  assessment?: { percent: Points; date: string } | null;
}
export interface Suggestion {
  sources: { key: "complaints" | "asbab" | "dalail"; label: string; percent: Points | null; weight: number }[];
  mizajAsli: TemperamentSuggestion | null;
  suMizaj: (TemperamentSuggestion & { type: "Sada" | "Maddi"; maddiScore: number; maddiSigns: string[]; darja: number | null }) | null;
  organs: { label: string; reason: string; score: number }[];
  insufficient: string[]; // plain notes on what's missing
}

/** Classifies a humoral picture into a temperament option (compound, simple or balanced). */
function classify(points: Points, cfg: EngineConfig): { label: string | null; humour: Humour | null; percent: Points; lead: number } {
  const p = pct(points);
  const sorted = [...HUMOURS].sort((a, b) => p[b] - p[a]);
  const lead = p[sorted[0]] - p[sorted[1]];
  if (lead >= cfg.balancedMargin) return { label: MIZAJ_OF[sorted[0]], humour: sorted[0], percent: p, lead };
  // No single humour leads — check the hot/cold and moist/dry axes for a simple quality.
  const hot = p.safra + p.dam, cold = p.balgham + p.sauda, moist = p.dam + p.balgham, dry = p.safra + p.sauda;
  const hc = hot - cold, md = moist - dry;
  if (Math.max(Math.abs(hc), Math.abs(md)) >= cfg.balancedMargin * 2) {
    const label = Math.abs(hc) >= Math.abs(md) ? (hc > 0 ? "Haar" : "Barid") : (md > 0 ? "Ratab" : "Yabis");
    return { label, humour: null, percent: p, lead };
  }
  return { label: "Mu'tadil", humour: null, percent: p, lead };
}

/** Confidence from how clear the lead is, how many findings support it and how many readings agree. */
const confidenceOf = (lead: number, sources: number, findings: number): "strong" | "moderate" | "weak" =>
  lead >= 20 && sources >= 2 && findings >= 6 ? "strong" : lead >= 10 && findings >= 3 ? "moderate" : "weak";
/** A reading with only a few answers counts for less (full weight from ~6 answered findings). */
const evidenceFactor = (findings: number) => Math.min(1, findings / 6);
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Which humours support a suggested label (compound → its humour; simple quality → its two humours). */
const SUPPORT: Record<string, Humour[]> = {
  Safrawi: ["safra"], Damawi: ["dam"], Balghami: ["balgham"], Saudawi: ["sauda"],
  Haar: ["safra", "dam"], Barid: ["balgham", "sauda"], Ratab: ["dam", "balgham"], Yabis: ["safra", "sauda"],
};

export interface EngineInput {
  complaints: Points | null; // percentages from the complaint humoral assessment
  assessment?: { points: Points; date: string } | null; // latest Mizaj assessment for the patient (Stage 3)
  severity: number | null; // primary complaint severity
  responses: { framework: string; section: string; question: string; weight: number; options: { label: string; safra: number; dam: number; balgham: number; sauda: number; maddi: number }[] }[];
  ctx: DalailContext;
}

/** Loads the engine's inputs for a visit from saved records. */
export async function loadEngineInput(visitId: string, facilityId: string): Promise<EngineInput | null> {
  const [ctx, visit] = await Promise.all([
    buildDalailContext(visitId, facilityId),
    db.visit.findFirst({
      where: { id: visitId, facilityId },
      select: {
        humoralAssessment: { select: { safraPercent: true, damPercent: true, balghamPercent: true, saudaPercent: true } },
        complaintAssessments: { orderBy: { sortOrder: "asc" }, take: 1, select: { severityScore: true } },
        patientId: true,
        asbabAssessments: { select: { framework: true, responses: { select: { questionId: true, pillarKey: true, questionLabel: true, weight: true, selectedOptions: true } } } },
      },
    }),
  ]);
  if (!ctx || !visit) return null;
  const ma = await db.mizajAssessment.findFirst({ where: { patientId: visit.patientId, facilityId }, orderBy: { createdAt: "desc" }, select: { dam: true, saffra: true, balgham: true, sauda: true, createdAt: true } });
  // Current morbid-matter weights for the selected options (by question + label).
  const qIds = visit.asbabAssessments.flatMap((a) => a.responses.map((r) => r.questionId).filter(Boolean)) as string[];
  const opts = qIds.length ? await db.asbabOption.findMany({ where: { questionId: { in: qIds } }, select: { questionId: true, label: true, maddi: true } }) : [];
  const h = visit.humoralAssessment;
  return {
    complaints: h ? { safra: h.safraPercent, dam: h.damPercent, balgham: h.balghamPercent, sauda: h.saudaPercent } : null,
    assessment: ma && ma.dam + ma.saffra + ma.balgham + ma.sauda > 0 ? { points: { safra: ma.saffra, dam: ma.dam, balgham: ma.balgham, sauda: ma.sauda }, date: ma.createdAt.toISOString() } : null,
    severity: visit.complaintAssessments[0]?.severityScore ?? null,
    responses: visit.asbabAssessments.flatMap((a) => a.responses.map((r) => ({
      framework: a.framework, section: r.pillarKey, question: r.questionLabel, weight: r.weight || 1,
      options: parse<{ label: string; safra: number; dam: number; balgham: number; sauda: number }[]>(r.selectedOptions, []).map((o) => ({
        ...o, maddi: opts.find((x) => x.questionId === r.questionId && x.label === o.label)?.maddi ?? 0,
      })),
    }))),
    ctx,
  };
}

function pointsOf(responses: EngineInput["responses"]): { points: Points; evidence: Evidence[]; findings: number } {
  const points = zero();
  const findings = responses.filter((r) => r.options.some((o) => HUMOURS.some((h) => o[h]))).length;
  const evidence: Evidence[] = [];
  for (const r of responses) for (const o of r.options) {
    for (const h of HUMOURS) {
      const v = (o[h] || 0) * r.weight;
      if (!v) continue;
      points[h] += v;
      if (v > 0) evidence.push({ label: `${r.question}: ${o.label}`, humour: h, points: v });
    }
  }
  return { points, evidence, findings };
}

/** Pure scoring — easy to test; the API wraps it with loading, ranking and storage. */
export function computeSuggestion(input: EngineInput, cfg: EngineConfig, organOptions: { label: string; appliesTo: AppliesTo; priority: number }[]): Suggestion {
  const insufficient: string[] = [];
  const asbab = pointsOf(input.responses.filter((r) => r.framework === "asbab"));
  const dalail = pointsOf(input.responses.filter((r) => r.framework === "dalail"));
  const sources: Suggestion["sources"] = [
    { key: "complaints", label: "Complaint humoral assessment (Stages 2–3)", percent: input.complaints && sum(input.complaints) > 0 ? input.complaints : null, weight: cfg.weights.complaints },
    { key: "asbab", label: "Asbab-e-Sittah lifestyle (Stage 4)", percent: sum(asbab.points) > 0 ? pct(asbab.points) : null, weight: round1(cfg.weights.asbab * evidenceFactor(asbab.findings)) },
    { key: "dalail", label: "Dala'il clinical signs (Stage 5)", percent: sum(dalail.points) > 0 ? pct(dalail.points) : null, weight: round1(cfg.weights.dalail * evidenceFactor(dalail.findings)) },
  ];
  const findingsAll = asbab.findings + dalail.findings + (input.complaints ? 2 : 0);

  // ---- Su-e-Mizaj: weighted blend of the readings present
  let suMizaj: Suggestion["suMizaj"] = null;
  const present = sources.filter((s) => s.percent && s.weight > 0);
  const evidencePts = sum(asbab.points) + sum(dalail.points) + (input.complaints ? 5 : 0);
  if (!present.length || evidencePts < cfg.minEvidence) {
    insufficient.push("Not enough humoral evidence yet for Su-e-Mizaj — record complaints, Asbab-e-Sittah answers or Dala'il signs.");
  } else {
    const blend = zero();
    for (const s of present) for (const h of HUMOURS) blend[h] += s.percent![h] * s.weight;
    const c = classify(blend, cfg);
    const maddiSigns = input.responses.filter((r) => r.framework === "dalail").flatMap((r) => r.options.filter((o) => o.maddi > 0).map((o) => ({ label: `${r.question}: ${o.label}`, w: o.maddi })));
    const maddiScore = Math.round(maddiSigns.reduce((n, x) => n + x.w, 0) * 10) / 10;
    let darja: number | null = null;
    if (c.humour || (c.label && c.label !== "Mu'tadil")) {
      const [b2, b3, b4] = cfg.darjaBands;
      darja = c.lead >= b4 ? 4 : c.lead >= b3 ? 3 : c.lead >= b2 ? 2 : 1;
      if (cfg.severityBoost && (input.severity ?? 0) >= 7) darja = Math.min(4, darja + 1);
    }
    // Readings that each clearly lean one way, but to different humours, are a conflict — not balance.
    const leans = present.map((x) => {
      const sorted = [...HUMOURS].sort((a, b) => x.percent![b] - x.percent![a]);
      return { source: x.key as ReadingKey, humour: sorted[0], clear: x.percent![sorted[0]] - x.percent![sorted[1]] >= cfg.balancedMargin };
    }).filter((x) => x.clear).map(({ source, humour }) => ({ source, humour }));
    const conflict = new Set(leans.map((l) => l.humour)).size >= 2 ? { leans } : undefined;
    let confidence = confidenceOf(c.lead, present.length, findingsAll);
    // No examination yet, or the readings disagree: the suggestion can only be weak.
    const cap = dalail.findings === 0 ? "no_exam" as const : undefined;
    if (cap || conflict) confidence = "weak";
    // Thin evidence can't justify a high degree.
    if (darja != null) darja = Math.min(darja, confidence === "weak" ? 2 : confidence === "moderate" ? 3 : 4);
    const support = SUPPORT[c.label ?? ""] || [];
    const ev = support.length
      ? [...dalail.evidence, ...asbab.evidence].filter((e) => support.includes(e.humour)).sort((a, b) => b.points - a.points).slice(0, 5)
      : [];
    // Balanced: say why — usually the readings point different ways.
    const undetermined = c.label === "Mu'tadil" && !!conflict;
    const note = c.label === "Mu'tadil" && !conflict ? "The readings are evenly balanced. Review the examination before accepting." : undefined;
    suMizaj = {
      ...c, label: undetermined ? null : c.label, humour: undetermined ? null : c.humour, lead: round1(c.lead), darja: undetermined ? null : darja,
      type: maddiScore >= cfg.maddiThreshold ? "Maddi" : "Sada", maddiScore, maddiSigns: maddiSigns.map((x) => x.label),
      confidence, evidence: undetermined ? [] : ev, note, conflict, cap,
    };
  }

  // ---- Mizaj-e-Asli: constitutional sections, blended with the patient's Mizaj assessment (Stage 3) when there is one
  let mizajAsli: Suggestion["mizajAsli"] = null;
  const constiResponses = input.responses.filter((r) => cfg.constitutionalSections.includes(r.section));
  const consti = pointsOf(constiResponses);
  const constiOk = sum(consti.points) >= cfg.minEvidence;
  const assess = input.assessment && sum(input.assessment.points) > 0 ? input.assessment : null;
  if (!constiOk && !assess) {
    insufficient.push("Not enough constitutional signs for Mizaj-e-Asli — record complexion, build, skin, pulse, temperament or sleep findings.");
  } else {
    const blend = zero();
    if (constiOk) { const p = pct(consti.points); for (const h of HUMOURS) blend[h] += p[h] * Math.max(0.25, evidenceFactor(consti.findings)); }
    if (assess) { const p = pct(assess.points); for (const h of HUMOURS) blend[h] += p[h] * cfg.weights.assessment; }
    const c = classify(blend, cfg);
    const sections = new Set(constiResponses.filter((r) => r.options.length).map((r) => r.section)).size + (assess ? 1 : 0);
    let confidence = confidenceOf(c.lead, sections, consti.findings + (assess ? 3 : 0));
    // A constitution needs a core examination (pulse or physique) — or a formal Mizaj assessment.
    const coreExam = input.responses.some((r) => r.framework === "dalail" && CORE_EXAM_SECTIONS.includes(r.section) && r.options.length > 0);
    const cap = coreExam || assess ? undefined : dalail.findings === 0 ? "no_exam" as const : "no_core_exam" as const;
    if (cap) confidence = "weak";
    const support = SUPPORT[c.label ?? ""] || [];
    const evidence = consti.evidence.filter((e) => support.includes(e.humour)).sort((a, b) => b.points - a.points).slice(0, 5);
    if (assess && c.humour) evidence.unshift({ label: `Mizaj assessment: ${MIZAJ_OF[c.humour]} ${Math.round(pct(assess.points)[c.humour])}%`, humour: c.humour, points: 0 });
    mizajAsli = {
      ...c, lead: round1(c.lead), confidence, evidence, cap,
      assessment: assess ? { percent: pct(assess.points), date: assess.date } : null,
      note: c.label === "Mu'tadil" ? "Constitutional signs are evenly balanced." : undefined,
    };
  }

  // ---- Organs: links to complaints / categories / symptoms / regions
  const ctx = input.ctx;
  const norm = (s: string) => s.trim().toLowerCase();
  const organs = organOptions.map((o) => {
    const a = o.appliesTo;
    let score = 0;
    const why: string[] = [];
    for (const c of ctx.complaints) {
      if (c.key && (a.complaints || []).includes(c.key)) { score += c.primary ? 8 : 6; why.push(c.label); }
      else if (c.category && (a.categories || []).some((x) => norm(x) === norm(c.category!))) { score += c.primary ? 5 : 3; why.push(c.label); }
    }
    for (const s of ctx.symptoms) if ((a.symptoms || []).some((x) => norm(x) === norm(s))) { score += 3; why.push(s); }
    for (const r of ctx.regions) if ((a.regions || []).some((x) => norm(x) === norm(r.label))) { score += r.primary ? 5 : 3; why.push(r.label); }
    if (score > 0) score += o.priority;
    return { label: o.label, score, reason: why.length ? `From ${[...new Set(why)].slice(0, 2).join(" & ")}` : "" };
  }).filter((o) => o.score > 0).sort((x, y) => y.score - x.score).slice(0, cfg.maxOrgans);
  if (!organs.length) insufficient.push("No organ links match yet — record complaints or body regions (Stage 3).");

  return { sources, mizajAsli, suMizaj, organs, insufficient };
}

const hash = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 16);

export interface EngineResult { suggestion: Suggestion; method: "rules" | "ranked" | "rules-fallback"; contextHash: string; configVersion: string; latencyMs: number }

/** Full run for a visit: load, score, optionally reorder organs, return with provenance. */
export async function runTashkheesEngine(visitId: string, facilityId: string): Promise<EngineResult | null> {
  const started = Date.now();
  const [input, cfg, organRows] = await Promise.all([
    loadEngineInput(visitId, facilityId),
    getEngineConfig(),
    db.tashkheesOption.findMany({ where: { list: "organ", active: true }, orderBy: { sortOrder: "asc" }, select: { label: true, appliesTo: true, priority: true, description: true } }),
  ]);
  if (!input) return null;
  const organOptions = organRows.map((o) => ({ label: o.label, appliesTo: parseAppliesTo(o.appliesTo), priority: o.priority }));
  const suggestion = computeSuggestion(input, cfg, organOptions);
  let method: EngineResult["method"] = "rules";

  // Optional: Hakeem Insight reorders the candidate organs (never adds new ones).
  const all = computeSuggestion(input, { ...cfg, maxOrgans: 12 }, organOptions).organs;
  if (cfg.ranking && all.length > cfg.maxOrgans) {
    const ranked = await Promise.race([
      rankTashkheesOrgans(
        { complaints: input.ctx.complaints.map((c) => c.label), symptoms: input.ctx.symptoms, regions: input.ctx.regions.map((r) => r.label), suMizaj: suggestion.suMizaj?.label ?? null },
        all.map((o) => ({ id: o.label, label: `${o.label}${organRows.find((r) => r.label === o.label)?.description ? ` (${organRows.find((r) => r.label === o.label)!.description})` : ""}` })),
        cfg.maxOrgans,
      ).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    const valid = (ranked || []).filter((id) => all.some((o) => o.label === id));
    if (valid.length) {
      suggestion.organs = [...new Set(valid)].map((id) => all.find((o) => o.label === id)!).slice(0, cfg.maxOrgans);
      method = "ranked";
    } else method = "rules-fallback";
  }

  return {
    suggestion, method,
    contextHash: hash({ r: input.responses, c: input.complaints, x: input.ctx, a: input.assessment }),
    configVersion: hash({ cfg, o: organOptions }),
    latencyMs: Date.now() - started,
  };
}

export { HUMOUR_LABEL };
