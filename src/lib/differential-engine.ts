// Stage 5 differential engine — which diseases (Amraz) from the approved
// catalogue fit this case, and why. Rules only, fully explainable:
//
//   1. Candidates — catalogue entries whose complaints / categories / symptoms /
//      regions match the visit (or whose signs match strongly).
//   2. Evidence   — each supporting sign is matched (for), not found, or not yet
//      assessed (missing); each "against" sign that matches counts against.
//      Nothing unrecorded is ever treated as absent.
//   3. Fit        — the Su-e-Mizaj and organs (the Hakim's, else the engine's)
//      add or subtract a little.
//   4. Output     — certainty in words only (suspected / probable; never
//      "confirmed" — that is the Hakim's call), the next questions that would
//      most help tell the leading candidates apart, and serious alternatives
//      not to miss. Unverified catalogue entries are labelled as such.

import type { CaseContext } from "@/lib/case-context";
import type { MarzMatch, MarzSign } from "@/lib/amraz-seed";

export interface CatalogueEntry {
  id: string; key: string; label: string; localName: string | null; category: string | null; icd: string | null;
  organs: string[]; mizaj: string[]; suMizajType: string | null; sabab: string[];
  appliesTo: { complaints?: string[]; categories?: string[]; symptoms?: string[]; regions?: string[] };
  signs: MarzSign[]; against: MarzSign[]; dontMiss: { label: string; why: string }[]; investigations: string[];
  reviewStatus: string;
}
export interface BankQ { id: string; section: string; sectionLabel: string; label: string; options: string[] }
export interface Differential {
  marzId: string; key: string; label: string; localName: string | null; category: string | null; icd: string | null;
  score: number; certainty: "probable" | "suspected"; unverified: boolean;
  for: string[]; against: string[]; missing: string[];
  mizajFit: "fits" | "partly" | "against" | null; typicalMizaj: string[]; organs: string[]; sabab: string[]; investigations: string[];
}
export interface NextQuestion { questionId: string; section: string; sectionLabel: string; question: string; helps: string[] }
export interface DifferentialResult {
  differentials: Differential[];
  nextQuestions: NextQuestion[];
  dontMiss: { label: string; why: string; from: string[] }[];
  basis: { suMizaj: string | null; organs: string[]; from: "hakim" | "engine" | "none" };
}

const lc = (s: string) => s.toLowerCase();
const HOT = ["Safrawi", "Damawi", "Haar"], COLD = ["Balghami", "Saudawi", "Barid"], MOIST = ["Damawi", "Balghami", "Ratab"], DRY = ["Safrawi", "Saudawi", "Yabis"];

interface Facts {
  complaintsRecorded: boolean; keys: Set<string>; primaryKey: string | null; categories: Set<string>;
  symptoms: string[]; regions: string[];
  exam: { s: string; q: string; a: string }[]; examined: Set<string>;
  life: { s: string; q: string; a: string }[]; lifeSections: Set<string>;
  worse: string[]; better: string[]; text: string;
  vitals: Set<string>; vitalsRecorded: boolean; conditions: Set<string>; historyRecorded: boolean;
  sex: "male" | "female" | null; age: number | null;
}

export function factsOf(ctx: CaseContext): Facts {
  const c = ctx.presenting.complaints;
  const exam = ctx.examination.sections.flatMap((s) => s.answers.map((a) => ({ s: s.key, q: lc(a.question), a: lc(a.answer) })));
  const life = ctx.lifestyle.items.flatMap((s) => s.answers.map((a) => ({ s: s.key, q: lc(a.question), a: lc(a.answer) })));
  return {
    complaintsRecorded: c.length > 0,
    keys: new Set(c.map((x) => x.key).filter(Boolean) as string[]), primaryKey: c[0]?.key ?? null,
    categories: new Set(c.map((x) => x.category).filter(Boolean) as string[]),
    symptoms: ctx.presenting.symptoms.map(lc), regions: ctx.presenting.regions.map(lc),
    exam, examined: new Set(exam.map((e) => e.s)), life, lifeSections: new Set(life.map((e) => e.s)),
    worse: c.flatMap((x) => x.aggravating).map(lc), better: c.flatMap((x) => x.relieving).map(lc),
    text: lc([...c.flatMap((x) => [x.label, x.character, x.notes, ...x.aggravating, ...x.relieving, ...x.associated]), ...ctx.presenting.symptoms, ctx.presenting.narrative, ...ctx.history.medicines].filter(Boolean).join(" · ")),
    vitals: new Set(ctx.vitals?.flags ?? []), vitalsRecorded: !!ctx.vitals,
    conditions: new Set(ctx.history.conditionKeys), historyRecorded: ctx.history.medicinesRecorded || !!ctx.history.medicalHistory || ctx.history.conditionKeys.length > 0,
    sex: ctx.patient.sex, age: ctx.patient.age,
  };
}

