import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isDoctor } from "@/lib/api-auth";
import { recomputeHumoralAssessment, syncVisitIntakeToLabels, clearClinicalRoutingInsight } from "@/lib/complaint-sync";

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

async function assertOwnedVisit(id: string, facilityId: string) {
  return db.visit.findFirst({ where: { id, facilityId }, select: { id: true } });
}

const COMPLAINT_SELECT = {
  id: true, chiefComplaintId: true, chiefComplaintLabel: true, onsetValue: true, onsetUnit: true, onsetPattern: true,
  severityScore: true, character: true, associatedManifestations: true, aggravatingFactors: true, relievingFactors: true,
  clinicalNotes: true, screeningAnswers: true, sortOrder: true, createdAt: true, updatedAt: true,
};

const HUMORAL_SELECT = {
  id: true, safraPercent: true, damPercent: true, saudaPercent: true, balghamPercent: true,
  dominant: true, dominantOverride: true, breakdown: true, computedAt: true,
  aiClue: true, aiClueGeneratedAt: true,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const [complaints, humoralAssessment] = await Promise.all([
    db.complaintAssessment.findMany({ where: { visitId: id }, orderBy: { sortOrder: "asc" }, select: COMPLAINT_SELECT }),
    db.humoralAssessment.findUnique({ where: { visitId: id }, select: HUMORAL_SELECT }),
  ]);

  return NextResponse.json({ complaints, humoralAssessment });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isDoctor(auth))) {
    return NextResponse.json({ error: "Only a doctor can record a clinical complaint assessment" }, { status: 403 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await req.json();
  const submitted: any[] = Array.isArray(body.complaints) ? body.complaints : [];
  const recordedById = auth.type === "staff" ? auth.id : null;

  const rows = submitted.map((c, i) => ({
    visitId: id,
    chiefComplaintId: c.chiefComplaintId || null,
    chiefComplaintLabel: String(c.chiefComplaintLabel || "").trim(),
    onsetValue: c.onsetValue !== "" && c.onsetValue != null ? parseInt(String(c.onsetValue), 10) : null,
    onsetUnit: c.onsetUnit || null,
    onsetPattern: c.onsetPattern || null,
    severityScore: c.severityScore !== "" && c.severityScore != null ? parseInt(String(c.severityScore), 10) : null,
    character: c.character || null,
    associatedManifestations: JSON.stringify(Array.isArray(c.associatedManifestations) ? c.associatedManifestations : []),
    aggravatingFactors: JSON.stringify(Array.isArray(c.aggravatingFactors) ? c.aggravatingFactors : []),
    relievingFactors: JSON.stringify(Array.isArray(c.relievingFactors) ? c.relievingFactors : []),
    clinicalNotes: c.clinicalNotes || null,
    screeningAnswers: JSON.stringify(c.screeningAnswers && typeof c.screeningAnswers === "object" ? c.screeningAnswers : {}),
    sortOrder: i,
    recordedById,
  })).filter((r) => r.chiefComplaintLabel);

  // Full replace-by-visit — same delete+recreate convention L1Screening.answers
  // uses, since complaints can be added/removed between saves, not just edited.
  await db.$transaction([
    db.complaintAssessment.deleteMany({ where: { visitId: id } }),
    ...(rows.length ? [db.complaintAssessment.createMany({ data: rows })] : []),
  ]);

  // Keep the Registration wizard's simple selector (VisitIntake) in step
  // with whatever the doctor just added/removed here — these two surfaces
  // are one list, viewed two ways, not two independently-maintained lists.
  await syncVisitIntakeToLabels(id, rows.map((r) => r.chiefComplaintLabel));

  const [complaints, humoralAssessment] = await Promise.all([
    db.complaintAssessment.findMany({ where: { visitId: id }, orderBy: { sortOrder: "asc" }, select: COMPLAINT_SELECT }),
    recomputeHumoralAssessment(id),
  ]);

  // The chief complaint set feeding Clinical Routing just changed — any
  // previously generated suggestion now describes stale data.
  await clearClinicalRoutingInsight(id);

  return NextResponse.json({ complaints, humoralAssessment });
}
