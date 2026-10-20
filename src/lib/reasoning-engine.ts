// Stage 5 clinical reasoning assistant (Hakeem Insight).
//
//   1. Input      — the case context, the rule engines' results and the Hakim's
//                   choices so far, DE-IDENTIFIED (no name, phone, address, codes).
//   2. Model      — Claude, instructed to use only recorded facts, cite them, pick
//                   diseases only from the approved catalogue, use certainty words
//                   (never "confirmed", no percentages) and keep Unani and
//                   biomedical reasoning separate. Answers in fixed JSON.
//   3. Validation — independent of the model: unknown diseases, temperaments and
//                   organs are dropped; evidence that can't be found in the
//                   recorded case is removed; everything removed is logged.
//   4. Record     — every run is stored with input, output, removals and versions.
// The Hakim decides; nothing here is written into the dossier automatically.

import { createHash } from "node:crypto";
import type { CaseContext } from "@/lib/case-context";
import type { CatalogueEntry, DifferentialResult } from "@/lib/differential-engine";
import type { Suggestion } from "@/lib/tashkhees-engine";
import { ENGINE_MIZAJ } from "@/lib/tashkhees";

export const PROMPT_VERSION = "tashkhees-reasoning-v1";

export interface ReasoningOutput {
  insufficient: boolean;
  summary: string;
  urgent: { issue: string; action: string; evidence: string[] }[];
  contradictions: { issue: string; evidence: string[]; resolve: string }[];
  missing: { item: string; why: string; priority: "high" | "medium" | "low" }[];
  differentials: { key: string; marzId: string; label: string; localName: string | null; unverified: boolean; certainty: "suspected" | "probable"; reasoning: string; for: string[]; against: string[]; toConfirm: string[] }[];
  unani: { mizajAsli: string; suMizaj: string; sabab: string[]; organs: string[]; reasoning: string };
  biomedical: string;
  nextQuestions: { question: string; why: string }[];
  draftStatement: string;
  limitations: string;
}
export interface Removal { what: string; text: string; why: string }

/** Removes contact details and record codes from free text before it leaves the server. */
export function deidentify(text: string | null | undefined): string | null {
  if (!text) return null;
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[number]")
    .replace(/\b(PT|V)\d{1,6}\b/g, "[code]")
    .slice(0, 1200);
}

export function buildReasoningInput(
  ctx: CaseContext, diff: DifferentialResult, engine: Suggestion | null,
  dossier: { mizajAsli: string | null; suMizajType: string | null; suMizajQuality: string | null; suMizajGrade: number | null; organs: string[]; sabab: string[]; diagnoses: { label: string; role: string; certainty: string | null }[]; treatmentResponse?: string | null; treatmentResponseNote?: string | null } | null,
  catalogue: CatalogueEntry[], organList: string[],
) {
  const d = deidentify;
  return {
    patient: { age: ctx.patient.age, sex: ctx.patient.sex, pregnancyStatus: ctx.patient.pregnancyStatus, historyReliability: ctx.patient.historyReliability },
    visit: { followUp: ctx.visit.followUp, daysSinceVisitStarted: ctx.visit.ageDays },
    presenting: {
      complaints: ctx.presenting.complaints.map((c) => ({ complaint: c.label, primary: c.primary, severity: c.severity, duration: c.duration, pattern: c.pattern, character: c.character, worseWith: c.aggravating, betterWith: c.relieving, associated: c.associated, notes: d(c.notes) })),
      otherSymptoms: ctx.presenting.symptoms, bodyRegions: ctx.presenting.regions, onset: ctx.presenting.onsetPatterns, duration: ctx.presenting.duration, narrative: d(ctx.presenting.narrative),
    },
    vitals: ctx.vitals ? { bp: ctx.vitals.bp, pulse: ctx.vitals.pulse, spo2: ctx.vitals.spo2, temperatureF: ctx.vitals.tempF, bmi: ctx.vitals.bmi, flags: ctx.vitals.flags } : "not recorded",
    warningSigns: ctx.warning ? { outcome: ctx.warning.outcome, signs: ctx.warning.signs, referralDeclineReason: ctx.warning.declineReason } : "not screened",
    lifestyleAsbab: ctx.lifestyle.items.map((s) => ({ section: s.label, answers: s.answers })),
    examinationDalail: ctx.examination.sections.map((s) => ({ section: s.label, answers: s.answers })),
    history: {
      allergies: ctx.history.allergiesRecorded ? (ctx.history.allergies.length ? ctx.history.allergies : "none") : "not recorded",
      currentMedicines: ctx.history.medicinesRecorded ? (ctx.history.medicines.length ? ctx.history.medicines : "none") : "not recorded",
      knownConditions: ctx.history.conditions, medicalHistory: d(ctx.history.medicalHistory), surgicalHistory: d(ctx.history.surgicalHistory), familyHistory: d(ctx.history.familyHistory),
    },
    reports: ctx.reports.map((r) => ({ title: r.title, category: r.category, daysBeforeVisit: r.ageDays, result: r.flag, reviewed: r.reviewed, abnormalValues: r.abnormal, summary: d(r.summary) })),
    previousVisits: ctx.previousVisits.map((v) => ({ date: v.date.slice(0, 10), complaints: v.complaints, diagnoses: v.dossier?.diagnoses ?? [], suMizaj: v.dossier?.suMizaj ?? null, organs: v.dossier?.organs ?? [], prognosis: v.dossier?.prognosis ?? null })),
    mizajAssessment: ctx.mizajAssessment ? { result: ctx.mizajAssessment.result, pulse: d(ctx.mizajAssessment.pulse) } : "not done",
    notYetRecorded: ctx.readiness.filter((r) => r.status === "missing").map((r) => r.key),
    ruleEngines: {
      suMizaj: engine?.suMizaj ? { suggestion: engine.suMizaj.label ?? "undetermined", type: engine.suMizaj.type, darja: engine.suMizaj.darja, confidence: engine.suMizaj.confidence, conflictingReadings: engine.suMizaj.conflict?.leans ?? null } : null,
      mizajAsli: engine?.mizajAsli ? { suggestion: engine.mizajAsli.label, confidence: engine.mizajAsli.confidence } : null,
      organs: engine?.organs.map((o) => o.label) ?? [],
      differentials: diff.differentials.map((x) => ({ key: x.key, disease: x.label, certainty: x.certainty, for: x.for, against: x.against, notChecked: x.missing })),
    },
    hakimSoFar: dossier ? { mizajAsli: dossier.mizajAsli, suMizaj: [dossier.suMizajType, dossier.suMizajQuality, dossier.suMizajGrade ? `Darja ${dossier.suMizajGrade}` : null].filter(Boolean).join(" ") || null, organs: dossier.organs, diagnoses: dossier.diagnoses, sabab: dossier.sabab, responseToPreviousPlan: dossier.treatmentResponse ? [dossier.treatmentResponse, deidentify(dossier.treatmentResponseNote)].filter(Boolean).join(" — ") : null } : null,
    catalogue: catalogue.map((c) => ({ key: c.key, disease: c.label, group: c.category, organs: c.organs, typicalMizaj: c.mizaj })),
    allowedTemperaments: ENGINE_MIZAJ,
    allowedOrgans: organList,
  };
}