const any = (hay: string[], needles?: string[]) => !!needles?.length && needles.some((n) => hay.some((h) => h.includes(lc(n))));

/** Does a sign match the case, and could it have been assessed at all? */
export function matchSign(m: MarzMatch, f: Facts): { matched: boolean; assessed: boolean; specific?: boolean } {
  const demographicOnly = !m.complaints && !m.categories && !m.symptoms && !m.regions && !m.exam && !m.life && !m.worse && !m.better && !m.text && !m.vitals && !m.conditions;
  const demoOk = (m.sex ? f.sex === m.sex : true) && (m.minAge != null ? f.age != null && f.age >= m.minAge : true) && (m.maxAge != null ? f.age != null && f.age <= m.maxAge : true);
  if (demographicOnly) return { matched: demoOk, assessed: (m.sex ? f.sex != null : true) && (m.minAge != null || m.maxAge != null ? f.age != null : true) };
  if (!demoOk) return { matched: false, assessed: true };
  const exm = (rows: Facts["exam"], crit?: MarzMatch["exam"]) => !!crit?.some((c) => rows.some((r) => r.s === c.s && (!c.q || r.q.includes(lc(c.q))) && r.a.includes(lc(c.o))));
  // "Specific" = matched on a recorded complaint, examination, vital sign, symptom, region or condition —
  // not just a hot/cold modality or free text, which on their own can't make a disease a candidate.
  const specific =
    (!!m.complaints && m.complaints.some((k) => f.keys.has(k))) ||
    any(f.symptoms, m.symptoms) || any(f.regions, m.regions) || exm(f.exam, m.exam) ||
    (!!m.vitals && m.vitals.some((v) => f.vitals.has(v))) || (!!m.conditions && m.conditions.some((c) => f.conditions.has(c)));
  const matched = specific ||
    (!!m.complaints && m.complaints.some((k) => f.keys.has(k))) ||
    (!!m.categories && m.categories.some((k) => f.categories.has(k))) ||
    any(f.symptoms, m.symptoms) || any(f.regions, m.regions) ||
    exm(f.exam, m.exam) || exm(f.life, m.life) ||
    any(f.worse, m.worse) || any(f.better, m.better) ||
    (!!m.text && m.text.some((t) => f.text.includes(lc(t)))) ||
    (!!m.vitals && m.vitals.some((v) => f.vitals.has(v))) ||
    (!!m.conditions && m.conditions.some((c) => f.conditions.has(c)));
  const assessed =
    ((!!m.complaints || !!m.categories || !!m.symptoms || !!m.regions || !!m.text || !!m.worse || !!m.better) && f.complaintsRecorded) ||
    (!!m.exam && m.exam.some((c) => f.examined.has(c.s))) ||
    (!!m.life && m.life.some((c) => f.lifeSections.has(c.s))) ||
    (!!m.vitals && f.vitalsRecorded) || (!!m.conditions && f.historyRecorded);
  return { matched, assessed: matched || assessed, specific };
}

/** How well the entry's typical temperament fits the case's Su-e-Mizaj. */
export function mizajFit(entry: string[], su: string | null): Differential["mizajFit"] {
  if (!su || !entry.length) return null;
  if (entry.includes(su)) return "fits";
  const hot = (xs: string[]) => xs.some((x) => HOT.includes(x)), cold = (xs: string[]) => xs.some((x) => COLD.includes(x));
  const moist = (xs: string[]) => xs.some((x) => MOIST.includes(x)), dry = (xs: string[]) => xs.some((x) => DRY.includes(x));
  const s = [su];
  const shareHeat = (hot(s) && hot(entry)) || (cold(s) && cold(entry));
  const shareMoist = (moist(s) && moist(entry)) || (dry(s) && dry(entry));
  if (shareHeat || shareMoist) return "partly";
  if ((hot(s) && cold(entry) && !hot(entry)) || (cold(s) && hot(entry) && !cold(entry))) return "against";
  return null;
}

