import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, fetchFacility } from "@/lib/api-auth";
import { getSetting } from "@/lib/settings";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site-url";

interface OperatingHourInput {
  dayOfWeek: number;
  isOpen: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
  openingTime2?: string | null;
  closingTime2?: string | null;
}

// ABDM Health Facility Registry ID format: "IN" followed by 10 digits (e.g. IN0123456789).
const HFR_PATTERN = /^IN\d{10}$/i;

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      facilityName, facilityType, hfrNumber, establishmentDate,
      addressLine1, addressLine2, locality, city, district, state, country, pincode,
      alternateContactNumber,
      bedCapacity, dailyOpdCount, dailyAdmissions,
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

    if (establishmentDate && establishmentDate > new Date().toISOString().slice(0, 7)) {
      return NextResponse.json({ error: "Establishment month/year cannot be in the future" }, { status: 400 });
    }

    if (hfrNumber && !HFR_PATTERN.test(hfrNumber)) {
      return NextResponse.json({ error: "HFR Number should be IN followed by 10 digits (e.g. IN0123456789)" }, { status: 400 });
    }

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
        hfrNumber: hfrNumber.toUpperCase(),
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
          openingTime2: h.isOpen ? h.openingTime2 || null : null,
          closingTime2: h.isOpen ? h.closingTime2 || null : null,
        }));
      if (rows.length) {
        await db.facilityOperatingHours.createMany({ data: rows });
      }
    }

    const [trialMonthsSetting, priceSetting, currencySetting, portalName] = await Promise.all([
      getSetting("subscription", "free_trial_months", "3"),
      getSetting("subscription", "paid_plan_price_per_month", "999"),
      getSetting("subscription", "currency", "INR"),
      getSetting("general", "portal_name", "The Hekim's Connect"),
    ]);
    const trialMonths = parseInt(trialMonthsSetting, 10) || 3;

    const existingSubscription = await db.facilitySubscription.findFirst({ where: { facilityId: auth.id } });
    let subscriptionStart = existingSubscription?.startDate ?? new Date();
    let subscriptionEnd = existingSubscription?.endDate;
    if (!existingSubscription) {
      subscriptionStart = new Date();
      subscriptionEnd = new Date(subscriptionStart);
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + trialMonths);
      await db.facilitySubscription.create({
        data: { facilityId: auth.id, plan: "FREE", startDate: subscriptionStart, endDate: subscriptionEnd, status: "ACTIVE" },
      });
    }

    const facility = await fetchFacility(auth.id);

    if (facility?.email && subscriptionEnd) {
      const addressParts = [addressLine1, addressLine2, locality, city, district, state, pincode].filter(Boolean);
      await sendTemplatedEmail({
        templateKey: "facility_profile_completed",
        to: facility.email,
        vars: {
          facility_name: facility.facilityName,
          facility_type: facilityType,
          hfr_number: hfrNumber,
          address: addressParts.join(", "),
          trial_months: String(trialMonths),
          start_date: subscriptionStart.toLocaleDateString(),
          end_date: subscriptionEnd.toLocaleDateString(),
          paid_price: priceSetting,
          currency: currencySetting,
          portal_name: portalName,
          login_url: `${getSiteUrl(req)}/login/facility`,
        },
        event: "profile_completed",
      });
    }

    return NextResponse.json({ facility });
  } catch (e) {
    console.error("Facility profile completion error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
