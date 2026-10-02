import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, generateOtp, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, password } = body;

    if (!contact || !password) {
      return NextResponse.json({ error: "Email/phone and password are required" }, { status: 400 });
    }

    const { value: normalizedContact } = normalizeContact(contact);

    const hakim = await db.hakim.findFirst({
      where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] },
    });

    if (hakim?.lockedUntil && hakim.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((hakim.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    if (!hakim || !verifyPassword(password, hakim.password)) {
      if (hakim) {
        const maxAttempts = parseInt(await getSetting("verification", "max_login_attempts", "5"), 10);
        const lockoutMinutes = parseInt(await getSetting("verification", "lockout_duration_minutes", "15"), 10);
        const attempts = hakim.failedLoginAttempts + 1;
        if (attempts >= maxAttempts) {
          await db.hakim.update({
            where: { id: hakim.id },
            data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000) },
          });
          return NextResponse.json(
            { error: `Too many failed attempts. Try again in ${lockoutMinutes} minutes.` },
            { status: 429 }
          );
        }
        await db.hakim.update({ where: { id: hakim.id }, data: { failedLoginAttempts: attempts } });
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!hakim.active) {
      return NextResponse.json({ error: "This account has been suspended. Contact support." }, { status: 403 });
    }

    if (hakim.failedLoginAttempts > 0 || hakim.lockedUntil) {
      await db.hakim.update({ where: { id: hakim.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const identifier = hakim.email ?? hakim.phone!;

    const cooldownSeconds = parseInt(await getSetting("verification", "otp_resend_cooldown_seconds", "30"), 10);
    const lastOtp = await db.otpCode.findFirst({ where: { identifier, purpose: "login" }, orderBy: { createdAt: "desc" } });
    if (lastOtp && Date.now() - new Date(lastOtp.createdAt).getTime() < cooldownSeconds * 1000) {
      const waitSeconds = Math.ceil((cooldownSeconds * 1000 - (Date.now() - new Date(lastOtp.createdAt).getTime())) / 1000);
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another code` }, { status: 429 });
    }

    const otpValidityMinutes = await getSetting("verification", "otp_expiry_minutes", "10");
    const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");

    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier,
        code,
        purpose: "login",
        hakimId: hakim.id,
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    let delivered = false;
    if (hakim.email) {
      const result = await sendTemplatedEmail({
        templateKey: "hakim_otp_verification",
        to: hakim.email,
        vars: { hakim_name: hakim.name, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_sent",
      });
      delivered = result.delivery === "sent";
    }

    return NextResponse.json({
      message: hakim.email ? "OTP sent to your registered email" : "OTP sent to your registered phone",
      needsOtp: true,
      contact: identifier,
      role: "hakim",
      name: hakim.name,
      devOtp: delivered ? undefined : code,
    });
  } catch (e) {
    console.error("Hakim login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
