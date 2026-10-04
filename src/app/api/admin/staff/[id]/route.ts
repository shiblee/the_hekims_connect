import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { isEmailLike } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

const SELECT = {
  id: true, staffCode: true, name: true, photo: true, email: true, phone: true,
  contactVerifiedAt: true,
  employeeType: true, specialization: true, qualification: true, designation: true,
  registrationNumber: true, experience: true, role: true, responsibilities: true,
  active: true, createdAt: true, updatedAt: true,
  facility: { select: { id: true, facilityName: true } },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const staff = await db.staff.findUnique({ where: { id }, select: SELECT });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  return NextResponse.json({ staff });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const existing = await db.staff.findUnique({
    where: { id },
    select: { name: true, active: true, email: true, phone: true, facility: { select: { facilityName: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    data.name = String(body.name).trim();
  }
  if (body.photo !== undefined) data.photo = body.photo || null;
  if (body.contact !== undefined) {
    const trimmedContact = String(body.contact || "").trim();
    if (!trimmedContact) return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
    const isEmail = isEmailLike(trimmedContact);
    if (!isEmail && !PHONE_PATTERN.test(trimmedContact)) {
      return NextResponse.json({ error: "Enter a valid email address or phone number" }, { status: 400 });
    }
    const newEmail = isEmail ? trimmedContact.toLowerCase() : null;
    const newPhone = isEmail ? null : trimmedContact;
    if (newEmail !== existing.email || newPhone !== existing.phone) {
      data.email = newEmail;
      data.phone = newPhone;
      // Contact actually changed — the stored verification no longer applies to it.
      data.contactVerifiedAt = null;
    }
  }
  if (body.employeeType !== undefined) {
    if (!String(body.employeeType).trim()) return NextResponse.json({ error: "Employee type is required" }, { status: 400 });
    data.employeeType = body.employeeType;
  }
  const str = (key: string) => { if (body[key] !== undefined) data[key] = body[key] || null; };
  str("specialization");
  str("qualification");
  str("designation");
  str("registrationNumber");
  str("role");
  if (body.experience !== undefined) {
    data.experience = body.experience === "" || body.experience === null ? null : parseInt(body.experience, 10) || null;
  }
  if (Array.isArray(body.responsibilities)) data.responsibilities = JSON.stringify(body.responsibilities);
  if (body.active !== undefined) data.active = !!body.active;

  const staff = await db.staff.update({ where: { id }, data, select: SELECT });

  await logAdminActivity(
    session.admin.id,
    "staff_updated",
    `Staff "${existing.name}" updated by admin`,
    getClientIp(req)
  );

  if (typeof body.active === "boolean" && body.active !== existing.active && existing.email) {
    const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
    await sendTemplatedEmail({
      templateKey: body.active ? "staff_reactivated" : "staff_deactivated",
      to: existing.email,
      vars: {
        staff_name: existing.name,
        facility_name: existing.facility.facilityName,
        portal_name: portalName,
      },
      event: body.active ? "staff_reactivated" : "staff_deactivated",
    });
  }

  return NextResponse.json({ staff });
}
