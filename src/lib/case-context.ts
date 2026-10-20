// Stage 5 — the case context: one structured, sourced picture of the patient
// built from every earlier stage, the patient's history, reports and previous
// visits. The case summary (Khulasa), the readiness checks, the differential
// engine and the reasoning assistant all read this, so they see the same facts.
//
//   • Every finding says where it came from (stage + link) and what kind it is:
//     reported by the patient, examined, measured, calculated or a document.
//   • Nothing unrecorded is treated as absent: readiness lists what is missing.
//   • Texts are keys + values; the screen translates them.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { conditionsIn, conditionLabel } from "@/lib/ghiza-conditions";
import type { ReportExtraction } from "@/lib/reports";

const parse = <T,>(raw: string | null | undefined, fb: T): T => { try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; } };
const NONE = /^(no|none|nil|na|n\/a|none known|nkda|not known)$/i;
const splitList = (s: string | null | undefined) => (s || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
const DAY = 86_400_000;

export type Stage = 1 | 2 | 3 | 4 | 5;
export interface SourceRef { stage: Stage; href: string }
export type ReadinessKey = "vitals" | "complaints" | "warning_signs" | "body_map" | "asbab" | "nabz" | "zahiri" | "other_exam" | "allergies" | "medicines" | "pregnancy";
export interface ReadinessItem { key: ReadinessKey; status: "done" | "partial" | "missing" | "na"; critical: boolean; source: SourceRef; count?: number }
export interface CaseAlert { key: string; level: "high" | "caution" | "info"; params?: Record<string, string | number>; source?: SourceRef }
export interface ComplaintSummary {
  label: string; key: string | null; category: string | null; primary: boolean; severity: number | null; duration: string | null; pattern: string | null; character: string | null;
  aggravating: string[]; relieving: string[]; associated: string[]; notes: string | null;
}
export interface ExamSection { key: string; label: string; answers: { question: string; answer: string }[] }
export interface ReportSummary { id: string; title: string; category: string; date: string | null; flag: string; reviewed: boolean; ageDays: number | null; abnormal: { name: string; value: string; unit?: string; flag?: string | null }[]; summary: string | null }
export interface PreviousVisit {
  id: string; code: string; date: string; complaints: string[];
  dossier: { status: string; mizajAsli: string | null; suMizaj: string | null; organs: string[]; statement: string | null; prognosis: string | null; diagnoses: string[] } | null;
}

export interface CaseContext {
  patient: { id: string; age: number | null; sex: "male" | "female" | null; pregnancyStatus: string | null; historyReliability: string | null };
  visit: { id: string; code: string; date: string; ageDays: number; followUp: boolean };
  presenting: { complaints: ComplaintSummary[]; symptoms: string[]; regions: string[]; onsetPatterns: string[]; duration: string | null; narrative: string | null };
  vitals: { bp: string | null; pulse: number | null; spo2: number | null; tempF: number | null; bmi: number | null; flags: string[]; at: string } | null;
  warning: { outcome: string; signs: string[]; referredTo: string | null; declineReason: string | null; declineRemarks: string | null } | null;
  lifestyle: { answered: number; sections: number; totalSections: number; items: ExamSection[] };
  examination: { answered: number; sections: ExamSection[] };
  history: {
    conditions: string[]; conditionKeys: string[]; medicalHistory: string | null; surgicalHistory: string | null; familyHistory: string | null;
    allergies: string[]; allergiesRecorded: boolean; medicines: string[]; medicinesRecorded: boolean;
  };
  reports: ReportSummary[];
  previousVisits: PreviousVisit[];
  mizajAssessment: { result: string; date: string; pulse: string | null } | null;
  readiness: ReadinessItem[];
  alerts: CaseAlert[];
  /** Fingerprint of the clinical findings — stored with each finalisation so later changes are noticed. */
  fingerprint: string;
}

/** Fingerprint of what a diagnosis rests on (not timestamps or the Hakim's own decisions). */
export function caseFingerprint(c: Omit<CaseContext, "fingerprint">): string {
  const facts = {
    p: [c.patient.pregnancyStatus, c.patient.historyReliability], cx: c.presenting.complaints.map((x) => [x.label, x.severity, x.duration, x.pattern, x.character, x.aggravating, x.relieving, x.associated]),
    s: c.presenting.symptoms, r: c.presenting.regions, o: c.presenting.onsetPatterns, v: c.vitals && [c.vitals.bp, c.vitals.pulse, c.vitals.spo2, c.vitals.tempF],
    w: c.warning && [c.warning.outcome, c.warning.signs], l: c.lifestyle.items, e: c.examination.sections,
    h: [c.history.allergies, c.history.medicines, c.history.conditionKeys], rp: c.reports.map((x) => [x.id, x.flag, x.reviewed]),
  };
  return createHash("sha1").update(JSON.stringify(facts)).digest("hex").slice(0, 16);
}

/** Vital-sign flags with a level — the same cut-offs the rest of the app uses for "fever", "low oxygen" etc. */
export function vitalFlags(v: { bpSystolic: number | null; bpDiastolic: number | null; pulse: number | null; spo2: number | null; temperatureF: number | null }) {
  const out: { key: string; level: "high" | "caution"; value: string | number }[] = [];
  if (v.temperatureF != null && v.temperatureF >= 103) out.push({ key: "fever_high", level: "high", value: v.temperatureF });
  else if (v.temperatureF != null && v.temperatureF >= 100.4) out.push({ key: "fever", level: "caution", value: v.temperatureF });
  if (v.spo2 != null && v.spo2 < 92) out.push({ key: "spo2_low", level: "high", value: v.spo2 });
  else if (v.spo2 != null && v.spo2 < 95) out.push({ key: "spo2_borderline", level: "caution", value: v.spo2 });
  if (v.bpSystolic != null && v.bpSystolic >= 180) out.push({ key: "bp_very_high", level: "high", value: `${v.bpSystolic}/${v.bpDiastolic ?? "?"}` });
  else if (v.bpSystolic != null && v.bpSystolic >= 140) out.push({ key: "bp_high", level: "caution", value: `${v.bpSystolic}/${v.bpDiastolic ?? "?"}` });
  if (v.bpSystolic != null && v.bpSystolic < 90) out.push({ key: "bp_low", level: "high", value: `${v.bpSystolic}/${v.bpDiastolic ?? "?"}` });
  if (v.pulse != null && v.pulse > 120) out.push({ key: "pulse_very_fast", level: "high", value: v.pulse });
  else if (v.pulse != null && v.pulse > 100) out.push({ key: "pulse_fast", level: "caution", value: v.pulse });
  if (v.pulse != null && v.pulse < 50) out.push({ key: "pulse_slow", level: "caution", value: v.pulse });
  return out;
}

export async function buildCaseContext(visitId: string, facilityId: string): Promise<CaseContext | null> {
  const visit = await db.visit.findFirst({
    where: { id: visitId, facilityId },
    select: {
      id: true, visitCode: true, visitDate: true, createdAt: true, patientId: true, pregnancyStatus: true, historyReliability: true,
      patient: { select: { gender: true, dob: true, chronicConditions: true, medicalHistory: true, surgicalHistory: true, familyHistory: true, allergies: true, currentMedications: true } },
      intake: { select: { chiefComplaints: true, narrative: true, allergies: true, medications: true } },
      complaintAssessments: { orderBy: { sortOrder: "asc" } },
      acuteSymptomAssessment: { select: { symptoms: true } },
      anatomicalRegionSelection: { select: { regions: true } },
      chronology: { select: { onsetPatterns: true, durationValue: true, durationUnit: true } },
      vitalSigns: true,
      redFlagScreening: { select: { outcome: true, answers: { where: { present: true }, select: { criterionLabel: true } } } },
      referral: { select: { referredTo: true } },
      amaDecline: { select: { declineReason: true, patientReason: true } },
      asbabAssessments: { select: { framework: true, responses: { select: { pillarKey: true, questionLabel: true, value: true, selectedOptions: true } } } },
    },
  });
  if (!visit) return null;
  const pid = visit.patientId;
  const href = { reg: `/facility/patients/${pid}`, s2: `/facility/patients/${pid}/record`, s3: `/facility/mizaj?patientId=${pid}`, s4: `/facility/asbab?patientId=${pid}`, s5: `/facility/tashkhees?patientId=${pid}` };

  const [pillars, reports, prev, ma] = await Promise.all([
    db.asbabPillar.findMany({ where: { active: true }, select: { framework: true, key: true, label: true }, orderBy: { sortOrder: "asc" } }),
    db.patientReport.findMany({ where: { patientId: pid, facilityId }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.visit.findMany({
      where: { patientId: pid, facilityId, createdAt: { lt: visit.createdAt } }, orderBy: { createdAt: "desc" }, take: 5,
      select: {
        id: true, visitCode: true, visitDate: true, complaintAssessments: { select: { chiefComplaintLabel: true }, orderBy: { sortOrder: "asc" } },
        tashkheesDossier: { select: { status: true, mizajAsli: true, suMizajQuality: true, suMizajType: true, suMizajGrade: true, organs: true, diagnosisNote: true, prognosis: true, diagnoses: { select: { label: true, role: true } } } },
      },
    }),
    db.mizajAssessment.findFirst({ where: { patientId: pid, facilityId }, orderBy: { createdAt: "desc" }, select: { result: true, createdAt: true, pulse: true } }),
  ]);

  // ---- patient
  const p = visit.patient;
  const sex = p?.gender?.toLowerCase().startsWith("f") ? "female" as const : p?.gender?.toLowerCase().startsWith("m") ? "male" as const : null;
  const age = p?.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * DAY)) : null;

  // ---- presenting
  const complaints: ComplaintSummary[] = visit.complaintAssessments.map((c, i) => ({
    label: c.chiefComplaintLabel, key: null, category: null, primary: i === 0, severity: c.severityScore,
    duration: c.onsetValue != null ? `${c.onsetValue} ${c.onsetUnit || "days"}` : null, pattern: c.onsetPattern, character: c.character,
    aggravating: parse<string[]>(c.aggravatingFactors, []), relieving: parse<string[]>(c.relievingFactors, []), associated: parse<string[]>(c.associatedManifestations, []),
    notes: c.clinicalNotes,
  }));
  for (const l of parse<string[]>(visit.intake?.chiefComplaints, [])) {
    if (!complaints.some((c) => c.label.toLowerCase() === l.toLowerCase())) complaints.push({ label: l, key: null, category: null, primary: complaints.length === 0, severity: null, duration: null, pattern: null, character: null, aggravating: [], relieving: [], associated: [], notes: null });
  }

  // Catalogue keys and categories, so engines can match on them.
  if (complaints.length) {
    const master = await db.chiefComplaint.findMany({ where: { label: { in: complaints.map((c) => c.label) } }, select: { key: true, label: true, category: true } });
    for (const c of complaints) { const m = master.find((x) => x.label.toLowerCase() === c.label.toLowerCase()); if (m) { c.key = m.key; c.category = m.category; } }
  }

  // ---- vitals
  const v = visit.vitalSigns;
  const flags = v ? vitalFlags(v) : [];
  const bmi = v?.heightCm && v.weightKg ? Math.round((v.weightKg / ((v.heightCm / 100) ** 2)) * 10) / 10 : null;

  // ---- lifestyle & examination answers, grouped by section
  const group = (framework: string) => {
    const a = visit.asbabAssessments.find((x) => x.framework === framework);
    const secs = pillars.filter((x) => x.framework === framework);
    const sections: ExamSection[] = secs.map((s) => ({
      key: s.key, label: s.label,
      answers: (a?.responses || []).filter((r) => r.pillarKey === s.key).map((r) => {
        const opts = parse<{ label: string }[]>(r.selectedOptions, []).map((o) => o.label);
        const val = opts.length ? opts.join(", ") : (() => { const x = parse<unknown>(r.value, r.value); return Array.isArray(x) ? x.join(", ") : String(x ?? ""); })();
        return { question: r.questionLabel, answer: val };
      }).filter((x) => x.answer && x.answer !== "[]"),
    })).filter((s) => s.answers.length);
    return { sections, answered: sections.reduce((n, s) => n + s.answers.length, 0), total: secs.length };
  };
  const life = group("asbab");
  const exam = group("dalail");
  const examined = (k: string) => exam.sections.some((s) => s.key === k);

  // ---- history
  const intakeAllergies = parse<string[]>(visit.intake?.allergies, []);
  const intakeMeds = parse<{ label: string; kind: string }[]>(visit.intake?.medications, []).map((m) => m.label);
  const allergyAll = [...splitList(p?.allergies), ...intakeAllergies];
  const medsAll = [...splitList(p?.currentMedications), ...intakeMeds];
  const uniq = (xs: string[]) => xs.filter((x, i) => xs.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  const historyText = [p?.chronicConditions, p?.medicalHistory, p?.currentMedications].filter(Boolean).join(" ");
  const conditionKeys = [...new Set(conditionsIn(historyText))];

  // ---- reports
  const reportList: ReportSummary[] = reports.map((r) => {
    const x = parse<ReportExtraction>(r.extraction, {});
    const when = r.reportDate ?? r.createdAt;
    return {
      id: r.id, title: r.title, category: r.category, date: when.toISOString(), flag: r.resultFlag, reviewed: r.status === "reviewed",
      ageDays: Math.floor((visit.createdAt.getTime() - when.getTime()) / DAY),
      abnormal: (x.values || []).filter((val) => val.flag && val.flag !== "normal").slice(0, 8), summary: r.findings || x.summary || null,
    };
  });

  const ctx: CaseContext = {
    patient: { id: pid, age, sex, pregnancyStatus: visit.pregnancyStatus, historyReliability: visit.historyReliability },
    visit: { id: visit.id, code: visit.visitCode, date: visit.visitDate.toISOString(), ageDays: Math.floor((Date.now() - visit.createdAt.getTime()) / DAY), followUp: prev.length > 0 },
    presenting: {
      complaints,
      symptoms: parse<string[]>(visit.acuteSymptomAssessment?.symptoms, []),
      regions: parse<string[]>(visit.anatomicalRegionSelection?.regions, []),
      onsetPatterns: parse<string[]>(visit.chronology?.onsetPatterns, []),
      duration: visit.chronology?.durationValue != null ? `${visit.chronology.durationValue} ${visit.chronology.durationUnit || "days"}` : null,
      narrative: visit.intake?.narrative ?? null,
    },
    vitals: v ? { bp: v.bpSystolic != null ? `${v.bpSystolic}/${v.bpDiastolic ?? "?"}` : null, pulse: v.pulse, spo2: v.spo2, tempF: v.temperatureF, bmi, flags: flags.map((f) => f.key), at: v.createdAt.toISOString() } : null,
    warning: visit.redFlagScreening ? {
      outcome: visit.redFlagScreening.outcome, signs: visit.redFlagScreening.answers.map((a) => a.criterionLabel),
      referredTo: visit.referral?.referredTo ?? null, declineReason: visit.amaDecline?.declineReason ?? null, declineRemarks: visit.amaDecline?.patientReason ?? null,
    } : null,
    lifestyle: { answered: life.answered, sections: life.sections.length, totalSections: life.total, items: life.sections },
    examination: { answered: exam.answered, sections: exam.sections },
    history: {
      conditions: conditionKeys.map(conditionLabel), conditionKeys,
      medicalHistory: [p?.chronicConditions, p?.medicalHistory].filter(Boolean).join("; ") || null,
      surgicalHistory: p?.surgicalHistory ?? null, familyHistory: p?.familyHistory ?? null,
      allergies: uniq(allergyAll.filter((a) => !NONE.test(a))), allergiesRecorded: allergyAll.length > 0,
      medicines: uniq(medsAll.filter((m) => !NONE.test(m))), medicinesRecorded: medsAll.length > 0,
    },
    reports: reportList,
    previousVisits: prev.map((x) => ({
      id: x.id, code: x.visitCode, date: x.visitDate.toISOString(), complaints: x.complaintAssessments.map((c) => c.chiefComplaintLabel),
      dossier: x.tashkheesDossier ? {
        status: x.tashkheesDossier.status, mizajAsli: x.tashkheesDossier.mizajAsli,
        suMizaj: x.tashkheesDossier.suMizajQuality ? [x.tashkheesDossier.suMizajType, x.tashkheesDossier.suMizajQuality, x.tashkheesDossier.suMizajGrade ? `Darja ${x.tashkheesDossier.suMizajGrade}` : null].filter(Boolean).join(" · ") : null,
        organs: parse<string[]>(x.tashkheesDossier.organs, []), statement: x.tashkheesDossier.diagnosisNote, prognosis: x.tashkheesDossier.prognosis,
        diagnoses: x.tashkheesDossier.diagnoses.filter((d) => d.role === "working" || d.role === "secondary").map((d) => d.label),
      } : null,
    })),
    mizajAssessment: ma ? { result: ma.result, date: ma.createdAt.toISOString(), pulse: ma.pulse } : null,
    readiness: [],
    alerts: [],
    fingerprint: "",
  };

  // ---- readiness: what's done, partly done or missing — never assumed
  const R = (key: ReadinessKey, status: ReadinessItem["status"], critical: boolean, stage: Stage, link: string, count?: number): ReadinessItem => ({ key, status, critical, source: { stage, href: link }, count });
  const wf = visit.redFlagScreening?.outcome;
  const childBearing = sex === "female" && (age == null || (age >= 12 && age <= 55));
  ctx.readiness = [
    R("vitals", v ? "done" : "missing", true, 2, href.s2),
    R("complaints", visit.complaintAssessments.length ? "done" : complaints.length ? "partial" : "missing", true, 2, href.s2, complaints.length),
    R("warning_signs", wf && wf !== "pending" ? "done" : wf === "pending" ? "partial" : "missing", true, 2, href.s2),
    R("body_map", ctx.presenting.regions.length || visit.chronology ? "done" : "missing", false, 3, href.s3),
    R("asbab", life.sections.length >= life.total && life.total > 0 ? "done" : life.answered ? "partial" : "missing", false, 4, href.s4, life.answered),
    R("nabz", examined("nabz") ? "done" : "missing", true, 5, `${href.s5}#dalail`),
    R("zahiri", examined("zahiri") ? "done" : "missing", false, 5, `${href.s5}#dalail`),
    R("other_exam", ["lisan", "baul", "baraz"].some(examined) ? "done" : "missing", false, 5, `${href.s5}#dalail`),
    R("allergies", ctx.history.allergiesRecorded ? "done" : "missing", true, 1, href.reg),
    R("medicines", ctx.history.medicinesRecorded ? "done" : "missing", false, 1, href.reg),
    R("pregnancy", !childBearing ? "na" : visit.pregnancyStatus ? "done" : "missing", childBearing, 5, href.s5),
  ];

  // ---- alerts: what the Hakim must see before deciding
  const A = (key: string, level: CaseAlert["level"], params?: CaseAlert["params"], source?: SourceRef) => ctx.alerts.push({ key, level, params, source });
  if (ctx.warning) {
    const signs = ctx.warning.signs.join(", ");
    if (wf === "continued_ama") A("declined_referral", "high", { signs: signs || "—", reason: ctx.warning.declineReason || "—" }, { stage: 2, href: href.s2 });
    else if (wf === "referred") A("referred_out", "high", { to: ctx.warning.referredTo || "—" }, { stage: 2, href: href.s2 });
    else if (wf === "pending" && signs) A("signs_undecided", "high", { signs }, { stage: 2, href: href.s2 });
  }
  for (const f of flags) A(`vital_${f.key}`, f.level, { value: f.value }, { stage: 2, href: href.s2 });
  for (const r of reportList) {
    if (r.flag === "critical") A("report_critical", "high", { title: r.title }, { stage: 2, href: href.s2 });
    else if (r.flag === "abnormal") A("report_abnormal", "caution", { title: r.title }, { stage: 2, href: href.s2 });
    if (!r.reviewed) A("report_unreviewed", "info", { title: r.title }, { stage: 2, href: href.s2 });
    if (r.ageDays != null && r.ageDays > 180) A("report_old", "info", { title: r.title, months: Math.round(r.ageDays / 30) });
  }
  if (ctx.visit.ageDays >= 3) A("visit_old", "info", { days: ctx.visit.ageDays });
  if (visit.historyReliability && visit.historyReliability !== "reliable") A("history_unreliable", "caution", { level: visit.historyReliability });
  if (visit.pregnancyStatus === "pregnant" || visit.pregnancyStatus === "breastfeeding") A(`is_${visit.pregnancyStatus}`, "high");
  if (ctx.history.allergies.length) A("allergies", "caution", { items: ctx.history.allergies.join(", ") }, { stage: 1, href: href.reg });
  ctx.fingerprint = caseFingerprint(ctx);
  return ctx;
}