export function computeDifferentials(
  ctx: CaseContext, catalogue: CatalogueEntry[], basis: DifferentialResult["basis"], bank: BankQ[] = [], max = 6,
): DifferentialResult {
  const f = factsOf(ctx);
  const scored = catalogue.map((e) => {
    let relevance = 0;
    const why: string[] = [];
    for (const k of e.appliesTo.complaints || []) if (f.keys.has(k)) { relevance += k === f.primaryKey ? 6 : 4; why.push(ctx.presenting.complaints.find((c) => c.key === k)!.label); }
    for (const c of e.appliesTo.categories || []) if (f.categories.has(c)) relevance += 2;
    if (any(f.symptoms, e.appliesTo.symptoms)) relevance += 2;
    if (any(f.regions, e.appliesTo.regions)) relevance += 2;
    const forList: string[] = [], missing: string[] = [], missingExam: NonNullable<MarzMatch["exam"]> = [];
    let signScore = 0, matchedSigns = 0, specificScore = 0;
    for (const s of e.signs) {
      const r = matchSign(s.match, f);
      if (r.matched) { forList.push(s.text); signScore += s.weight ?? 2; matchedSigns++; if (r.specific) specificScore += s.weight ?? 2; }
      else if (!r.assessed) { missing.push(s.text); missingExam.push(...(s.match.exam || [])); }
    }
    const againstList: string[] = [];
    let againstScore = 0;
    for (const s of e.against) { if (matchSign(s.match, f).matched) { againstList.push(s.text); againstScore += s.weight ?? 2; } }
    const fit = mizajFit(e.mizaj, basis.suMizaj);
    const organHits = e.organs.filter((o) => basis.organs.includes(o)).length;
    const score = relevance + signScore - againstScore + (fit === "fits" ? 2 : fit === "partly" ? 1 : fit === "against" ? -1 : 0) + Math.min(2, organHits);
    const candidate = relevance > 0 || specificScore >= 6;
    // The complaints that brought it up come first in the evidence.
    const evidence = [...why.map((w) => `Complaint: ${w}`), ...forList.filter((x) => !why.some((w) => x === w))];
    return { e, score, candidate, relevance, matchedSigns, againstScore, forList: evidence, againstList, missing, missingExam, fit };
  }).filter((x) => x.candidate && x.score >= 4).sort((a, b) => b.score - a.score).slice(0, max);

  const differentials: Differential[] = scored.map((x) => ({
    marzId: x.e.id, key: x.e.key, label: x.e.label, localName: x.e.localName, category: x.e.category, icd: x.e.icd,
    score: x.score, certainty: x.matchedSigns >= 2 && x.againstScore === 0 && x.relevance >= 4 ? "probable" : "suspected",
    unverified: x.e.reviewStatus !== "approved",
    for: x.forList, against: x.againstList, missing: x.missing,
    mizajFit: x.fit, typicalMizaj: x.e.mizaj, organs: x.e.organs, sabab: x.e.sabab, investigations: x.e.investigations,
  }));

  // Next questions: unexamined signs of the leading candidates that an approved question can answer —
  // ones that bear on more than one candidate first, since they help tell them apart.
  const asks = new Map<string, NextQuestion>();
  for (const x of scored.slice(0, 4)) {
    for (const c of x.missingExam) {
      const q = bank.find((b) => b.section === c.s && (c.q ? lc(b.label).includes(lc(c.q)) : b.options.some((o) => lc(o).includes(lc(c.o)))));
      if (!q) continue;
      const cur = asks.get(q.id) ?? { questionId: q.id, section: q.section, sectionLabel: q.sectionLabel, question: q.label, helps: [] };
      if (!cur.helps.includes(x.e.label)) cur.helps.push(x.e.label);
      asks.set(q.id, cur);
    }
  }
  const nextQuestions = [...asks.values()].sort((a, b) => b.helps.length - a.helps.length).slice(0, 5);

  const dm = new Map<string, { label: string; why: string; from: string[] }>();
  for (const x of scored.slice(0, 4)) for (const d of x.e.dontMiss) {
    const cur = dm.get(d.label) ?? { ...d, from: [] };
    cur.from.push(x.e.label);
    dm.set(d.label, cur);
  }
  return { differentials, nextQuestions, dontMiss: [...dm.values()].slice(0, 6), basis };
}
