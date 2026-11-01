import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { hashPassword, isEmailLike } from "@/lib/auth";
import { fetchPatient } from "@/lib/api-auth";
import { nextPatientCode, nextVisitCode } from "@/lib/codes";
import { listParam, eitherParam } from "@/lib/list-param";

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const active = eitherParam(listParam(searchParams, "status"), "active", "inactive");
  const verified = eitherParam(listParam(searchParams, "verified"), "true", "false");
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
  if (active !== undefined) where.active = active;
  if (verified !== undefined) where.verified = verified;
  const genders = listParam(searchParams, "gender"), mizaj = listParam(searchParams, "mizaj"), facilityIds = listParam(searchParams, "facilityId");
  if (genders.length) where.gender = { in: genders };
  // "__none" stands for "not assessed yet".
  if (mizaj.length) {
    const named = mizaj.filter((m) => m !== "__none");
    const or = [...(named.length ? [{ mizaj: { in: named } }] : []), ...(mizaj.includes("__none") ? [{ mizaj: null }, { mizaj: "" }] : [])];
    where.AND = [...(where.AND || []), { OR: or }];
  }
  if (facilityIds.length) where.visits = { some: { facilityId: { in: facilityIds } } };

  const SORTS: Record<string, unknown> = { newest: { createdAt: "desc" }, oldest: { createdAt: "asc" }, name: { name: "asc" }, login: { lastLoginAt: { sort: "desc", nulls: "last" } } };
  const [field, dir] = sort.split("_");
  const orderBy = SORTS[sort] ?? { [field]: dir === "asc" ? "asc" : "desc" };

  const [total, patients] = await Promise.all([
    db.patient.count({ where }),
    db.patient.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, patientCode: true, name: true, email: true, phone: true, gender: true, dob: true,
        bloodGroup: true, mizaj: true, photo: true, avatarColor: true, city: true, state: true,
        verified: true, active: true, lastLoginAt: true, createdAt: true,
        _count: { select: { visits: true } },
        visits: {
          orderBy: { visitDate: "desc" },
          take: 1,
          select: { visitDate: true, facility: { select: { id: true, facilityName: true } } },
        },
      },
    }),
  ]);

  const withFacility = patients.map(({ visits, _count, ...p }) => ({
    ...p,
    facilityName: visits[0]?.facility.facilityName || null,
    facilityId: visits[0]?.facility.id || null,
    lastVisitAt: visits[0]?.visitDate || null,
    visitCount: _count.visits,
  }));

  // Platform-wide figures for the page header (unfiltered), only when asked for.
  let summary: Record<string, unknown> | null = null;
  if (searchParams.get("summary") === "1") {
    const since30 = new Date(Date.now() - 30 * 86_400_000);
    const [all, activeN, verifiedN, new30, signedIn30, byGender, byMizaj] = await Promise.all([
      db.patient.count(),
      db.patient.count({ where: { active: true } }),
      db.patient.count({ where: { verified: true } }),
      db.patient.count({ where: { createdAt: { gte: since30 } } }),
      db.patient.count({ where: { lastLoginAt: { gte: since30 } } }),
      db.patient.groupBy({ by: ["gender"], _count: { _all: true } }),
      db.patient.groupBy({ by: ["mizaj"], _count: { _all: true } }),
    ]);
    summary = {
      all, active: activeN, suspended: all - activeN, verified: verifiedN, unverified: all - verifiedN, new30, signedIn30,
      genders: byGender.filter((g) => g.gender).map((g) => ({ value: g.gender, count: g._count._all })),
      mizaj: byMizaj.map((m) => ({ value: m.mizaj || "__none", count: m._count._all })),
    };
  }

  return NextResponse.json({ patients: withFacility, total, page, pageSize, totalPages: Math.ceil(total / pageSize), summary });
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
