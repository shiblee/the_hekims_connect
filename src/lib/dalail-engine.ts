// Stage 5 Dala'il — adaptive question selection.
//
// The question bank (Admin → Tashkhees & Ilaj → Dala'il) can grow to hundreds
// of examination questions; each visit shows only a small, relevant set:
//
//   1. Context   — what is already recorded for this visit (complaints and
//                  their categories, other symptoms, body regions, onset,
//                  vitals flags, sex & age). Nothing unrecorded is ever
//                  treated as "absent".
//   2. Rules     — approved + active questions only; sex/age limits; the
//                  existing follow-up rules are applied by the page.
//   3. Candidates— questions linked (in Admin) to this patient's complaints,
//                  complaint categories, symptoms or regions, plus "ask
//                  everyone" core signs.
//   4. Ranking   — optional: the external analysis service orders the
//                  candidate IDs it is given; anything it returns that isn't
//                  a candidate is discarded. On any failure the rule score
//                  is used, so the page always works.
//   5. Safety    — safety-critical candidates are always kept, beyond the
//                  cap; duplicates removed; the cap applies to the rest.
//
// The engine never writes questions — wording and options always come from
// the approved bank. It supports the Hakim; it does not diagnose.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { rankDalailQuestions } from "@/lib/gemini";

export interface AppliesTo {
  always?: boolean;
  categories?: string[]; // ChiefComplaint.category
  complaints?: string[]; // ChiefComplaint.key
  symptoms?: string[]; // AcuteSymptomTag.label
  regions?: string[]; // AnatomicalRegionTag.label
  sex?: "male" | "female";
  minAge?: number;
  maxAge?: number;
}

export const parseAppliesTo = (raw: string | null | undefined): AppliesTo => {
  try { const v = JSON.parse(raw || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
};

export interface DalailContext {
  complaints: { key: string | null; label: string; category: string | null; primary: boolean; severity: number | null }[];
  symptoms: string[];
  regions: { label: string; primary: boolean }[];
  onsetPatterns: string[];
  duration: string | null;
  vitalsFlags: string[];
  sex: "male" | "female" | null;
  age: number | null;
}

const parse = <T,>(raw: string | null | undefined, fallback: T): T => { try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; } };
const norm = (s: string) => s.trim().toLowerCase();

/** Builds the selection context from what's already recorded for the visit (current encounter only). */
export async function buildDalailContext(visitId: string, facilityId: string): Promise<DalailContext | null> {
  const visit = await db.visit.findFirst({
    where: { id: visitId, facilityId },
    select: {
      intake: { select: { chiefComplaints: true } },
      complaintAssessments: { orderBy: { sortOrder: "asc" }, select: { chiefComplaintLabel: true, severityScore: true } },
      acuteSymptomAssessment: { select: { symptoms: true } },
      anatomicalRegionSelection: { select: { regions: true } },
      chronology: { select: { onsetPatterns: true, durationValue: true, durationUnit: true } },
      vitalSigns: { select: { bpSystolic: true, bpDiastolic: true, pulse: true, spo2: true, temperatureF: true } },
      patient: { select: { gender: true, dob: true } },
    },
  });
  if (!visit) return null;

  const assessed = visit.complaintAssessments.map((c) => ({ label: c.chiefComplaintLabel, severity: c.severityScore }));
  const intake = parse<string[]>(visit.intake?.chiefComplaints, []).filter((l) => !assessed.some((a) => norm(a.label) === norm(l)));
  const labels = [...assessed, ...intake.map((label) => ({ label, severity: null as number | null }))];
  const master = labels.length
    ? await db.chiefComplaint.findMany({ where: { label: { in: labels.map((l) => l.label) } }, select: { key: true, label: true, category: true } })
    : [];

  const v = visit.vitalSigns;
  const flags: string[] = [];
  if (v) {
    if (v.temperatureF != null && v.temperatureF >= 100.4) flags.push("fever");
    if (v.pulse != null && v.pulse > 100) flags.push("fast pulse");
    if (v.pulse != null && v.pulse < 55) flags.push("slow pulse");
    if (v.spo2 != null && v.spo2 < 95) flags.push("low oxygen");
    if (v.bpSystolic != null && v.bpSystolic >= 140) flags.push("raised blood pressure");
    if (v.bpSystolic != null && v.bpSystolic < 90) flags.push("low blood pressure");
  }
  const sex = visit.patient?.gender?.toLowerCase().startsWith("f") ? "female" : visit.patient?.gender?.toLowerCase().startsWith("m") ? "male" : null;
  const dob = visit.patient?.dob ? new Date(visit.patient.dob) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 86_400_000)) : null;
  const regions = parse<string[]>(visit.anatomicalRegionSelection?.regions, []);

  return {
    complaints: labels.map((l, i) => {
      const m = master.find((x) => norm(x.label) === norm(l.label));
      return { key: m?.key ?? null, label: l.label, category: m?.category ?? null, primary: i === 0, severity: l.severity };
    }),
    symptoms: parse<string[]>(visit.acuteSymptomAssessment?.symptoms, []),
    regions: regions.map((label, i) => ({ label, primary: i === 0 })),
    onsetPatterns: parse<string[]>(visit.chronology?.onsetPatterns, []),
    duration: visit.chronology?.durationValue != null ? `${visit.chronology.durationValue} ${visit.chronology.durationUnit || "days"}` : null,
    vitalsFlags: flags,
    sex, age,
  };
}

