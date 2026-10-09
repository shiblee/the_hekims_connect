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
  id: true, careClassification: true, diagnosis: true, treatmentObjective: true,
  plannedInvestigations: true, plannedModalities: true, referralRequired: true, referralNotes: true,
  reviewDate: true, clinicalNotes: true, createdAt: true, updatedAt: true,
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

  const plan = await db.treatmentPlan.findUnique({ where: { visitId: id }, select: SELECT });
  return NextResponse.json({ plan });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isDoctor(auth))) {
    return NextResponse.json({ error: "Only a doctor can record a treatment plan" }, { status: 403 });
  }
  const facilityId = await resolveFacilityId(auth);
  if (!facilityId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const visit = await assertOwnedVisit(id, facilityId);
  if (!visit) return NextResponse.json({ error: "Visit not found" }, { status: 404 });

  const body = await req.json();
  if (!body.careClassification || !String(body.careClassification).trim()) {
    return NextResponse.json({ error: "Care classification is required" }, { status: 400 });
  }

  const data = {
    careClassification: String(body.careClassification).trim(),
    diagnosis: body.diagnosis || null,
    treatmentObjective: body.treatmentObjective || null,
    plannedInvestigations: body.plannedInvestigations || null,
    plannedModalities: body.plannedModalities || null,
    referralRequired: !!body.referralRequired,
    referralNotes: body.referralNotes || null,
    reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
    clinicalNotes: body.clinicalNotes || null,
    recordedById: auth.type === "staff" ? auth.id : null,
  };

  const plan = await db.treatmentPlan.upsert({
    where: { visitId: id },
    update: data,
    create: { visitId: id, ...data },
    select: SELECT,
  });

  return NextResponse.json({ plan });
}
