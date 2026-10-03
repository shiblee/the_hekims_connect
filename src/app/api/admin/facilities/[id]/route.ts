import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { normalizeContact } from "@/lib/auth";

// ABDM Health Facility Registry ID format: "IN" followed by 10 digits (e.g. IN0123456789).
const HFR_PATTERN = /^IN\d{10}$/i;

interface OperatingHourInput {
  dayOfWeek: number;
  isOpen: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
  openingTime2?: string | null;
  closingTime2?: string | null;
}

interface SubscriptionInput {
  plan?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const facility = await db.facility.findUnique({
    where: { id },
    select: {
      id: true, facilityName: true, email: true, phone: true, license: true, specialization: true,
      experience: true, rating: true, bio: true, avatarColor: true,
      verified: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      registeredFacilityName: true, facilityType: true, hfrNumber: true, establishmentDate: true,
      alternateContactNumber: true, addressLine1: true, addressLine2: true, locality: true,
      city: true, district: true, state: true, country: true, pincode: true, latitude: true,
      longitude: true, bedCapacity: true, dailyOpdCount: true, dailyAdmissions: true,
      is24x7: true, emergencyServices: true, ambulanceAvailable: true,
      specializations: true, services: true, profileCompleted: true, profileCompletedAt: true,
      operatingHours: { orderBy: { dayOfWeek: "asc" } },
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { appointments: true, prescriptions: true, mizajAssessments: true } },
    },
  });
  if (!facility) return NextResponse.json({ error: "Facility not found" }, { status: 404 });

  return NextResponse.json({ facility });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await db.facility.findUnique({ where: { id }, select: { facilityName: true } });
  if (!existing) return NextResponse.json({ error: "Facility not found" }, { status: 404 });

  if (body.hfrNumber && !HFR_PATTERN.test(body.hfrNumber)) {
    return NextResponse.json({ error: "HFR Number should be IN followed by 10 digits (e.g. IN0123456789)" }, { status: 400 });
  }
  if (body.establishmentDate && body.establishmentDate > new Date().toISOString().slice(0, 7)) {
    return NextResponse.json({ error: "Establishment month/year cannot be in the future" }, { status: 400 });
  }

  let contactUpdate: { email: string | null; phone: string | null } | null = null;
  if (body.contact !== undefined) {
    const contact = String(body.contact || "").trim();
    if (!contact) {
      return NextResponse.json({ error: "Email or phone is required" }, { status: 400 });
    }
    const { value: normalized, isEmail } = normalizeContact(contact);
    const conflict = await db.facility.findFirst({
      where: { id: { not: id }, OR: [{ email: normalized }, { phone: normalized }] },
    });
    if (conflict) {
      return NextResponse.json({ error: "Another Facility already uses this email or phone" }, { status: 409 });
    }
    contactUpdate = isEmail ? { email: normalized, phone: null } : { email: null, phone: normalized };
  }

  const data: Record<string, unknown> = {};
  if (contactUpdate) Object.assign(data, contactUpdate);
  const str = (key: string) => { if (body[key] !== undefined) data[key] = body[key] || null; };
  const bool = (key: string) => { if (body[key] !== undefined) data[key] = !!body[key]; };
  const int = (key: string) => {
    if (body[key] !== undefined) data[key] = body[key] === "" || body[key] === null ? null : parseInt(body[key], 10) || 0;
  };
  const float = (key: string) => {
    if (body[key] !== undefined) data[key] = body[key] === "" || body[key] === null ? null : parseFloat(body[key]);
  };

  // Account / identity
  if (body.active !== undefined) data.active = !!body.active;
  if (body.verified !== undefined) data.verified = !!body.verified;
  if (body.facilityName !== undefined && body.facilityName) data.facilityName = body.facilityName;
  str("registeredFacilityName");
  str("alternateContactNumber");
  str("license");
  str("specialization");
  int("experience");
  float("rating");
  str("bio");
  str("facilityType");
  if (body.hfrNumber !== undefined) data.hfrNumber = body.hfrNumber ? String(body.hfrNumber).toUpperCase() : null;
  if (body.establishmentDate !== undefined) data.establishmentDate = body.establishmentDate ? new Date(body.establishmentDate) : null;
  if (body.profileCompleted !== undefined) data.profileCompleted = !!body.profileCompleted;

  // Location
  str("addressLine1");
  str("addressLine2");
  str("locality");
  str("city");
  str("district");
  str("state");
  str("country");
  str("pincode");
  float("latitude");
  float("longitude");

  // Capacity
  int("bedCapacity");
  int("dailyOpdCount");
  int("dailyAdmissions");
  bool("is24x7");

  // Services
  bool("emergencyServices");
  bool("ambulanceAvailable");
  if (Array.isArray(body.specializations)) data.specializations = JSON.stringify(body.specializations);
  if (Array.isArray(body.services)) data.services = JSON.stringify(body.services);

  if (Object.keys(data).length) {
    await db.facility.update({ where: { id }, data });
  }

  if (Array.isArray(body.operatingHours)) {
    await db.facilityOperatingHours.deleteMany({ where: { facilityId: id } });
    const rows = (body.operatingHours as OperatingHourInput[])
      .filter((h) => h && typeof h.dayOfWeek === "number")
      .map((h) => ({
        facilityId: id,
        dayOfWeek: h.dayOfWeek,
        isOpen: !!h.isOpen,
        openingTime: h.isOpen ? h.openingTime || null : null,
        closingTime: h.isOpen ? h.closingTime || null : null,
        openingTime2: h.isOpen ? h.openingTime2 || null : null,
        closingTime2: h.isOpen ? h.closingTime2 || null : null,
      }));
    if (rows.length) {
      await db.facilityOperatingHours.createMany({ data: rows });
    }
  }

  if (body.subscription && typeof body.subscription === "object") {
    const sub = body.subscription as SubscriptionInput;
    const latest = await db.facilitySubscription.findFirst({ where: { facilityId: id }, orderBy: { createdAt: "desc" } });
    const subData = {
      plan: sub.plan ?? latest?.plan ?? "FREE",
      status: sub.status ?? latest?.status ?? "ACTIVE",
      startDate: sub.startDate ? new Date(sub.startDate) : latest?.startDate ?? new Date(),
      endDate: sub.endDate ? new Date(sub.endDate) : latest?.endDate ?? new Date(),
      autoRenew: sub.autoRenew !== undefined ? !!sub.autoRenew : latest?.autoRenew ?? false,
    };
    if (latest) {
      await db.facilitySubscription.update({ where: { id: latest.id }, data: subData });
    } else {
      await db.facilitySubscription.create({ data: { facilityId: id, ...subData } });
    }
  }

  await logAdminActivity(
    session.admin.id,
    "facility_profile_updated",
    `Facility "${existing.facilityName}" details updated by admin`,
    getClientIp(req)
  );

  const facility = await db.facility.findUnique({
    where: { id },
    select: {
      id: true, facilityName: true, email: true, phone: true, license: true, specialization: true,
      experience: true, rating: true, bio: true, avatarColor: true,
      verified: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      registeredFacilityName: true, facilityType: true, hfrNumber: true, establishmentDate: true,
      alternateContactNumber: true, addressLine1: true, addressLine2: true, locality: true,
      city: true, district: true, state: true, country: true, pincode: true, latitude: true,
      longitude: true, bedCapacity: true, dailyOpdCount: true, dailyAdmissions: true,
      is24x7: true, emergencyServices: true, ambulanceAvailable: true,
      specializations: true, services: true, profileCompleted: true, profileCompletedAt: true,
      operatingHours: { orderBy: { dayOfWeek: "asc" } },
      subscriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { appointments: true, prescriptions: true, mizajAssessments: true } },
    },
  });

  return NextResponse.json({ facility });
}
