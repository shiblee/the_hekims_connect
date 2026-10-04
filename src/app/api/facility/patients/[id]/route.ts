import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, fetchPatient } from "@/lib/api-auth";
import { isEmailLike } from "@/lib/auth";

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

// Scoped the same way as search — a facility can only edit a patient it has
// an actual Visit/Appointment relationship with, not any platform-wide patient.
async function assertInScope(patientId: string, facilityId: string) {
  return db.patient.findFirst({
    where: {
      id: patientId,
      OR: [{ visits: { some: { facilityId } } }, { appointments: { some: { facilityId } } }],
    },
    select: { id: true, email: true },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await assertInScope(id, auth.id);
  if (!existing) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  return NextResponse.json({ patient: await fetchPatient(id) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await assertInScope(id, auth.id);
  if (!existing) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const body = await req.json();

  // Photo-only update (clicking the avatar) skips the full-form validation below.
  if (body.photo !== undefined && Object.keys(body).length === 1) {
    await db.patient.update({ where: { id }, data: { photo: body.photo || null } });
    return NextResponse.json({ patient: await fetchPatient(id) });
  }

  const {
    name, titlePrefix, registrationFor, relationship, gender,
    dob, dobApprox, maritalStatus, phone, email,
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
  if (trimmedEmail && trimmedEmail.toLowerCase() !== existing.email) {
    const emailTaken = await db.patient.findUnique({ where: { email: trimmedEmail.toLowerCase() } });
    if (emailTaken) {
      return NextResponse.json({ error: "This email is already registered to another patient" }, { status: 409 });
    }
  }

  await db.patient.update({
    where: { id },
    data: {
      name: String(name).trim(),
      titlePrefix: titlePrefix || null,
      registrationFor: registrationFor || null,
      relationship: relationship || null,
      gender: gender || null,
      dob: dob || null,
      dobApprox: !!dobApprox,
      maritalStatus: maritalStatus || null,
      phone: trimmedPhone,
      email: trimmedEmail ? trimmedEmail.toLowerCase() : null,
      emergencyContact: emergencyContact || null,
      emergencyContactName: emergencyContactName || null,
      emergencyRelationship: emergencyRelationship || null,
      address: address || null,
      state: state || null,
      city: city || null,
    },
  });

  return NextResponse.json({ patient: await fetchPatient(id) });
}
