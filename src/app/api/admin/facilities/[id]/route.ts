import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

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
      isOperational: true, is24x7: true, emergencyServices: true, ambulanceAvailable: true,
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
  const { active } = await req.json();
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const facility = await db.facility.update({ where: { id }, data: { active }, select: { id: true, facilityName: true, active: true } });
  await logAdminActivity(
    session.admin.id,
    "facility_account_status_changed",
    `Facility "${facility.facilityName}" ${active ? "activated" : "suspended"}`,
    getClientIp(req)
  );

  return NextResponse.json({ facility });
}
