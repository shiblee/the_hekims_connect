// Clinical Decision Support — Medicines & Supplements (Stage 5, doctors only).
//
// Helps the treating Hakim find Unani medicines, supplements and allopathic medicines from the
// platform's own database that may be worth evaluating for THIS patient. It
// never prescribes: candidates are options for review; prescriptions are only
// written by the doctor in Ilaj-bil-Dawa.
//
// Layers:
//   1. Context   — documented findings only (complaints, symptoms, diagnosis,
//                  organs, history conditions, allergies, current medicines,
//                  age, sex, pregnancy region, warning signs). Unrecorded ≠ absent.
//   2. Candidates— existing indication / symptom links: Unani medicines and
//                  supplements, and allopathic medicines (approved indication,
//                  evidence-supported or symptom relief — never off-label).
//                  "Not recommended" links exclude the item.
//   3. Safety    — allergy & cross-reactivity, interactions with current
//                  medicines, duplicate ingredients, pregnancy / lactation /
//                  children / older adults / kidney / liver, contraindications
//                  matching documented conditions. Safety data is applied even
//                  when unverified (conservative). High-severity → excluded.
//                  Ranking can never bring an excluded item back.
//   4. Ranking   — optional, constrained to the eligible shortlist; falls back
//                  to the rule order.
//   5. Record    — every run is stored (CdsSession) with what it was based on.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { nameKeys } from "@/lib/catalog-names";
import { buildDalailContext } from "@/lib/dalail-engine";
import { conditionsIn, conditionLabel, CONDITIONS } from "@/lib/ghiza-conditions";
import { rankCdsCandidates } from "@/lib/gemini";

export interface CdsConfig { enabled: boolean; maxPerCategory: number; ranking: boolean }
export const DEFAULT_CDS_CONFIG: CdsConfig = { enabled: false, maxPerCategory: 6, ranking: true };
export async function getCdsConfig(): Promise<CdsConfig> {
  const row = await db.portalSetting.findUnique({ where: { category_key: { category: "cds", key: "config" } } }).catch(() => null);
  try { return { ...DEFAULT_CDS_CONFIG, ...JSON.parse(row?.value || "{}") }; } catch { return DEFAULT_CDS_CONFIG; }
}

const NONE = /^(no|none|nil|na|n\/a|none known|nkda|not known)$/i;
const parse = <T,>(s: string | null | undefined, fb: T): T => { try { return s ? (JSON.parse(s) as T) : fb; } catch { return fb; } };
const SUPPLEMENT_TYPES = /nutritional|vitamin|mineral prep/i;

export interface SafetyNote { level: "high" | "caution" | "info"; text: string; verified: boolean }
export interface Candidate {
  /** unaniName holds the generic name for allopathic medicines (the secondary name shown beside the label). */
  tagId: string; label: string; unaniName: string | null; herbType: string | null; category: "unani" | "supplement" | "allopathic";
  reasons: string[]; evidence: { traditional: boolean; clinical: boolean; verified: boolean };
  safety: SafetyNote[]; completeness: number; score: number; mizaj: string | null;
}
export interface Excluded { tagId: string; label: string; reason: string; verified: boolean }
export interface CdsResult {
  urgent: string[];
  infoNeeded: string[];
  unani: Candidate[];
  supplements: Candidate[];
  allopathic: Candidate[];
  excluded: Excluded[];
  currentMeds: { label: string; matched: boolean }[];
  basis: { complaints: string[]; symptoms: string[]; conditions: string[]; allergies: string[]; suMizaj: string | null; age: number | null; sex: string | null };
}

