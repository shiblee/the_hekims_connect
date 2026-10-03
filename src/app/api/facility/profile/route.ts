import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

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

const SELECT = {
  id: true, facilityName: true, facilityType: true, hfrNumber: true, establishmentDate: true,
  alternateContactNumber: true,
  addressLine1: true, addressLine2: true, locality: true, city: true, district: true,
  state: true, country: true, pincode: true,
  bedCapacity: true, dailyOpdCount: true, is24x7: true,
  emergencyServices: true, ambulanceAvailable: true,
  specializations: true, services: true,
  operatingHours: { orderBy: { dayOfWeek: "asc" as const } },
};

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const facility = await db.facility.findUnique({ where: { id: auth.id }, select: SELECT });
  if (!facility) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ facility });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.hfrNumber && !HFR_PATTERN.test(body.hfrNumber)) {
    return NextResponse.json({ error: "HFR Number should be IN followed by 10 digits (e.g. IN0123456789)" }, { status: 400 });
  }
  if (body.establishmentDate && body.establishmentDate > new Date().toISOString().slice(0, 7)) {
    return NextResponse.json({ error: "Establishment month/year cannot be in the future" }, { status: 400 });
  }
  if (body.facilityName !== undefined && !String(body.facilityName || "").trim()) {
    return NextResponse.json({ error: "Facility name is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const str = (key: string) => { if (body[key] !== undefined) data[key] = body[key] || null; };
  const bool = (key: string) => { if (body[key] !== undefined) data[key] = !!body[key]; };
  const int = (key: string) => {
    if (body[key] !== undefined) data[key] = body[key] === "" || body[key] === null ? null : parseInt(body[key], 10) || 0;
  };

  if (body.facilityName) data.facilityName = body.facilityName;
  str("facilityType");
  if (body.hfrNumber !== undefined) data.hfrNumber = body.hfrNumber ? String(body.hfrNumber).toUpperCase() : null;
  if (body.establishmentDate !== undefined) data.establishmentDate = body.establishmentDate ? new Date(body.establishmentDate) : null;
  str("alternateContactNumber");

  str("addressLine1");
  str("addressLine2");
  str("locality");
  str("city");
  str("district");
  str("state");
  str("country");
  str("pincode");

  int("bedCapacity");
  int("dailyOpdCount");
  bool("is24x7");

  bool("emergencyServices");
  bool("ambulanceAvailable");
  if (Array.isArray(body.specializations)) data.specializations = JSON.stringify(body.specializations);
  if (Array.isArray(body.services)) data.services = JSON.stringify(body.services);

  if (Object.keys(data).length) {
    await db.facility.update({ where: { id: auth.id }, data });
  }

  if (Array.isArray(body.operatingHours)) {
    await db.facilityOperatingHours.deleteMany({ where: { facilityId: auth.id } });
    const rows = (body.operatingHours as OperatingHourInput[])
      .filter((h) => h && typeof h.dayOfWeek === "number")
      .map((h) => ({
        facilityId: auth.id,
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

  const facility = await db.facility.findUnique({ where: { id: auth.id }, select: SELECT });
  return NextResponse.json({ facility });
}
