import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, fetchFacility } from "@/lib/api-auth";

interface OperatingHourInput {
  dayOfWeek: number;
  isOpen: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
}

const FREE_PLAN_MONTHS = 3;

export async function POST(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      facilityName, facilityType, hfrNumber, establishmentDate,
      addressLine1, addressLine2, locality, city, district, state, country, pincode,
      alternateContactNumber,
      bedCapacity, isOperational, dailyOpdCount, dailyAdmissions,
      is24x7, operatingHours,
      specializations, services, emergencyServices, ambulanceAvailable,
    } = body;

    const missing: string[] = [];
    if (!facilityName) missing.push("Facility Name");
    if (!facilityType) missing.push("Facility Type");
    if (!hfrNumber) missing.push("HFR Number");
    if (!addressLine1) missing.push("Address");
    if (!city) missing.push("City");
    if (!state) missing.push("State");
    if (!pincode) missing.push("PIN Code");
    if (facilityType === "Hospital" && !bedCapacity) missing.push("Bed Capacity");
    if (dailyOpdCount === undefined || dailyOpdCount === null || dailyOpdCount === "") missing.push("Average Daily OPD");
    if (!Array.isArray(specializations) || specializations.length === 0) missing.push("At least one Specialization");
    if (!Array.isArray(services) || services.length === 0) missing.push("At least one Service");

    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const existing = await db.facility.findUnique({ where: { id: auth.id }, select: { facilityName: true, registeredFacilityName: true } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.facility.update({
      where: { id: auth.id },
      data: {
        facilityName,
        registeredFacilityName: existing.registeredFacilityName ?? existing.facilityName,
        facilityType,
        hfrNumber,
        establishmentDate: establishmentDate ? new Date(establishmentDate) : null,
        addressLine1,
        addressLine2: addressLine2 || null,
        locality: locality || null,
        city,
        district: district || null,
        state,
        country: country || null,
        pincode,
        alternateContactNumber: alternateContactNumber || null,
        bedCapacity: bedCapacity !== undefined && bedCapacity !== null && bedCapacity !== "" ? parseInt(bedCapacity, 10) || null : null,
        isOperational: isOperational !== false,
        dailyOpdCount: parseInt(dailyOpdCount, 10) || 0,
        dailyAdmissions: dailyAdmissions !== undefined && dailyAdmissions !== null && dailyAdmissions !== "" ? parseInt(dailyAdmissions, 10) || null : null,
        is24x7: !!is24x7,
        emergencyServices: !!emergencyServices,
        ambulanceAvailable: !!ambulanceAvailable,
        specializations: JSON.stringify(specializations),
        services: JSON.stringify(services),
        profileCompleted: true,
        profileCompletedAt: new Date(),
      },
    });

    await db.facilityOperatingHours.deleteMany({ where: { facilityId: auth.id } });
    if (!is24x7 && Array.isArray(operatingHours)) {
      const rows = (operatingHours as OperatingHourInput[])
        .filter((h) => h && typeof h.dayOfWeek === "number")
        .map((h) => ({
          facilityId: auth.id,
          dayOfWeek: h.dayOfWeek,
          isOpen: !!h.isOpen,
          openingTime: h.isOpen ? h.openingTime || null : null,
          closingTime: h.isOpen ? h.closingTime || null : null,
        }));
      if (rows.length) {
        await db.facilityOperatingHours.createMany({ data: rows });
      }
    }

    const existingSubscription = await db.facilitySubscription.findFirst({ where: { facilityId: auth.id } });
    if (!existingSubscription) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + FREE_PLAN_MONTHS);
      await db.facilitySubscription.create({
        data: { facilityId: auth.id, plan: "FREE", startDate, endDate, status: "ACTIVE" },
      });
    }

    const facility = await fetchFacility(auth.id);
    return NextResponse.json({ facility });
  } catch (e) {
    console.error("Facility profile completion error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
