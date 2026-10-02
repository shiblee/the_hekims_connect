import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, normalizeContact, isSecurePassword } from "@/lib/auth";
import { makeToken, fetchFacility } from "@/lib/api-auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";

const PRECHECK_VALIDITY_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, contact, password, experience } = body;

    if (!name || !contact || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isSecurePassword(password)) {
      return NextResponse.json({ error: "Password must be at least 8 characters with one uppercase letter and one number" }, { status: 400 });
    }

    const registrationEnabled = await getSetting("registration", "facility_registration_enabled", "true");
    if (registrationEnabled === "false") {
      return NextResponse.json({ error: "Facility registration is currently closed. Please check back later." }, { status: 403 });
    }

    const { value: normalizedContact, isEmail } = normalizeContact(contact);

    const existing = await db.facility.findFirst({
      where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A Facility with this email or phone already exists" },
        { status: 409 }
      );
    }

    const precheck = await db.otpCode.findFirst({
      where: { identifier: normalizedContact, purpose: "precheck", role: "facility", verifiedAt: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!precheck || Date.now() - new Date(precheck.verifiedAt!).getTime() > PRECHECK_VALIDITY_MS) {
      return NextResponse.json({ error: "Please verify your email or phone before registering" }, { status: 400 });
    }

    const facility = await db.facility.create({
      data: {
        name,
        email: isEmail ? normalizedContact : null,
        phone: isEmail ? null : normalizedContact,
        password: hashPassword(password),
        experience: experience ? parseInt(experience, 10) || 0 : 0,
        verified: true,
        lastLoginAt: new Date(),
      },
    });

    if (isEmail) {
      const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
      await sendTemplatedEmail({
        templateKey: "facility_welcome",
        to: normalizedContact,
        vars: {
          facility_name: facility.name,
          facility_email: normalizedContact,
          portal_name: portalName,
          registration_date: new Date().toLocaleDateString(),
          login_url: `${getSiteUrl(req)}/login/facility`,
        },
        event: "welcome_sent",
      });
    }

    return NextResponse.json({
      success: true,
      token: makeToken("facility", facility.id),
      user: await fetchFacility(facility.id),
      role: "facility",
    });
  } catch (e) {
    console.error("Facility signup error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