export const SYSTEM_PROMPT = `You are Hakeem Insight, a clinical reasoning assistant supporting a senior Unani Hakim at Stage 5 (Tashkhees — diagnosis and plan) of TheHekimsConnect. You support the Hakim's reasoning; the Hakim makes every decision.

Rules — follow all of them:
1. Use ONLY facts present in CASE. Never invent findings, measurements, results, history or medicines. A finding that is not recorded is UNKNOWN, never absent or normal.
2. Choose differential diagnoses ONLY from CASE.catalogue, by their exact "key". At most 5, most likely first. If nothing fits, return an empty list and say why.
3. Every claim rests on recorded findings: put short quotes or close paraphrases of the CASE facts it relies on into the "evidence" / "for" / "against" arrays.
4. Certainty words only: "suspected" or "probable". Never "confirmed". No percentages or probabilities.
5. Keep Unani interpretation (Mizaj-e-Asli, Su-e-Mizaj, Akhlat, Sabab, organs) separate from biomedical considerations. Do not equate Unani concepts with biomedical diagnoses. Temperaments must come from CASE.allowedTemperaments and organs from CASE.allowedOrgans (or leave them empty).
6. Put anything urgent or dangerous first in "urgent", with a concrete action. The platform's safety rules stand; you may add concerns but never dismiss a warning.
7. Point out contradictions between findings or between the rule engines and the record, and the missing information that would most change the assessment.
8. If the record is too thin to reason about, set "insufficient": true and explain what is needed.
9. Write concise, clinically precise English. No preamble.

Return ONLY one JSON object, no other text, with exactly this shape:
{
  "insufficient": false,
  "summary": "3–6 sentence synthesis of the case",
  "urgent": [{ "issue": "", "action": "", "evidence": [""] }],
  "contradictions": [{ "issue": "", "evidence": [""], "resolve": "how to resolve it" }],
  "missing": [{ "item": "", "why": "how it would change the assessment", "priority": "high|medium|low" }],
  "differentials": [{ "key": "catalogue key", "certainty": "suspected|probable", "reasoning": "", "for": [""], "against": [""], "toConfirm": ["examination or test that would confirm or exclude it"] }],
  "unani": { "mizajAsli": "", "suMizaj": "", "sabab": [""], "organs": [""], "reasoning": "" },
  "biomedical": "biomedical considerations, kept separate",
  "nextQuestions": [{ "question": "", "why": "" }],
  "draftStatement": "a proposed Tashkhees statement for the Hakim to edit",
  "limitations": "what this reasoning could not take into account"
}`;