export async function runCdsEngine(visitId: string, facilityId: string) {
  const started = Date.now();
  const [ctx, visit, cfg] = await Promise.all([
    buildDalailContext(visitId, facilityId),
    db.visit.findFirst({
      where: { id: visitId, facilityId },
      select: {
        intake: { select: { allergies: true, medications: true } },
        patient: { select: { chronicConditions: true, medicalHistory: true, allergies: true, currentMedications: true } },
        tashkheesDossier: { select: { suMizajQuality: true, organs: true, prescriptions: { select: { tagId: true, name: true } } } },
        redFlagScreening: { select: { outcome: true, answers: { where: { present: true }, select: { criterionLabel: true } } } },
        referral: { select: { referredTo: true } },
        pregnancyStatus: true,
      },
    }),
    getCdsConfig(),
  ]);
  if (!ctx || !visit) return null;
  const p = visit.patient;

  // ---- 1. Context
  const allergyNames = [...(p?.allergies || "").split(/[,;\n]/), ...parse<string[]>(visit.intake?.allergies, [])]
    .map((a) => String(a).replace(/\(.*?\)/g, "").trim()).filter((a) => a && !NONE.test(a));
  const allergyKeys = new Set(allergyNames.flatMap((a) => nameKeys(a)));
  const allergyRecorded = !!(p?.allergies?.trim() || parse<string[]>(visit.intake?.allergies, []).length);
  const intakeMeds = parse<{ label: string; kind: string }[]>(visit.intake?.medications, []).filter((m) => m?.label && !NONE.test(m.label));
  const freeMeds = (p?.currentMedications || "").split(/[,;\n]/).map((s) => s.trim()).filter((s) => s && !NONE.test(s));
  const medLabels = [...new Set([...intakeMeds.map((m) => m.label), ...freeMeds])];
  const medsRecorded = medLabels.length > 0 || !!p?.currentMedications?.trim();
  const allTags = await db.medicationTag.findMany({ where: { active: true }, select: { id: true, label: true, kind: true } });
  const medKeys = new Set(medLabels.flatMap((m) => nameKeys(m)));
  const currentMedTags = allTags.filter((t) => nameKeys(t.label).some((k) => medKeys.has(k)));
  const currentMedIds = new Set(currentMedTags.map((t) => t.id));
  const historyText = [p?.chronicConditions, p?.medicalHistory, p?.currentMedications, ...medLabels].filter(Boolean).join(" ; ");
  const conditions = conditionsIn(historyText);
  // Pregnancy: the status recorded at Stage 5 case readiness, else pregnancy-related complaints / regions.
  const pregnancyRecorded = visit.pregnancyStatus === "pregnant" || ctx.regions.some((r) => /obstetric|pregnan/i.test(r.label)) || ctx.complaints.some((c) => /pregnan/i.test(c.label));
  const female = ctx.sex === "female";
  const childbearing = female && ctx.age != null && ctx.age >= 14 && ctx.age <= 50;
  const warningSigns = visit.redFlagScreening?.answers.map((a) => a.criterionLabel) || [];
  const suMizaj = visit.tashkheesDossier?.suMizajQuality ?? null;
  const alreadyPrescribed = new Set((visit.tashkheesDossier?.prescriptions || []).map((x) => x.tagId).filter(Boolean) as string[]);

  const urgent: string[] = [];
  if (warningSigns.length) urgent.push(`Emergency warning signs recorded: ${warningSigns.slice(0, 3).join("; ")} — urgent clinical evaluation comes first.`);
  if (visit.referral) urgent.push(`Patient referred to ${visit.referral.referredTo}.`);
  const infoNeeded: string[] = [];
  if (!ctx.complaints.length) infoNeeded.push("No complaints recorded — suggestions need the chief complaints (Stage 2–3).");
  if (!allergyRecorded) infoNeeded.push("Allergies not recorded — verify allergy status before any medicine.");
  if (!medsRecorded) infoNeeded.push("Current medicines not recorded — medication reconciliation needed (interaction checks can't run).");
  if (childbearing && !pregnancyRecorded) infoNeeded.push("Pregnancy / breastfeeding status not recorded for a woman of child-bearing age — confirm before choosing.");
  if (ctx.age == null) infoNeeded.push("Age not recorded — children / older-adult cautions can't be checked.");
  const unmatchedMeds = medLabels.filter((m) => !nameKeys(m).some((k) => allTags.some((t) => nameKeys(t.label).includes(k))));
  if (unmatchedMeds.length) infoNeeded.push(`Current medicines not found in the database (interactions unchecked): ${unmatchedMeds.slice(0, 4).join(", ")}.`);

  // ---- 2. Candidates from indication / symptom links
  const complaintRows = ctx.complaints.length
    ? await db.chiefComplaint.findMany({ where: { label: { in: ctx.complaints.map((c) => c.label) } }, select: { id: true, label: true } })
    : [];
  const symptomRows = ctx.symptoms.length ? await db.acuteSymptomTag.findMany({ where: { label: { in: ctx.symptoms } }, select: { id: true, label: true } }) : [];
  const primaryLabel = ctx.complaints.find((c) => c.primary)?.label;
  const [cLinks, sLinks] = await Promise.all([
    complaintRows.length ? db.supplementComplaintLink.findMany({
      where: { complaintId: { in: complaintRows.map((c) => c.id) }, verificationStatus: { not: "rejected" }, profile: { tag: { active: true, kind: { in: ["supplement", "medication"] } } } },
      select: { relationType: true, evidenceType: true, verificationStatus: true, complaint: { select: { label: true } }, profile: { select: { tagId: true, tag: { select: { kind: true } } } } },
    }) : [],
    symptomRows.length ? db.supplementSymptomLink.findMany({
      where: { symptomId: { in: symptomRows.map((s) => s.id) }, verificationStatus: { not: "rejected" }, profile: { tag: { active: true, kind: { in: ["supplement", "medication"] } } } },
      select: { evidenceType: true, verificationStatus: true, symptom: { select: { label: true } }, profile: { select: { tagId: true } } },
    }) : [],
  ]);
  type Acc = { score: number; reasons: string[]; traditional: boolean; clinical: boolean; verified: boolean; notRecommended?: string };
  const acc = new Map<string, Acc>();
  const get = (id: string) => { let a = acc.get(id); if (!a) { a = { score: 0, reasons: [], traditional: false, clinical: false, verified: false }; acc.set(id, a); } return a; };
  for (const l of cLinks) {
    const a = get(l.profile.tagId);
    if (l.relationType === "not_recommended") { a.notRecommended = l.complaint.label; continue; }
    if (l.relationType === "off_label") continue; // never suggested on an off-label use
    const primary = l.complaint.label === primaryLabel;
    a.score += primary ? 6 : 4;
    a.reasons.push(`${l.relationType === "traditional_use" ? "Traditionally used for" : l.relationType === "symptom_relief" ? "Symptom relief for" : l.relationType === "evidence_supported" ? "Evidence supports use for" : "Indicated for"} ${l.complaint.label}`);
    if (l.evidenceType === "clinical" || l.relationType === "evidence_supported" || l.profile.tag.kind === "medication") { a.clinical = true; a.score += 1; }
    else a.traditional = true;
    if (l.verificationStatus === "verified") { a.verified = true; a.score += 2; }
  }
  for (const l of sLinks) {
    const a = get(l.profile.tagId);
    a.score += 2;
    a.reasons.push(`Used for ${l.symptom.label}`);
    if (l.evidenceType === "clinical") a.clinical = true; else a.traditional = true;
    if (l.verificationStatus === "verified") a.verified = true;
  }

  const ids = [...acc.keys()];
  const profiles = ids.length ? await db.supplementProfile.findMany({
    where: { tagId: { in: ids } },
    select: {
      tagId: true, unaniName: true, genericName: true, rxStatus: true, herbType: true, mizaj: true, completeness: true, tag: { select: { label: true, kind: true } },
      allergies: { where: { relation: "caution", verificationStatus: { not: "rejected" } }, select: { verificationStatus: true, allergy: { select: { label: true } } } },
      ingredients: { where: { verificationStatus: { not: "rejected" } }, select: { name: true, ingredientTagId: true } },
      safetyItems: { where: { verificationStatus: { not: "rejected" } }, select: { category: true, text: true, severity: true, verificationStatus: true, medicationTagId: true, medication: { select: { label: true } } } },
    },
  }) : [];

  // ---- 3. Safety
  const unani: Candidate[] = [];
  const supplements: Candidate[] = [];
  const allopathic: Candidate[] = [];
  const excluded: Excluded[] = [];
  // Interactions are checked against what the patient already takes and what is prescribed in this visit.
  const interactsWith = (id: string | null) => !!id && (currentMedIds.has(id) || alreadyPrescribed.has(id));
  const whereFrom = (id: string | null) => (id && currentMedIds.has(id) ? "current medicine" : "prescribed in this visit");
  const condPatterns = CONDITIONS.filter((c) => conditions.includes(c.key));
  for (const pr of profiles) {
    const a = acc.get(pr.tagId)!;
    const label = pr.tag.label;
    if (a.notRecommended) { excluded.push({ tagId: pr.tagId, label, reason: `Marked "not recommended" for ${a.notRecommended}`, verified: false }); continue; }
    if (alreadyPrescribed.has(pr.tagId)) continue;
    const notes: SafetyNote[] = [];
    let block: { reason: string; verified: boolean } | null = null;

    // Allergy & cross-reactivity (recorded allergy ↔ caution links / ingredients)
    for (const al of pr.allergies) {
      if (nameKeys(al.allergy.label).some((k) => allergyKeys.has(k))) block ??= { reason: `Patient allergy: ${al.allergy.label} (contains or may cross-react)`, verified: al.verificationStatus === "verified" };
    }
    for (const ing of pr.ingredients) {
      if (nameKeys(ing.name).some((k) => allergyKeys.has(k))) block ??= { reason: `Contains ${ing.name} — patient allergy recorded`, verified: false };
      if (ing.ingredientTagId && currentMedIds.has(ing.ingredientTagId)) notes.push({ level: "caution", text: `Duplicate ingredient: contains ${ing.name}, which the patient already takes`, verified: false });
    }
    if (currentMedIds.has(pr.tagId)) notes.push({ level: "caution", text: "Patient already takes this — avoid duplication", verified: false });

    for (const s of pr.safetyItems) {
      const verified = s.verificationStatus === "verified";
      const high = s.severity === "high";
      const say = (level: SafetyNote["level"], text: string) => notes.push({ level, text, verified });
      switch (s.category) {
        case "interaction":
          if (interactsWith(s.medicationTagId)) {
            if (high) block ??= { reason: `Serious interaction with ${s.medication?.label} (${whereFrom(s.medicationTagId)}): ${s.text}`, verified };
            else say("caution", `Interaction with ${s.medication?.label} (${whereFrom(s.medicationTagId)}): ${s.text}`);
          }
          break;
        case "pregnancy":
          if (pregnancyRecorded) { if (high) block ??= { reason: `Pregnancy: ${s.text}`, verified }; else say("caution", `Pregnancy: ${s.text}`); }
          else if (childbearing) say("info", `If pregnant: ${s.text}`);
          break;
        case "lactation":
          if (childbearing) say("info", `If breastfeeding: ${s.text}`);
          break;
        case "pediatric":
          if (ctx.age != null && ctx.age < 12) { if (high) block ??= { reason: `Children: ${s.text}`, verified }; else say("caution", `Children: ${s.text}`); }
          break;
        case "geriatric":
          if (ctx.age != null && ctx.age >= 65) say("caution", `Older adults: ${s.text}`);
          break;
        case "renal":
          if (conditions.includes("kidney") || conditions.includes("kidney_stones")) say(high ? "high" : "caution", `Kidney: ${s.text}`);
          break;
        case "hepatic":
          if (conditions.includes("liver")) say(high ? "high" : "caution", `Liver: ${s.text}`);
          break;
        case "contraindication": {
          const hit = condPatterns.find((c) => c.match.test(s.text));
          if (hit) { if (high) block ??= { reason: `Contraindicated with ${conditionLabel(hit.key).toLowerCase()}: ${s.text}`, verified }; else say("high", `Contraindication (${conditionLabel(hit.key).toLowerCase()}): ${s.text}`); }
          break;
        }
        case "allergy_warning":
          if (allergyNames.some((n) => s.text.toLowerCase().includes(n.toLowerCase()))) block ??= { reason: `Allergy warning: ${s.text}`, verified };
          break;
        default: break;
      }
    }
    if (block) { excluded.push({ tagId: pr.tagId, label, reason: block.reason, verified: block.verified }); continue; }

    // Temperament (traditional) — opposite to the present dyscrasia is favoured.
    if (suMizaj && pr.mizaj) {
      const hot = /hot|haar/i.test(pr.mizaj) ? 1 : /cold|barid/i.test(pr.mizaj) ? -1 : 0;
      const moist = /moist|ratab|wet/i.test(pr.mizaj) ? 1 : /dry|yabis/i.test(pr.mizaj) ? -1 : 0;
      const ax: Record<string, [number, number]> = { Safrawi: [1, -1], Damawi: [1, 1], Balghami: [-1, 1], Saudawi: [-1, -1], Haar: [1, 0], Barid: [-1, 0], Ratab: [0, 1], Yabis: [0, -1] };
      const pa = ax[suMizaj];
      if (pa) {
        const t = -(hot * pa[0] + moist * pa[1]);
        if (t > 0) { a.score += 2; a.reasons.push(`Temperament ${pr.mizaj} balances ${suMizaj}`); }
        else if (t < 0) { a.score -= 2; notes.push({ level: "info", text: `Temperament ${pr.mizaj} adds to ${suMizaj}`, verified: false }); }
      }
    }
    const allo = pr.tag.kind === "medication";
    if (allo && pr.rxStatus) notes.push({ level: "info", text: `Prescription status: ${pr.rxStatus}`, verified: false });
    const cand: Candidate = {
      tagId: pr.tagId, label, unaniName: allo ? pr.genericName : pr.unaniName, herbType: pr.herbType, mizaj: pr.mizaj,
      category: allo ? "allopathic" : SUPPLEMENT_TYPES.test(pr.herbType || "") ? "supplement" : "unani",
      reasons: [...new Set(a.reasons)].slice(0, 4), evidence: { traditional: a.traditional, clinical: a.clinical, verified: a.verified },
      safety: notes.sort((x, y) => (x.level === "high" ? 0 : x.level === "caution" ? 1 : 2) - (y.level === "high" ? 0 : y.level === "caution" ? 1 : 2)).slice(0, 6),
      completeness: pr.completeness, score: a.score - notes.filter((n) => n.level === "high").length * 3 - notes.filter((n) => n.level === "caution").length,
    };
    // Supplements are not suggested for vague complaints alone — flag that a deficiency
    // or investigation should support the use, and rank them lower.
    if (cand.category === "supplement") {
      cand.safety.unshift({ level: "info", text: "Consider only if a deficiency or clinical need is confirmed (e.g. by investigation) — not for general wellness alone", verified: false });
      cand.score -= 3;
    }
    (cand.category === "unani" ? unani : cand.category === "allopathic" ? allopathic : supplements).push(cand);
  }

  const sortC = (l: Candidate[]) => l.sort((x, y) => y.score - x.score);
  let unaniOut = sortC(unani);
  let method: "rules" | "ranked" | "rules-fallback" = "rules";
  if (cfg.ranking && unaniOut.length > cfg.maxPerCategory) {
    const ranked = await Promise.race([
      rankCdsCandidates(
        { complaints: ctx.complaints.map((c) => c.label), symptoms: ctx.symptoms, suMizaj, conditions: conditions.map(conditionLabel) },
        unaniOut.slice(0, 15).map((c) => ({ id: c.tagId, label: `${c.label}${c.herbType ? ` (${c.herbType})` : ""} — ${c.reasons.join("; ")}` })),
        cfg.maxPerCategory,
      ).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    const valid = (ranked || []).filter((id) => unaniOut.some((c) => c.tagId === id));
    if (valid.length) {
      const picked = [...new Set(valid)].map((id) => unaniOut.find((c) => c.tagId === id)!);
      unaniOut = [...picked, ...unaniOut.filter((c) => !picked.includes(c))];
      method = "ranked";
    } else method = "rules-fallback";
  }
  if (!unani.length && !supplements.length && !allopathic.length && ctx.complaints.length) infoNeeded.push("No suitable option found in the current database for the recorded complaints.");

  const result: CdsResult = {
    urgent, infoNeeded,
    unani: unaniOut.slice(0, cfg.maxPerCategory),
    supplements: sortC(supplements).slice(0, cfg.maxPerCategory),
    allopathic: sortC(allopathic).slice(0, cfg.maxPerCategory),
    excluded: excluded.slice(0, 20),
    currentMeds: medLabels.map((m) => ({ label: m, matched: !unmatchedMeds.includes(m) })),
    basis: { complaints: ctx.complaints.map((c) => c.label), symptoms: ctx.symptoms, conditions: conditions.map(conditionLabel), allergies: allergyNames, suMizaj, age: ctx.age, sex: ctx.sex },
  };
  const hash = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 16);
  // De-identified context summary kept with the session (no names, contact or ids).
  const context = { complaints: result.basis.complaints, symptoms: ctx.symptoms, regions: ctx.regions.map((r) => r.label), conditions: result.basis.conditions, allergies: allergyNames, currentMeds: medLabels, suMizaj, age: ctx.age, sex: ctx.sex, pregnancyRecorded, warningSigns };
  return { result, method, context, contextHash: hash(context), configVersion: hash({ cfg, n: allTags.length }), latencyMs: Date.now() - started };
}
