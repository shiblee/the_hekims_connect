import { NextRequest, NextResponse } from "next/server";
import { getClinicActor, patientInScope } from "@/lib/reports-server";
import { checkMedicines, loadPatientSafety } from "@/lib/medicine-safety";

/**
 * Safety check for Ilaj-bil-Dawa lines against the patient (shared medicine safety module):
 * allergy, interactions, duplicates, pregnancy / breastfeeding, children, older adults, kidney,
 * liver and contraindications. Warnings only — the Hakim decides. Body { patientId, visitId, tagIds: string[] }.
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
  const ps = await loadPatientSafety(b.patientId, typeof b.visitId === "string" ? b.visitId : null);
  const warnings = await checkMedicines(ps, tagIds);
  return NextResponse.json({ warnings, checkedAgainst: { allergies: ps.allergyNames, medicines: ps.medLabels, female: ps.female, pregnancy: ps.pregnancy } });
}