const STOP = new Set(["with", "from", "that", "this", "have", "been", "were", "they", "their", "there", "which", "would", "could", "about", "into", "over", "more", "less", "than", "after", "before", "patient", "recorded", "reported", "noted", "present", "shows", "suggests", "likely"]);
const words = (s: string) => (s.toLowerCase().match(/[a-z؀-ۿऀ-ॿ']{4,}/g) || []).filter((w) => !STOP.has(w));

/** True when a quoted piece of evidence shares real words with the recorded case. */
export function supported(evidence: string, haystack: string): boolean {
  const w = words(evidence);
  if (!w.length) return /\d/.test(evidence) && evidence.replace(/\D/g, "").length > 0 && haystack.includes(evidence.replace(/[^\d./]/g, ""));
  return w.some((x) => haystack.includes(x));
}

const s = (v: unknown, max = 1500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const arr = (v: unknown, max = 8) => (Array.isArray(v) ? v.slice(0, max) : []);
const strs = (v: unknown, max = 8, len = 300) => arr(v, max).map((x) => s(x, len)).filter(Boolean);

/** Independent validation of the model's answer against the catalogue, allowed values and the recorded case. */
export function validateReasoning(raw: any, input: ReturnType<typeof buildReasoningInput>, catalogue: CatalogueEntry[]): { output: ReasoningOutput; removed: Removal[] } {
  const removed: Removal[] = [];
  const hay = JSON.stringify({ ...input, catalogue: undefined, allowedTemperaments: undefined, allowedOrgans: undefined }).toLowerCase();
  const keepEvidence = (list: string[], what: string) => list.filter((e) => {
    if (supported(e, hay)) return true;
    removed.push({ what, text: e, why: "not found in the recorded case" });
    return false;
  });

  const differentials: ReasoningOutput["differentials"] = [];
  for (const d of arr(raw?.differentials, 8)) {
    const key = s(d?.key, 80);
    const entry = catalogue.find((c) => c.key === key);
    if (!entry) { removed.push({ what: "differential", text: key || s(d?.reasoning, 120), why: "not in the approved Amraz catalogue" }); continue; }
    if (differentials.some((x) => x.key === key)) continue;
    if (differentials.length >= 5) break;
    differentials.push({
      key, marzId: entry.id, label: entry.label, localName: entry.localName, unverified: entry.reviewStatus !== "approved",
      certainty: d?.certainty === "probable" ? "probable" : "suspected",
      reasoning: s(d?.reasoning, 800), for: keepEvidence(strs(d?.for), `evidence for ${entry.label}`), against: keepEvidence(strs(d?.against), `evidence against ${entry.label}`), toConfirm: strs(d?.toConfirm, 5),
    });
  }

  const allowedMizaj = new Set(input.allowedTemperaments as readonly string[]);
  const pickMizaj = (v: unknown, what: string) => {
    const x = s(v, 60);
    if (!x) return "";
    const m = [...allowedMizaj].find((a) => x.toLowerCase().includes(a.toLowerCase()));
    if (!m) { removed.push({ what, text: x, why: "not one of the platform's temperaments" }); return ""; }
    return x.slice(0, 60);
  };
  const organs = strs(raw?.unani?.organs, 6, 60).filter((o) => {
    if (input.allowedOrgans.includes(o)) return true;
    removed.push({ what: "organ", text: o, why: "not in the organ list" });
    return false;
  });

  const output: ReasoningOutput = {
    insufficient: raw?.insufficient === true,
    summary: s(raw?.summary, 1500),
    urgent: arr(raw?.urgent, 6).map((u: any) => ({ issue: s(u?.issue, 300), action: s(u?.action, 300), evidence: keepEvidence(strs(u?.evidence, 5), "urgent evidence") })).filter((u) => u.issue),
    contradictions: arr(raw?.contradictions, 6).map((c: any) => ({ issue: s(c?.issue, 300), evidence: keepEvidence(strs(c?.evidence, 5), "contradiction evidence"), resolve: s(c?.resolve, 300) })).filter((c) => c.issue),
    missing: arr(raw?.missing, 8).map((m: any) => ({ item: s(m?.item, 200), why: s(m?.why, 300), priority: (["high", "medium", "low"].includes(m?.priority) ? m.priority : "medium") as "high" | "medium" | "low" })).filter((m) => m.item),
    differentials,
    unani: { mizajAsli: pickMizaj(raw?.unani?.mizajAsli, "Mizaj-e-Asli"), suMizaj: pickMizaj(raw?.unani?.suMizaj, "Su-e-Mizaj"), sabab: strs(raw?.unani?.sabab, 6, 160), organs, reasoning: s(raw?.unani?.reasoning, 1000) },
    biomedical: s(raw?.biomedical, 1000),
    nextQuestions: arr(raw?.nextQuestions, 6).map((q: any) => ({ question: s(q?.question, 200), why: s(q?.why, 300) })).filter((q) => q.question),
    draftStatement: s(raw?.draftStatement, 1500),
    limitations: s(raw?.limitations, 600),
  };
  // A certainty above the evidence: "probable" needs at least two supported findings.
  for (const d of output.differentials) if (d.certainty === "probable" && d.for.length < 2) { d.certainty = "suspected"; removed.push({ what: "certainty", text: `${d.label}: probable`, why: "fewer than two supported findings — lowered to suspected" }); }
  return { output, removed };
}

export const inputHash = (input: unknown) => createHash("sha1").update(JSON.stringify(input)).digest("hex").slice(0, 16);
