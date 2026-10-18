import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { syncComplaintAssessmentsToLabels, recomputeHumoralAssessment, clearClinicalRoutingInsight } from "@/lib/complaint-sync";

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

const INTAKE_SELECT = {
  chiefComplaints: true, narrative: true, onsetTimeline: true,
  allergies: true, medications: true, mobility: true, createdAt: true, updatedAt: true,
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

  const intake = await db.visitIntake.findUnique({ where: { visitId: id }, select: INTAKE_SELECT });
  return NextResponse.json({ intake });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await req.json();
  const chiefComplaintIds: string[] = Array.isArray(body.chiefComplaintIds) ? body.chiefComplaintIds : [];
  const allergies: string[] = Array.isArray(body.allergies) ? body.allergies.filter((a: unknown) => typeof a === "string" && a.trim()) : [];
  const medications: { label: string; kind: string }[] = Array.isArray(body.medications)
    ? body.medications.filter((m: unknown): m is { label: string; kind: string } => !!m && typeof m === "object" && typeof (m as any).label === "string" && (m as any).label.trim())
    : [];

  const complaints = chiefComplaintIds.length
    ? await db.chiefComplaint.findMany({ where: { id: { in: chiefComplaintIds } }, select: { label: true } })
    : [];

  const recordedById = auth.staffId ?? null;
  const complaintLabels = complaints.map((c) => c.label);

  const data = {
    chiefComplaints: JSON.stringify(complaintLabels),
    narrative: body.narrative?.trim() || null,
    onsetTimeline: body.onsetTimeline || null,
    allergies: JSON.stringify(allergies),
    medications: JSON.stringify(medications),
    mobility: body.mobility || null,
    recordedById,
  };

  const intake = await db.visitIntake.upsert({
    where: { visitId: id },
    update: data,
    create: { visitId: id, ...data },
    select: INTAKE_SELECT,
  });

  // Keep the Clinical Record's Chief Complaint Matrix (ComplaintAssessment)
  // in step with whatever reception/the doctor just picked here — these two
  // surfaces are one list, viewed two ways, not two independent lists.
  await syncComplaintAssessmentsToLabels(id, complaintLabels, recordedById);
  await recomputeHumoralAssessment(id);
  await clearClinicalRoutingInsight(id);

  return NextResponse.json({ intake });
}
