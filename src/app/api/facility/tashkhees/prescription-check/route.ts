import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor, patientInScope } from "@/lib/reports-server";
import { nameKeys } from "@/lib/catalog-names";

const NONE = /^(no|none|nil|na|n\/a|none known|nkda)$/i;

/**
 * Safety check for Ilaj-bil-Dawa lines against the patient: each herb's
 * researched profile (allergy cautions, interactions with allopathic
 * medicines, pregnancy/lactation/paediatric cautions) is compared with the
 * patient's recorded allergies, current medicines, sex and age. Warnings
 * only — the Hakim decides. Body { patientId, visitId, tagIds: string[] }.
 */
export async function POST(req: NextRequest) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const tagIds: string[] = Array.isArray(b.tagIds) ? b.tagIds.filter((x: unknown) => typeof x === "string").slice(0, 40) : [];
  if (typeof b.patientId !== "string" || !(await patientInScope(b.patientId, actor.facilityId))) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }
  if (!tagIds.length) return NextResponse.json({ warnings: {} });

  const [patient, intake, profiles] = await Promise.all([
    db.patient.findUnique({ where: { id: b.patientId }, select: { allergies: true, gender: true, dob: true, currentMedications: true } }),
    typeof b.visitId === "string" ? db.visitIntake.findUnique({ where: { visitId: b.visitId }, select: { allergies: true, medications: true } }) : null,
    db.supplementProfile.findMany({
      where: { tagId: { in: tagIds } },
      select: {
        tagId: true,
        allergies: { where: { relation: "caution", verificationStatus: { not: "rejected" } }, select: { allergy: { select: { label: true } } } },
        safetyItems: { where: { verificationStatus: { not: "rejected" } }, select: { category: true, text: true, severity: true, verificationStatus: true, medication: { select: { label: true } } } },
      },
    }),
  ]);

  const parse = (s: string | null | undefined): unknown[] => { try { return s ? JSON.parse(s) : []; } catch { return []; } };
  const allergyNames = [
    ...(patient?.allergies || "").split(/[,;\n]/),
    ...(parse(intake?.allergies) as string[]),
  ].map((a) => String(a).replace(/\(.*?\)/g, "").trim()).filter((a) => a && !NONE.test(a));
  const allergyKeys = new Set(allergyNames.flatMap((a) => nameKeys(a)));
  // Current medicines from today's intake and from the patient's own record.
  const meds = [
    ...(parse(intake?.medications) as { label: string; kind: string }[]).filter((m) => m?.kind === "medication"),
    ...(patient?.currentMedications || "").split(/[,;\n]/).map((label) => ({ label: label.replace(/\(.*?\)/g, "").trim(), kind: "medication" })),
  ].filter((m, i, all) => m.label && !NONE.test(m.label) && all.findIndex((x) => x.label.toLowerCase() === m.label.toLowerCase()) === i);
  const medKeys = new Set(meds.flatMap((m) => nameKeys(m.label)));
  const female = (patient?.gender || "").toLowerCase() === "female";
  const ageYears = patient?.dob ? (Date.now() - new Date(patient.dob).getTime()) / (365.25 * 86400000) : null;

  const warnings: Record<string, { level: "high" | "caution" | "info"; text: string; verified: boolean }[]> = {};
  for (const p of profiles) {
    const out: (typeof warnings)[string] = [];
    for (const a of p.allergies) {
      if (nameKeys(a.allergy.label).some((k) => allergyKeys.has(k))) out.push({ level: "high", text: `Patient is allergic to ${a.allergy.label} — this preparation contains or may cross-react with it.`, verified: false });
    }
    for (const s of p.safetyItems) {
      const verified = s.verificationStatus === "verified";
      if (s.category === "interaction" && s.medication && nameKeys(s.medication.label).some((k) => medKeys.has(k))) {
        out.push({ level: s.severity === "high" ? "high" : "caution", text: `Interaction with ${s.medication.label} (patient's current medicine): ${s.text}`, verified });
      } else if (s.category === "allergy_warning" && allergyNames.some((a) => s.text.toLowerCase().includes(a.toLowerCase()))) {
        out.push({ level: "high", text: s.text, verified });
      } else if (female && (s.category === "pregnancy" || s.category === "lactation")) {
        out.push({ level: "caution", text: `${s.category === "pregnancy" ? "Pregnancy" : "Breastfeeding"}: ${s.text}`, verified });
      } else if (ageYears != null && ageYears < 12 && s.category === "pediatric") {
        out.push({ level: "caution", text: `Children: ${s.text}`, verified });
      } else if (s.category === "contraindication") {
        out.push({ level: "info", text: `Contraindication to consider: ${s.text}`, verified });
      }
    }
    if (out.length) warnings[p.tagId] = out;
  }
  return NextResponse.json({ warnings, checkedAgainst: { allergies: allergyNames, medicines: meds.map((m) => m.label), female } });
}
