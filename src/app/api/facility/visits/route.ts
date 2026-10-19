import { NextRequest, NextResponse } from "next/server";
import { logClinicEvent } from "@/lib/clinic-audit";
import { checkNewPatientLink } from "@/lib/patient-link";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { nextVisitCode } from "@/lib/codes";

const SELECT = {
  id: true, visitCode: true, status: true, reasonForVisit: true, visitDate: true, createdAt: true,
  doctor: { select: { id: true, name: true, staffCode: true } },
  payments: { select: { id: true, paymentCode: true, amount: true, mode: true, status: true, createdAt: true } },
  vitalSigns: {
    select: {
      heartRate: true, pulse: true, bpSystolic: true, bpDiastolic: true, spo2: true,
      temperatureF: true, temperatureC: true,
      heightCm: true, weightKg: true, updatedAt: true,
      painNotes: true, primaryFocusArea: true, triageRemarks: true,
    },
  },
  l1Screening: {
    select: {
      id: true, chiefComplaints: true, aiSummary: true, updatedAt: true,
    },
  },
  intake: {
    select: {
      chiefComplaints: true, narrative: true, onsetTimeline: true,
      allergies: true, medications: true, mobility: true,
    },
  },
  clinicalAssessment: { select: { id: true, workingDiagnosis: true, requiresUrgentReferral: true, updatedAt: true } },
  treatmentPlan: { select: { id: true, referralRequired: true, updatedAt: true } },
  referral: { select: { id: true, reason: true, referredTo: true, urgency: true, notes: true, createdAt: true } },
  amaDecline: { select: { id: true, reason: true, patientReason: true, createdAt: true } },
  // Triage findings shown to the main doctor on the later stages.
  redFlagScreening: { select: { outcome: true, answers: { select: { criterionLabel: true, present: true } } } },
  acuteSymptomAssessment: { select: { symptoms: true } },
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

  const { patientId, doctorId, reasonForVisit, status, linkPass } = await req.json();
  if (!patientId) {
    return NextResponse.json({ error: "patientId is required" }, { status: 400 });
  }
  const validStatus = status === "waiting" ? "waiting" : "registered";

  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true, name: true, patientCode: true } });
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

  const firstHere = !(await db.visit.findFirst({ where: { patientId, facilityId: auth.id }, select: { id: true } }))
    && !(await db.appointment.findFirst({ where: { patientId, facilityId: auth.id }, select: { id: true } }));
  const refused = await checkNewPatientLink(req, auth, patientId, linkPass);
  if (refused) return NextResponse.json({ error: refused }, { status: 403 });
  const visitCode = await nextVisitCode();
  const visit = await db.visit.create({
    data: {
      visitCode,
      patientId,
      facilityId: auth.id,
      doctorId: validDoctorId,
      registeredById: auth.staffId ?? null,
      reasonForVisit: reasonForVisit || null,
      status: validStatus,
    },
    select: SELECT,
  });
  const label = `${patient.patientCode ?? ""} · ${patient.name}`;
  if (firstHere) {
    // Either a patient just registered here, or someone registered elsewhere now attending this clinic.
    const registeredHere = await db.facilityAuditEvent.findFirst({ where: { facilityId: auth.id, action: "patient.registered", entityId: patientId }, select: { id: true } });
    if (!registeredHere) await logClinicEvent(req, auth, { action: "patient.linked", summary: `Linked existing patient ${label} to this clinic`, entityType: "patient", entityId: patientId, entityLabel: label });
  }
  await logClinicEvent(req, auth, { action: "visit.created", summary: `Started visit ${visitCode} for ${label}`, entityType: "visit", entityId: visit.id, entityLabel: `${visitCode} · ${patient.name}` });

  return NextResponse.json({ visit });
}
