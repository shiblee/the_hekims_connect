// One medicine safety check for Stage 5 — used by the prescription check on the
// medicine lines and by the safety review before finalising. Conservative:
// safety data is applied even when unverified (and labelled so).
//
//   allergy & cross-reactivity · duplicate ingredients / already taking ·
//   interactions with current medicines · pregnancy / breastfeeding (from the
//   status recorded at Stage 5; "if pregnant" notes while it isn't recorded) ·
//   children · older adults · kidney · liver · contraindications matching the
//   patient's recorded conditions.

import { db } from "@/lib/db";
import { nameKeys } from "@/lib/catalog-names";
import { CONDITIONS, conditionLabel, conditionsIn, type ConditionKey } from "@/lib/ghiza-conditions";

export interface SafetyNote { level: "high" | "caution" | "info"; text: string; verified: boolean }
export interface PatientSafety {
  allergyNames: string[]; allergyKeys: Set<string>; allergiesRecorded: boolean;
  medLabels: string[]; currentMedIds: Set<string>; medsRecorded: boolean;
  conditions: ConditionKey[]; female: boolean; age: number | null; childbearing: boolean;
  pregnancy: string | null; // "pregnant" | "breastfeeding" | "neither" | "unknown" | null
}

const NONE = /^(no|none|nil|na|n\/a|none known|nkda|not known)$/i;
const parse = <T,>(s: string | null | undefined, fb: T): T => { try { return s ? (JSON.parse(s) as T) : fb; } catch { return fb; } };
const clean = (a: string) => a.replace(/\(.*?\)/g, "").trim();

export async function loadPatientSafety(patientId: string, visitId?: string | null): Promise<PatientSafety> {
  const [p, intake, visit] = await Promise.all([
    db.patient.findUnique({ where: { id: patientId }, select: { allergies: true, gender: true, dob: true, currentMedications: true, chronicConditions: true, medicalHistory: true } }),
    visitId ? db.visitIntake.findUnique({ where: { visitId }, select: { allergies: true, medications: true } }) : null,
    visitId ? db.visit.findUnique({ where: { id: visitId }, select: { pregnancyStatus: true } }) : null,
  ]);
  const intakeAllergies = parse<string[]>(intake?.allergies, []);
  const allergyRaw = [...(p?.allergies || "").split(/[,;\n]/), ...intakeAllergies].map((a) => clean(String(a))).filter(Boolean);
  const allergyNames = allergyRaw.filter((a) => !NONE.test(a));
  const intakeMeds = parse<{ label: string; kind: string }[]>(intake?.medications, []).map((m) => m?.label).filter(Boolean) as string[];
  const medRaw = [...(p?.currentMedications || "").split(/[,;\n]/), ...intakeMeds].map((m) => clean(String(m))).filter(Boolean);
  const medLabels = [...new Set(medRaw.filter((m) => !NONE.test(m)))];
  const medKeys = new Set(medLabels.flatMap((m) => nameKeys(m)));
  const tags = medKeys.size ? await db.medicationTag.findMany({ where: { active: true }, select: { id: true, label: true } }) : [];
  const female = (p?.gender || "").toLowerCase().startsWith("f");
  const age = p?.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (365.25 * 86_400_000)) : null;
  return {
    allergyNames, allergyKeys: new Set(allergyNames.flatMap((a) => nameKeys(a))), allergiesRecorded: allergyRaw.length > 0,
    medLabels, currentMedIds: new Set(tags.filter((t) => nameKeys(t.label).some((k) => medKeys.has(k))).map((t) => t.id)), medsRecorded: medRaw.length > 0,
    conditions: [...new Set(conditionsIn([p?.chronicConditions, p?.medicalHistory, p?.currentMedications, ...medLabels].filter(Boolean).join(" ; ")))],
    female, age, childbearing: female && (age == null || (age >= 12 && age <= 55)), pregnancy: visit?.pregnancyStatus ?? null,
  };
}

