import { NextRequest, NextResponse } from "next/server";
import { logClinicEvent, changedFields } from "@/lib/clinic-audit";
import { db } from "@/lib/db";
import { getAuthUser, fetchPatient } from "@/lib/api-auth";
import { isEmailLike } from "@/lib/auth";

const PHONE_PATTERN = /^[6-9]\d{9}$/; // 10-digit Indian mobile number, no leading 0/+91

// Scoped the same way as search — a facility can only edit a patient it has
// an actual Visit/Appointment relationship with, not any platform-wide patient.
async function assertInScope(patientId: string, facilityId: string) {
  return db.patient.findFirst({
    where: {
      id: patientId,
      OR: [{ visits: { some: { facilityId } } }, { appointments: { some: { facilityId } } }],
    },
    select: { id: true, email: true, phone: true, name: true, patientCode: true },
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
    await logClinicEvent(req, auth, { action: "patient.updated", summary: `Photo ${body.photo ? "changed" : "removed"} for ${existing.patientCode ?? ""} · ${existing.name}`, entityType: "patient", entityId: id, entityLabel: `${existing.patientCode ?? ""} · ${existing.name}`, details: { fields: ["photo"] } });
    return NextResponse.json({ patient: await fetchPatient(id) });
  }

  // Partial update — only touch fields the caller actually sent. The
  // registration wizard's form has no email or emergency-relationship
  // field, so it never includes them in its payload; treating "absent"
  // the same as "clear it" (the old behavior: every field unconditionally
  // overwritten from the body) silently wiped both on every single save,
  // for any patient who'd set either through some other flow (e.g. patient
  // self-registration sets email for OTP login).
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    data.name = String(body.name).trim();
  }
  if (body.phone !== undefined) {
    const trimmedPhone = String(body.phone || "").trim();
    if (!trimmedPhone) {
      return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });
    }
    // Only enforce the stricter 10-digit format on an actual change — some
    // existing patients predate this format (older free-form entry), and
    // resaving an unrelated field shouldn't suddenly fail validation on a
    // phone number nobody touched.
    if (trimmedPhone !== existing.phone && !PHONE_PATTERN.test(trimmedPhone)) {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number" }, { status: 400 });
    }
    data.phone = trimmedPhone;
  }
  if (body.email !== undefined) {
    const trimmedEmail = String(body.email || "").trim();
    if (trimmedEmail && !isEmailLike(trimmedEmail)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (trimmedEmail && trimmedEmail.toLowerCase() !== existing.email) {
      const emailTaken = await db.patient.findUnique({ where: { email: trimmedEmail.toLowerCase() } });
      if (emailTaken) {
        return NextResponse.json({ error: "This email is already registered to another patient" }, { status: 409 });
      }
    }
    data.email = trimmedEmail ? trimmedEmail.toLowerCase() : null;
  }
  if (body.titlePrefix !== undefined) data.titlePrefix = body.titlePrefix || null;
  if (body.registrationFor !== undefined) data.registrationFor = body.registrationFor || null;
  if (body.relationship !== undefined) data.relationship = body.relationship || null;
  if (body.gender !== undefined) data.gender = body.gender || null;
  if (body.dob !== undefined) data.dob = body.dob || null;
  if (body.dobApprox !== undefined) data.dobApprox = !!body.dobApprox;
  if (body.maritalStatus !== undefined) data.maritalStatus = body.maritalStatus || null;
  if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact || null;
  if (body.emergencyContactName !== undefined) data.emergencyContactName = body.emergencyContactName || null;
  if (body.emergencyRelationship !== undefined) data.emergencyRelationship = body.emergencyRelationship || null;
  if (body.address !== undefined) data.address = body.address || null;
  if (body.state !== undefined) data.state = body.state || null;
  if (body.city !== undefined) data.city = body.city || null;

  const before = await db.patient.findUnique({ where: { id } });
  await db.patient.update({ where: { id }, data });
  const fields = before ? changedFields(before as unknown as Record<string, unknown>, data, Object.keys(data)) : Object.keys(data);
  if (fields.length) {
    await logClinicEvent(req, auth, { action: "patient.updated", summary: `Updated ${fields.join(", ")} for ${existing.patientCode ?? ""} · ${existing.name}`, entityType: "patient", entityId: id, entityLabel: `${existing.patientCode ?? ""} · ${existing.name}`, details: { fields } });
  }

  return NextResponse.json({ patient: await fetchPatient(id) });
}
