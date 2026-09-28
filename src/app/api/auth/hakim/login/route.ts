import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, generateOtp } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const hakim = await db.hakim.findUnique({ where: { email: email.toLowerCase() } });
    if (!hakim || !verifyPassword(password, hakim.password)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!hakim.active) {
      return NextResponse.json({ error: "This account has been suspended. Contact support." }, { status: 403 });
    }

    const otpValidityMinutes = await getSetting("verification", "otp_expiry_minutes", "10");
    const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");

    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier: hakim.email,
        code,
        purpose: "login",
        hakimId: hakim.id,
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    await sendTemplatedEmail({
      templateKey: "hakim_otp_verification",
      to: hakim.email,
      vars: { hakim_name: hakim.name, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
      event: "otp_sent",
    });

    return NextResponse.json({
      message: "OTP sent to your registered email & phone",
      needsOtp: true,
      contact: hakim.email,
      role: "hakim",
      name: hakim.name,
      devOtp: code,
    });
  } catch (e) {
    console.error("Hakim login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
