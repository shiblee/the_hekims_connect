import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { isEmailLike, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const VERIFY_VALIDITY_MS = 30 * 60 * 1000;

const SELECT = {
  id: true, staffCode: true, name: true, photo: true, email: true, phone: true,
  contactVerifiedAt: true,
  employeeType: true, specialization: true, qualification: true, designation: true,
  registrationNumber: true, experience: true, role: true, responsibilities: true,
  active: true, createdAt: true, updatedAt: true,
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
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const employeeType = searchParams.get("employeeType") || "";
  const activeParam = searchParams.get("active");

  const where: Record<string, unknown> = { facilityId: auth.id };
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { staffCode: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }
  if (employeeType) where.employeeType = employeeType;
  if (activeParam === "true" || activeParam === "false") where.active = activeParam === "true";

  const staff = await db.staff.findMany({ where, select: SELECT, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ staff });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    name, contact, employeeType, specialization, qualification, designation,
    registrationNumber, experience, role, responsibilities,
  } = body;

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
      facilityId: auth.id,
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
    select: SELECT,
  });

  if (staff.email) {
    const facility = await db.facility.findUnique({ where: { id: auth.id }, select: { facilityName: true } });
    const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
    await sendTemplatedEmail({
      templateKey: "staff_added",
      to: staff.email,
      vars: {
        staff_name: staff.name,
        facility_name: facility?.facilityName || "",
        staff_code: staff.staffCode,
        employee_type: staff.employeeType,
        portal_name: portalName,
      },
      event: "staff_added",
    });
  }

  return NextResponse.json({ staff });
}
