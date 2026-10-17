import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { getSetting } from "@/lib/settings";
import { getVitalsRangeConfig } from "@/lib/vitals-ranges-server";
import { clearClinicalRoutingInsight } from "@/lib/complaint-sync";

const VITALS_SELECT = {
  heartRate: true, pulse: true, bpSystolic: true, bpDiastolic: true, spo2: true, spo2Context: true,
  temperatureF: true, temperatureC: true,
  heightCm: true, weightKg: true,
  painNotes: true, primaryFocusArea: true, triageRemarks: true,
  createdAt: true, updatedAt: true,
};

function isMinutesElapsedBeyond(since: Date, minutes: number): boolean {
  return Date.now() - since.getTime() > minutes * 60 * 1000;
}

async function assertOwnedVisit(id: string, facilityId: string) {
  return db.visit.findFirst({
    where: { id, facilityId },
    select: {
      id: true, visitCode: true, visitDate: true, patientId: true, reasonForVisit: true,
      doctor: { select: { id: true, name: true, designation: true } },
      payments: { select: { id: true, amount: true, mode: true, status: true } },
      patient: {
        select: {
          id: true, patientCode: true, name: true, gender: true, dob: true,
          dobApprox: true, bloodGroup: true, phone: true, avatarColor: true,
          maritalStatus: true, occupation: true, address: true, state: true, city: true,
          emergencyContact: true, emergencyContactName: true, emergencyRelationship: true,
        },
      },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const visit = await assertOwnedVisit(id, auth.id);
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const [vitals, previousVisit, editWindowMinutesStr] = await Promise.all([
    db.vitalSigns.findUnique({ where: { visitId: id }, select: VITALS_SELECT }),
    db.visit.findFirst({
      where: { patientId: visit.patientId, id: { not: id }, vitalSigns: { isNot: null } },
      orderBy: { visitDate: "desc" },
      select: { visitDate: true, visitCode: true, vitalSigns: { select: VITALS_SELECT } },
    }),
    getSetting("vitals", "edit_window_minutes", "60"),
  ]);

  const editWindowMinutes = parseInt(editWindowMinutesStr, 10) || 60;
  const locked = !!vitals && isMinutesElapsedBeyond(vitals.createdAt, editWindowMinutes);

  return NextResponse.json({
    visit: {
      id: visit.id, visitCode: visit.visitCode, visitDate: visit.visitDate, reasonForVisit: visit.reasonForVisit,
      doctor: visit.doctor, payments: visit.payments, patient: visit.patient,
    },
    vitals,
    previous: previousVisit ? { visitCode: previousVisit.visitCode, visitDate: previousVisit.visitDate, ...previousVisit.vitalSigns } : null,
    editWindowMinutes,
    locked,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const visit = await assertOwnedVisit(id, auth.id);
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const existing = await db.vitalSigns.findUnique({ where: { visitId: id }, select: { createdAt: true } });
  if (existing) {
    const editWindowMinutes = parseInt(await getSetting("vitals", "edit_window_minutes", "60"), 10) || 60;
    if (isMinutesElapsedBeyond(existing.createdAt, editWindowMinutes)) {
      return NextResponse.json(
        { error: `This assessment was recorded over ${editWindowMinutes} minutes ago and can no longer be edited. Start a new visit to record fresh vitals.` },
        { status: 409 }
      );
    }
  }

  const body = await req.json();
  const toInt = (v: unknown) => (v === "" || v === null || v === undefined ? null : parseInt(String(v), 10));
  const toFloat = (v: unknown) => (v === "" || v === null || v === undefined ? null : parseFloat(String(v)));

  const { entryBounds } = await getVitalsRangeConfig();
  for (const [field, [min, max]] of Object.entries(entryBounds)) {
    const raw = body[field];
    const value = raw === "" || raw === null || raw === undefined ? null : parseFloat(String(raw));
    if (value != null && (value < min || value > max)) {
      return NextResponse.json({ error: `${field} must be between ${min} and ${max}` }, { status: 400 });
    }
  }

  const data = {
    heartRate: toInt(body.heartRate),
    pulse: toInt(body.pulse),
    bpSystolic: toInt(body.bpSystolic),
    bpDiastolic: toInt(body.bpDiastolic),
    spo2: toInt(body.spo2),
    spo2Context: body.spo2Context || null,
    temperatureF: toFloat(body.temperatureF),
    temperatureC: toFloat(body.temperatureC),
    heightCm: toFloat(body.heightCm),
    weightKg: toFloat(body.weightKg),
    painNotes: body.painNotes || null,
    primaryFocusArea: body.primaryFocusArea || null,
    triageRemarks: body.triageRemarks || null,
  };

  const vitals = await db.vitalSigns.upsert({
    where: { visitId: id },
    update: data,
    create: { visitId: id, ...data },
    select: VITALS_SELECT,
  });

  // Vitals changed — any previously generated Vitals Insight or Clinical
  // Routing suggestion now describes a reading that no longer exists.
  await Promise.all([
    db.vitalsInsightRecord.deleteMany({ where: { visitId: id } }),
    clearClinicalRoutingInsight(id),
  ]);

  return NextResponse.json({ vitals });
}