export interface BankQuestion {
  id: string; label: string; section: string; sectionLabel: string; priority: number; safetyCritical: boolean;
  purpose: string | null; appliesTo: AppliesTo; sortKey: number;
}

/** The approved, active Dala'il questions with their selection metadata. */
export async function loadDalailBank(): Promise<BankQuestion[]> {
  const pillars = await db.asbabPillar.findMany({
    where: { framework: "dalail", active: true },
    orderBy: { sortOrder: "asc" },
    include: { questions: { where: { active: true, reviewStatus: "approved" }, orderBy: { sortOrder: "asc" } } },
  });
  let n = 0;
  return pillars.flatMap((p) => p.questions.map((q) => ({
    id: q.id, label: q.label, section: p.key, sectionLabel: p.label, priority: q.priority, safetyCritical: q.safetyCritical,
    purpose: q.purpose, appliesTo: parseAppliesTo(q.appliesTo), sortKey: n++,
  })));
}

interface Scored { q: BankQuestion; score: number; reason: string }

/** Rule layer: eligibility, candidate matching and a relevance score with a plain reason. */
export function scoreCandidates(ctx: DalailContext, bank: BankQuestion[]): Scored[] {
  const out: Scored[] = [];
  const keys = new Map(ctx.complaints.filter((c) => c.key).map((c) => [c.key!, c]));
  const cats = new Map<string, typeof ctx.complaints[number]>();
  for (const c of ctx.complaints) if (c.category && !cats.has(norm(c.category))) cats.set(norm(c.category), c);
  const syms = new Set(ctx.symptoms.map(norm));
  const regs = new Map(ctx.regions.map((r) => [norm(r.label), r]));

  for (const q of bank) {
    const a = q.appliesTo;
    // Eligibility (sex/age) — unknown sex/age never excludes.
    if (a.sex && ctx.sex && a.sex !== ctx.sex) continue;
    if (a.minAge != null && ctx.age != null && ctx.age < a.minAge) continue;
    if (a.maxAge != null && ctx.age != null && ctx.age > a.maxAge) continue;

    let score = 0;
    const why: string[] = [];
    for (const k of a.complaints || []) {
      const c = keys.get(k);
      if (c) { score += c.primary ? 8 : 6; why.push(c.label); }
    }
    for (const cat of a.categories || []) {
      const c = cats.get(norm(cat));
      if (c && !why.includes(c.label)) { score += c.primary ? 5 : 4; why.push(c.label); }
    }
    const symHits = (a.symptoms || []).filter((s) => syms.has(norm(s)));
    if (symHits.length) { score += 3 * symHits.length; why.push(...symHits); }
    const regHits = (a.regions || []).map((r) => regs.get(norm(r))).filter(Boolean) as { label: string; primary: boolean }[];
    for (const r of regHits) score += r.primary ? 4 : 2;
    const matched = score > 0;
    if (!matched && !a.always) continue;

    if (a.always) score += 2;
    score += q.priority * 1.5;
    if (q.safetyCritical) score += 4;
    const reason = matched
      ? `Relates to ${[...why, ...regHits.map((r) => r.label)].slice(0, 2).join(" & ")}`
      : "Core examination sign";
    out.push({ q, score, reason: q.safetyCritical ? `Safety check · ${reason}` : reason });
  }
  return out.sort((x, y) => y.score - x.score || x.q.sortKey - y.q.sortKey);
}

const hash = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 16);

export async function getDalailCap(): Promise<number> {
  const row = await db.portalSetting.findUnique({ where: { category_key: { category: "dalail", key: "max_questions" } } }).catch(() => null);
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 3 && n <= 25 ? Math.round(n) : 7;
}
async function rankingEnabled() {
  const row = await db.portalSetting.findUnique({ where: { category_key: { category: "dalail", key: "ranking" } } }).catch(() => null);
  return row?.value !== "off";
}

