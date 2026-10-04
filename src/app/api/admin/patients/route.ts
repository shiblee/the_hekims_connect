import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { hashPassword, isEmailLike } from "@/lib/auth";
import { fetchPatient } from "@/lib/api-auth";
import { nextPatientCode, nextVisitCode } from "@/lib/codes";

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");
  const verified = searchParams.get("verified");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
  const sort = searchParams.get("sort") || "createdAt_desc";

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  if (status === "active") where.active = true;
  if (status === "inactive") where.active = false;
  if (verified === "true") where.verified = true;
  if (verified === "false") where.verified = false;

  const [field, dir] = sort.split("_");
  const orderBy = { [field]: dir === "asc" ? "asc" : "desc" };

  const [total, patients] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, phone: true, gender: true, dob: true,
        bloodGroup: true, mizaj: true, photo: true, avatarColor: true,
        verified: true, active: true, lastLoginAt: true, createdAt: true,
        visits: {
          orderBy: { visitDate: "desc" },
          take: 1,
          select: { facility: { select: { facilityName: true } } },
        },
      },
    }),
  ]);

  const withFacility = patients.map(({ visits, ...p }) => ({
    ...p,
    facilityName: visits[0]?.facility.facilityName || null,
  }));

  return NextResponse.json({ patients: withFacility, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

// Admin-initiated patient registration, scoped to a chosen facility. Mirrors the
// facility-side walk-in POST (src/app/api/facility/patients/route.ts) field-for-field,
// plus a required facilityId — and creates a bare Visit (no doctor/reason) so the new
// patient actually shows up under that facility, since Patient has no facilityId of
// its own. No doctor/payment step here; that's the facility's own intake flow.
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const {
    facilityId, name, titlePrefix, registrationFor, relationship, gender,
    dob, dobApprox, maritalStatus, bloodGroup, phone, email,
    emergencyContact, emergencyContactName, emergencyRelationship,
    address, state, city,
  } = body;

  if (!facilityId) {
    return NextResponse.json({ error: "Facility is required" }, { status: 400 });
  }
  const facility = await db.facility.findUnique({ where: { id: facilityId }, select: { facilityName: true } });
  if (!facility) {
    return NextResponse.json({ error: "Facility not found" }, { status: 404 });
  }
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

  const visitCode = await nextVisitCode();
  await db.visit.create({
    data: { visitCode, patientId: created.id, facilityId },
  });

  await logAdminActivity(
    session.admin.id,
    "patient_created",
    `Patient "${created.name}" (${patientCode}) added to "${facility.facilityName}" by admin`,
    getClientIp(req)
  );

  return NextResponse.json({ patient: await fetchPatient(created.id) });
}
