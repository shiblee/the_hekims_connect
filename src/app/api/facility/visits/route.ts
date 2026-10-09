import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { nextVisitCode } from "@/lib/codes";

const SELECT = {
  id: true, visitCode: true, status: true, reasonForVisit: true, visitDate: true, createdAt: true,
  doctor: { select: { id: true, name: true, staffCode: true } },
  payments: { select: { id: true, paymentCode: true, amount: true, mode: true, status: true, createdAt: true } },
  vitalSigns: {
    select: {
      pulse: true, bpSystolic: true, bpDiastolic: true, spo2: true, oxygenLitres: true,
      temperatureF: true, temperatureC: true, respiratoryRate: true, consciousnessLevel: true,
      heightCm: true, weightKg: true, updatedAt: true,
    },
  },
  l1Screening: {
    select: {
      id: true, chiefComplaints: true, overallFlag: true, aiSummary: true, updatedAt: true,
      answers: { select: { flagTriggered: true } },
    },
  },
  clinicalAssessment: { select: { id: true, workingDiagnosis: true, requiresUrgentReferral: true, updatedAt: true } },
  treatmentPlan: { select: { id: true, careClassification: true, referralRequired: true, updatedAt: true } },
};

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId") || "";
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const visits = await db.visit.findMany({
    where: { facilityId: auth.id, patientId },
    select: SELECT,
    orderBy: { visitDate: "desc" },
  });
  return NextResponse.json({ visits });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { patientId, doctorId, reasonForVisit } = await req.json();
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }

  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  let validDoctorId: string | null = null;
  if (doctorId) {
    const doctor = await db.staff.findFirst({ where: { id: doctorId, facilityId: auth.id, active: true } });
    if (!doctor) {
      return NextResponse.json({ error: "Selected doctor was not found at this facility" }, { status: 400 });
    }
    validDoctorId = doctor.id;
  }

  const visitCode = await nextVisitCode();
  const visit = await db.visit.create({
    data: {
      visitCode,
      patientId,
      facilityId: auth.id,
      doctorId: validDoctorId,
      reasonForVisit: reasonForVisit || null,
    },
    select: SELECT,
  });

  return NextResponse.json({ visit });
}
