import { randomBytes } from "crypto";
import { logClinicEvent, changedFields } from "@/lib/clinic-audit";
import { NextRequest, NextResponse } from "next/server";
import { visitStage } from "@/lib/visit-stage";
import { signPass } from "@/lib/session-token";
import { db } from "@/lib/db";
import { getAuthUser, fetchPatient } from "@/lib/api-auth";
import { hashPassword, isEmailLike } from "@/lib/auth";
import { nextPatientCode } from "@/lib/codes";

const PHONE_PATTERN = /^[6-9]\d{9}$/; // 10-digit Indian mobile number, no leading 0/+91

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  // Scoped to patients this facility has actually seen — a prior Visit or
  // Appointment — same scoping as the search/detail endpoints. A clinic
  // shouldn't see another clinic's patients just because they're on the platform.
  const scopeFilter = { OR: [{ visits: { some: { facilityId: auth.id } } }, { appointments: { some: { facilityId: auth.id } } }] };
  const searchFilter = search
    ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { phone: { contains: search } }, { patientCode: { contains: search.toUpperCase() } }] }
    : undefined;

  const patients = await db.patient.findMany({
    where: searchFilter ? { AND: [scopeFilter, searchFilter] } : scopeFilter,
    select: {
      id: true,
      patientCode: true,
      name: true,
      email: true,
      phone: true,
      dob: true,
      gender: true,
      bloodGroup: true,
      mizaj: true,
      photo: true,
      avatarColor: true,
      chronicConditions: true,
      address: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Visit count/last-visit across both the newer Visit model (walk-in
  // registration) and the older Appointment model (self-service booking).
  const withCounts = await Promise.all(
    patients.map(async (p) => {
      const [appointmentCount, visitCount, lastAppointment, lastVisit, lastReferral, lastAmaDecline] = await Promise.all([
        db.appointment.count({ where: { facilityId: auth.id, patientId: p.id } }),
        db.visit.count({ where: { facilityId: auth.id, patientId: p.id } }),
        db.appointment.findFirst({ where: { facilityId: auth.id, patientId: p.id, status: "completed" }, orderBy: { date: "desc" }, select: { date: true, time: true } }),
        db.visit.findFirst({
          where: { facilityId: auth.id, patientId: p.id },
          orderBy: { visitDate: "desc" },
          select: {
            visitDate: true, status: true,
            vitalSigns: { select: { id: true } },
            redFlagScreening: { select: { outcome: true } },
            referral: { select: { id: true } },
            asbabAssessments: { where: { framework: "asbab" }, select: { status: true } },
            tashkheesDossier: { select: { status: true } },
          },
        }),
        db.referral.findFirst({ where: { visit: { facilityId: auth.id, patientId: p.id } }, orderBy: { createdAt: "desc" }, select: { urgency: true, createdAt: true } }),
        db.amaDecline.findFirst({ where: { visit: { facilityId: auth.id, patientId: p.id } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      ]);
      // Keep full timestamps (not date-only strings) so the UI can show a
      // readable date + time, not just the day. Appointment only stores a
      // date string + a separate "HH:MM" time string, so combine them.
      const lastVisitAt = lastVisit?.visitDate ? lastVisit.visitDate.toISOString() : null;
      const lastAppointmentAt = lastAppointment?.date
        ? new Date(`${lastAppointment.date}T${lastAppointment.time || "00:00"}:00`).toISOString()
        : null;
      const latest = [lastAppointmentAt, lastVisitAt].filter(Boolean).sort().pop() || null;
      return { ...p, appointmentCount: appointmentCount + visitCount, lastVisit: latest, lastReferral, lastAmaDecline, stage: lastVisit ? visitStage(lastVisit) : null };
    })
  );

  return NextResponse.json({ patients: withCounts });
}

// Receptionist-facing walk-in registration — creates a new Patient directly (no
// self-service signup/OTP flow). The phone is not pre-verified at this step;
// the patient can later OTP-login with it like any self-service account, since
// OTP login never reads `password` (see src/app/api/auth/otp/verify/route.ts).
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name, titlePrefix, registrationFor, relationship, gender,
    dob, dobApprox, maritalStatus, bloodGroup, phone, email,
    emergencyContact, emergencyContactName, emergencyRelationship,
    address, state, city,
  } = body;

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const trimmedPhone = String(phone || "").trim();
  if (!trimmedPhone || !PHONE_PATTERN.test(trimmedPhone)) {
    return NextResponse.json({ error: "Enter a valid mobile number" }, { status: 400 });
  }
  const trimmedEmail = String(email || "").trim();
  if (trimmedEmail && !isEmailLike(trimmedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (trimmedEmail) {
    const emailTaken = await db.patient.findUnique({ where: { email: trimmedEmail.toLowerCase() } });
    if (emailTaken) {
      return NextResponse.json({ error: "This email is already registered to another patient" }, { status: 409 });
    }
  }

  const patientCode = await nextPatientCode();
  const randomPassword = hashPassword(randomBytes(16).toString("hex"));

  const created = await db.patient.create({
    data: {
      patientCode,
      name: String(name).trim(),
      titlePrefix: titlePrefix || null,
      registrationFor: registrationFor || null,
      relationship: relationship || null,
      gender: gender || null,
      dob: dob || null,
      dobApprox: !!dobApprox,
      maritalStatus: maritalStatus || null,
      bloodGroup: bloodGroup || null,
      phone: trimmedPhone,
      email: trimmedEmail ? trimmedEmail.toLowerCase() : null,
      emergencyContact: emergencyContact || null,
      emergencyContactName: emergencyContactName || null,
      emergencyRelationship: emergencyRelationship || null,
      address: address || null,
      state: state || null,
      city: city || null,
      password: randomPassword,
      active: true,
    },
  });
  await logClinicEvent(req, auth, { action: "patient.registered", summary: `Registered ${created.patientCode} · ${created.name}`, entityType: "patient", entityId: created.id, entityLabel: `${created.patientCode} · ${created.name}` });

  // Lets the registration form start this patient's first visit here.
  return NextResponse.json({ patient: await fetchPatient(created.id), linkPass: await signPass("link", [created.id, auth.id], 120) });
}
