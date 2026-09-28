import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateOtp, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, contact, password, experience } = body;

    if (!name || !contact || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const registrationEnabled = await getSetting("registration", "hakim_registration_enabled", "true");
    if (registrationEnabled === "false") {
      return NextResponse.json({ error: "Hakim registration is currently closed. Please check back later." }, { status: 403 });
    }

    const { value: normalizedContact, isEmail } = normalizeContact(contact);

    const existing = await db.hakim.findFirst({
      where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A Hakim with this email or phone already exists" },
        { status: 409 }
      );
    }

    const hakim = await db.hakim.create({
      data: {
        name,
        email: isEmail ? normalizedContact : null,
        phone: isEmail ? null : normalizedContact,
        password: hashPassword(password),
        experience: experience ? parseInt(experience, 10) || 0 : 0,
        verified: false,
      },
    });

    const otpValidityMinutes = await getSetting("verification", "otp_expiry_minutes", "10");
    const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");

    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier: normalizedContact,
        code,
        purpose: "signup",
        hakimId: hakim.id,
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    if (isEmail) {
      await sendTemplatedEmail({
        templateKey: "hakim_otp_verification",
        to: normalizedContact,
        vars: { hakim_name: hakim.name, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_sent",
      });
    }

    return NextResponse.json({
      message: isEmail ? "OTP sent to your registered email" : "OTP sent to your registered phone",
      needsOtp: true,
      contact: normalizedContact,
      role: "hakim",
      name: hakim.name,
      devOtp: code,
    });
  } catch (e) {
    console.error("Hakim signup error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