/** Safety notes per catalogue medicine (tag id) for this patient. */
export async function checkMedicines(ps: PatientSafety, tagIds: string[]): Promise<Record<string, SafetyNote[]>> {
  const ids = [...new Set(tagIds)].slice(0, 40);
  if (!ids.length) return {};
  const profiles = await db.supplementProfile.findMany({
    where: { tagId: { in: ids } },
    select: {
      tagId: true,
      allergies: { where: { relation: "caution", verificationStatus: { not: "rejected" } }, select: { verificationStatus: true, allergy: { select: { label: true } } } },
      ingredients: { where: { verificationStatus: { not: "rejected" } }, select: { name: true, ingredientTagId: true } },
      safetyItems: { where: { verificationStatus: { not: "rejected" } }, select: { category: true, text: true, severity: true, verificationStatus: true, medicationTagId: true, medication: { select: { label: true } } } },
    },
  });
  const condPatterns = CONDITIONS.filter((c) => ps.conditions.includes(c.key));
  const out: Record<string, SafetyNote[]> = {};
  for (const pr of profiles) {
    const notes: SafetyNote[] = [];
    const say = (level: SafetyNote["level"], text: string, verified = false) => { if (!notes.some((n) => n.text === text)) notes.push({ level, text, verified }); };
    for (const al of pr.allergies) {
      if (nameKeys(al.allergy.label).some((k) => ps.allergyKeys.has(k))) say("high", `Patient is allergic to ${al.allergy.label} — this preparation contains or may cross-react with it.`, al.verificationStatus === "verified");
    }
    for (const ing of pr.ingredients) {
      if (nameKeys(ing.name).some((k) => ps.allergyKeys.has(k))) say("high", `Contains ${ing.name} — patient allergy recorded.`);
      if (ing.ingredientTagId && ps.currentMedIds.has(ing.ingredientTagId)) say("caution", `Duplicate ingredient: contains ${ing.name}, which the patient already takes.`);
    }
    if (ps.currentMedIds.has(pr.tagId)) say("caution", "Patient already takes this — avoid duplication.");
    for (const s of pr.safetyItems) {
      const verified = s.verificationStatus === "verified";
      const high = s.severity === "high";
      switch (s.category) {
        case "interaction":
          if (s.medicationTagId && ps.currentMedIds.has(s.medicationTagId)) say(high ? "high" : "caution", `Interaction with ${s.medication?.label} (patient's current medicine): ${s.text}`, verified);
          break;
        case "allergy_warning":
          if (ps.allergyNames.some((n) => s.text.toLowerCase().includes(n.toLowerCase()))) say("high", s.text, verified);
          break;
        case "pregnancy":
          if (ps.pregnancy === "pregnant") say(high ? "high" : "caution", `Pregnancy: ${s.text}`, verified);
          else if (ps.childbearing && (ps.pregnancy == null || ps.pregnancy === "unknown")) say("info", `If pregnant: ${s.text}`, verified);
          break;
        case "lactation":
          if (ps.pregnancy === "breastfeeding") say(high ? "high" : "caution", `Breastfeeding: ${s.text}`, verified);
          else if (ps.childbearing && (ps.pregnancy == null || ps.pregnancy === "unknown")) say("info", `If breastfeeding: ${s.text}`, verified);
          break;
        case "pediatric":
          if (ps.age != null && ps.age < 12) say(high ? "high" : "caution", `Children: ${s.text}`, verified);
          break;
        case "geriatric":
          if (ps.age != null && ps.age >= 65) say("caution", `Older adults: ${s.text}`, verified);
          break;
        case "renal":
          if (ps.conditions.includes("kidney") || ps.conditions.includes("kidney_stones")) say(high ? "high" : "caution", `Kidney: ${s.text}`, verified);
          break;
        case "hepatic":
          if (ps.conditions.includes("liver")) say(high ? "high" : "caution", `Liver: ${s.text}`, verified);
          break;
        case "contraindication": {
          const hit = condPatterns.find((c) => c.match.test(s.text));
          if (hit) say("high", `Contraindicated with ${conditionLabel(hit.key).toLowerCase()}: ${s.text}`, verified);
          else say("info", `Contraindication to consider: ${s.text}`, verified);
          break;
        }
        default: break;
      }
    }
    if (notes.length) out[pr.tagId] = notes.sort((a, b) => ["high", "caution", "info"].indexOf(a.level) - ["high", "caution", "info"].indexOf(b.level));
  }
  return out;
}
