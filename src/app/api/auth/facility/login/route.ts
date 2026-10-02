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

    const facility = await db.facility.findFirst({
      where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] },
    });

    if (facility?.lockedUntil && facility.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((facility.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    if (!facility || !verifyPassword(password, facility.password)) {
      if (facility) {
        const maxAttempts = parseInt(await getSetting("verification", "max_login_attempts", "5"), 10);
        const lockoutMinutes = parseInt(await getSetting("verification", "lockout_duration_minutes", "15"), 10);
        const attempts = facility.failedLoginAttempts + 1;
        if (attempts >= maxAttempts) {
          await db.facility.update({
            where: { id: facility.id },
            data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000) },
          });
          return NextResponse.json(
            { error: `Too many failed attempts. Try again in ${lockoutMinutes} minutes.` },
            { status: 429 }
          );
        }
        await db.facility.update({ where: { id: facility.id }, data: { failedLoginAttempts: attempts } });
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!facility.active) {
      return NextResponse.json({ error: "This account has been suspended. Contact support." }, { status: 403 });
    }

    if (facility.failedLoginAttempts > 0 || facility.lockedUntil) {
      await db.facility.update({ where: { id: facility.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const identifier = facility.email ?? facility.phone!;

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
        facilityId: facility.id,
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    let delivered = false;
    if (facility.email) {
      const result = await sendTemplatedEmail({
        templateKey: "facility_otp_verification",
        to: facility.email,
        vars: { facility_name: facility.facilityName, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_sent",
      });
      delivered = result.delivery === "sent";
    }

    return NextResponse.json({
      message: facility.email ? "OTP sent to your registered email" : "OTP sent to your registered phone",
      needsOtp: true,
      contact: identifier,
      role: "facility",
      facilityName: facility.facilityName,
      devOtp: delivered ? undefined : code,
    });
  } catch (e) {
    console.error("Facility login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
