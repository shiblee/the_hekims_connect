import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { clearClinicalRoutingInsight } from "@/lib/complaint-sync";

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

const SELECT = { id: true, symptoms: true, createdAt: true, updatedAt: true };

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

  const assessment = await db.acuteSymptomAssessment.findUnique({ where: { visitId: id }, select: SELECT });
  return NextResponse.json({ assessment });
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
  const symptoms: string[] = Array.isArray(body.symptoms) ? body.symptoms.filter((s: unknown) => typeof s === "string" && s.trim()) : [];
  const recordedById = auth.staffId ?? null;

  const assessment = await db.acuteSymptomAssessment.upsert({
    where: { visitId: id },
    update: { symptoms: JSON.stringify(symptoms), recordedById },
    create: { visitId: id, symptoms: JSON.stringify(symptoms), recordedById },
    select: SELECT,
  });
  await clearClinicalRoutingInsight(id);
  return NextResponse.json({ assessment });
}