export interface DalailSelectionResult {
  questionIds: string[];
  reasons: Record<string, string>;
  method: "rules" | "ranked" | "rules-fallback";
  eligibleCount: number;
  bankVersion: string;
  contextHash: string;
  latencyMs: number;
}

/** Runs the full selection for a context. Never throws for ranking problems. */
export async function selectDalailQuestions(ctx: DalailContext, bank: BankQuestion[]): Promise<DalailSelectionResult> {
  const started = Date.now();
  const cap = await getDalailCap();
  const scored = scoreCandidates(ctx, bank);
  const safety = scored.filter((s) => s.q.safetyCritical);
  const rest = scored.filter((s) => !s.q.safetyCritical);
  const reasons: Record<string, string> = Object.fromEntries(scored.map((s) => [s.q.id, s.reason]));

  // Rule order, with a little section spread so one examination doesn't take every slot.
  const spread = (list: Scored[], n: number) => {
    const picked: Scored[] = [];
    const perSection = new Map<string, number>();
    const limit = Math.max(2, Math.ceil(n / 2));
    for (const s of list) {
      if (picked.length >= n) break;
      const c = perSection.get(s.q.section) ?? 0;
      if (c >= limit) continue;
      picked.push(s); perSection.set(s.q.section, c + 1);
    }
    for (const s of list) { if (picked.length >= n) break; if (!picked.includes(s)) picked.push(s); }
    return picked;
  };

  let method: DalailSelectionResult["method"] = "rules";
  let chosen = spread(rest, cap);

  // Optional ranking over the top candidates only (never the whole bank).
  const pool = rest.slice(0, Math.max(cap * 3, 15));
  if (pool.length > cap && (await rankingEnabled())) {
    const ranked = await Promise.race([
      rankDalailQuestions(
        {
          complaints: ctx.complaints.map((c) => `${c.label}${c.primary ? " (primary)" : ""}${c.severity != null ? `, severity ${c.severity}/10` : ""}`),
          symptoms: ctx.symptoms, regions: ctx.regions.map((r) => r.label), onset: ctx.onsetPatterns,
          duration: ctx.duration, vitals: ctx.vitalsFlags, sex: ctx.sex, ageBand: ctx.age == null ? null : ctx.age < 12 ? "child" : ctx.age < 60 ? "adult" : "older adult",
        },
        pool.map((s) => ({ id: s.q.id, section: s.q.sectionLabel, question: s.q.label, purpose: s.q.purpose })),
        cap,
      ).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    if (ranked && ranked.length) {
      const byId = new Map(pool.map((s) => [s.q.id, s]));
      const valid = ranked.filter((r) => byId.has(r.id));
      const seen = new Set<string>();
      const list: Scored[] = [];
      for (const r of valid) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        list.push(byId.get(r.id)!);
      }
      if (list.length) {
        // Top up from the rule order if the ranking returned fewer than the cap.
        for (const s of rest) { if (list.length >= cap) break; if (!seen.has(s.q.id)) { list.push(s); seen.add(s.q.id); } }
        chosen = list.slice(0, cap);
        method = "ranked";
      } else method = "rules-fallback";
    } else method = "rules-fallback";
  }

  // Every examination keeps a minimum of core signs (pulse, tongue, touch) —
  // the backbone of a Unani examination — replacing the weakest picks if needed.
  const CORE_MIN = 2;
  const coreIn = chosen.filter((s) => s.q.appliesTo.always).length;
  if (coreIn < CORE_MIN) {
    const extra = rest.filter((s) => s.q.appliesTo.always && !chosen.includes(s)).slice(0, CORE_MIN - coreIn);
    chosen = [...chosen.slice(0, Math.max(0, cap - extra.length)), ...extra];
  }

  const ids = [...safety.map((s) => s.q.id), ...chosen.map((s) => s.q.id)];
  return {
    questionIds: [...new Set(ids)],
    reasons,
    method,
    eligibleCount: scored.length,
    bankVersion: hash(bank.map((q) => [q.id, q.priority, q.safetyCritical, q.appliesTo])),
    contextHash: hash(ctx),
    latencyMs: Date.now() - started,
  };
}

export const contextHashOf = (ctx: DalailContext) => hash(ctx);
export const bankVersionOf = (bank: BankQuestion[]) => hash(bank.map((q) => [q.id, q.priority, q.safetyCritical, q.appliesTo]));
