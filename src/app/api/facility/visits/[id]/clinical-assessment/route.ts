import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, isDoctor } from "@/lib/api-auth";

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

const SELECT = {
  id: true, clinicalFindings: true, workingDiagnosis: true, treatmentRationale: true,
  requiresInvestigation: true, requiresUrgentReferral: true, notes: true, createdAt: true, updatedAt: true,
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

  const assessment = await db.clinicalAssessment.findUnique({ where: { visitId: id }, select: SELECT });
  return NextResponse.json({ assessment });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isDoctor(auth))) {
    return NextResponse.json({ error: "Only a doctor can record a clinical assessment" }, { status: 403 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await req.json();
  const data = {
    clinicalFindings: body.clinicalFindings || null,
    workingDiagnosis: body.workingDiagnosis || null,
    treatmentRationale: body.treatmentRationale || null,
    requiresInvestigation: !!body.requiresInvestigation,
    requiresUrgentReferral: !!body.requiresUrgentReferral,
    notes: body.notes || null,
    recordedById: auth.type === "staff" ? auth.id : null,
  };

  const assessment = await db.clinicalAssessment.upsert({
    where: { visitId: id },
    update: data,
    create: { visitId: id, ...data },
    select: SELECT,
  });

  return NextResponse.json({ assessment });
}
