import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { isEmailLike, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const VERIFY_VALIDITY_MS = 30 * 60 * 1000;

const CREATE_SELECT = {
  id: true, staffCode: true, name: true, photo: true, email: true, phone: true,
  contactVerifiedAt: true,
  employeeType: true, specialization: true, qualification: true, designation: true,
  registrationNumber: true, experience: true, role: true, responsibilities: true,
  active: true, createdAt: true, updatedAt: true,
  facility: { select: { id: true, facilityName: true } },
};

async function nextStaffCode() {
  for (let i = 0; i < 5; i++) {
    const count = await db.staff.count();
    const code = `ST${String(count + 1 + i).padStart(8, "0")}`;
    const exists = await db.staff.findUnique({ where: { staffCode: code } });
    if (!exists) return code;
  }
  throw new Error("Could not generate a unique staff code");
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status"); // "active" | "inactive"
  const employeeType = searchParams.get("employeeType");
  const facilityId = searchParams.get("facilityId");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
  const sort = searchParams.get("sort") || "createdAt_desc";

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { staffCode: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  if (status === "active") where.active = true;
  if (status === "inactive") where.active = false;
  if (employeeType) where.employeeType = employeeType;
  if (facilityId) where.facilityId = facilityId;

  const [field, dir] = sort.split("_");
  const orderBy = { [field]: dir === "asc" ? "asc" : "desc" };

  const [total, staff] = await Promise.all([
    db.staff.count({ where }),
    db.staff.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, staffCode: true, name: true, photo: true, email: true, phone: true,
        employeeType: true, role: true, active: true, createdAt: true,
        facility: { select: { id: true, facilityName: true } },
      },
    }),
  ]);

  return NextResponse.json({ staff, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const {
    facilityId, name, contact, employeeType, specialization, qualification, designation,
    registrationNumber, experience, role, responsibilities,
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
  if (!employeeType || !String(employeeType).trim()) {
    return NextResponse.json({ error: "Employee type is required" }, { status: 400 });
  }
  const trimmedContact = String(contact || "").trim();
  if (!trimmedContact) {
    return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
  }
  const isEmail = isEmailLike(trimmedContact);
  if (!isEmail && !PHONE_PATTERN.test(trimmedContact)) {
    return NextResponse.json({ error: "Enter a valid email address or phone number" }, { status: 400 });
  }

  const { value: normalizedContact } = normalizeContact(trimmedContact);
  const verifiedOtp = await db.otpCode.findFirst({
    where: { identifier: normalizedContact, purpose: "staff_verify", verifiedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!verifiedOtp || Date.now() - new Date(verifiedOtp.verifiedAt!).getTime() > VERIFY_VALIDITY_MS) {
    return NextResponse.json({ error: "Please verify this email or phone before adding the staff member" }, { status: 400 });
  }

  const staffCode = await nextStaffCode();

  const staff = await db.staff.create({
    data: {
      staffCode,
      facilityId,
      name: String(name).trim(),
      email: isEmail ? trimmedContact.toLowerCase() : null,
      phone: isEmail ? null : trimmedContact,
      contactVerifiedAt: verifiedOtp.verifiedAt,
      employeeType,
      specialization: specialization || null,
      qualification: qualification || null,
      designation: designation || null,
      registrationNumber: registrationNumber || null,
      experience: experience !== undefined && experience !== null && experience !== "" ? parseInt(experience, 10) || null : null,
      role: role || null,
      responsibilities: Array.isArray(responsibilities) ? JSON.stringify(responsibilities) : null,
    },
    select: CREATE_SELECT,
  });

  await logAdminActivity(
    session.admin.id,
    "staff_created",
    `Staff "${staff.name}" added to "${facility.facilityName}" by admin`,
    getClientIp(req)
  );

  if (staff.email) {
    const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
    await sendTemplatedEmail({
      templateKey: "staff_added",
      to: staff.email,
      vars: {
        staff_name: staff.name,
        facility_name: facility.facilityName,
        staff_code: staff.staffCode,
        employee_type: staff.employeeType,
        portal_name: portalName,
      },
      event: "staff_added",
    });
  }

  return NextResponse.json({ staff });
}
