import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { formatAge } from "@/lib/age";
import { generateScreeningSummary } from "@/lib/gemini";

async function resolveFacilityId(auth: { id: string; type: "facility" | "patient" | "staff" }): Promise<string | null> {
  if (auth.type === "facility") return auth.id;
  if (auth.type === "staff") {
    const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true } });
    return staff?.facilityId ?? null;
  }
  return null;
}

async function assertOwnedVisit(id: string, facilityId: string) {
  return db.visit.findFirst({
    where: { id, facilityId },
    select: {
      id: true, patientId: true, visitCode: true, visitDate: true,
      patient: { select: { id: true, patientCode: true, name: true, gender: true, dob: true, bloodGroup: true, phone: true, avatarColor: true, mizaj: true } },
    },
  });
}

const SCREENING_SELECT = { id: true, chiefComplaints: true, aiSummary: true, createdAt: true, updatedAt: true };

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

  const screening = await db.l1Screening.findUnique({ where: { visitId: id }, select: SCREENING_SELECT });

  return NextResponse.json({
    visit: { id: visit.id, visitCode: visit.visitCode, visitDate: visit.visitDate },
    patient: visit.patient,
    screening,
  });
}

// L1 Screening records which chief complaints the patient presents with, then
// asks Hakeem Insight for a short triage note on them.
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
  if (chiefComplaintIds.length === 0) {
    return NextResponse.json({ error: "Select at least one chief complaint" }, { status: 400 });
  }

  const complaints = await db.chiefComplaint.findMany({ where: { id: { in: chiefComplaintIds } }, select: { id: true, label: true } });
  // Stored as labels (not ids) so the record stays readable without a join
  // back to the (possibly later-edited) complaint list.
  const chiefComplaintLabels = complaints.map((c) => c.label);

  await db.l1Screening.upsert({
    where: { visitId: id },
    update: { chiefComplaints: JSON.stringify(chiefComplaintLabels), recordedById: auth.type === "staff" ? auth.id : null },
    create: { visitId: id, chiefComplaints: JSON.stringify(chiefComplaintLabels), recordedById: auth.type === "staff" ? auth.id : null },
  });

  const aiSummary = await generateScreeningSummary(
    { name: visit.patient.name, gender: visit.patient.gender, ageLabel: formatAge(visit.patient.dob), mizaj: visit.patient.mizaj },
    chiefComplaintLabels,
  );

  const updated = await db.l1Screening.update({ where: { visitId: id }, data: { aiSummary }, select: SCREENING_SELECT });
  return NextResponse.json({ screening: updated });
}
