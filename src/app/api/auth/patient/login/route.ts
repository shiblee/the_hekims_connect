import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, generateOtp, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { getClientIp, parseUserAgent } from "@/lib/request-info";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, password } = body;

    if (!contact || !password) {
      return NextResponse.json({ error: "Email/phone and password are required" }, { status: 400 });
    }

    const { value: normalizedContact } = normalizeContact(contact);
    const ip = getClientIp(req);
    const { browser, os, device } = parseUserAgent(req.headers.get("user-agent"));

    const patient = await db.patient.findFirst({
      where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] },
    });

    if (patient?.lockedUntil && patient.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((patient.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many failed attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }

    if (!patient || !verifyPassword(password, patient.password)) {
      if (patient) {
        const maxAttempts = parseInt(await getSetting("verification", "max_login_attempts", "5"), 10);
        const lockoutMinutes = parseInt(await getSetting("verification", "lockout_duration_minutes", "15"), 10);
        const attempts = patient.failedLoginAttempts + 1;
        if (attempts >= maxAttempts) {
          await db.patient.update({
            where: { id: patient.id },
            data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + lockoutMinutes * 60 * 1000) },
          });
          await db.loginEvent.create({
            data: {
              patientId: patient.id, identifier: normalizedContact, displayName: patient.name,
              ip, browser, os, device, status: "failed", failureReason: "Account locked",
            },
          });
          return NextResponse.json(
            { error: `Too many failed attempts. Try again in ${lockoutMinutes} minutes.` },
            { status: 429 }
          );
        }
        await db.patient.update({ where: { id: patient.id }, data: { failedLoginAttempts: attempts } });
        await db.loginEvent.create({
          data: {
            patientId: patient.id, identifier: normalizedContact, displayName: patient.name,
            ip, browser, os, device, status: "failed", failureReason: "Incorrect password",
          },
        });
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!patient.active) {
      return NextResponse.json({ error: "This account has been suspended. Contact support." }, { status: 403 });
    }

    if (patient.failedLoginAttempts > 0 || patient.lockedUntil) {
      await db.patient.update({ where: { id: patient.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const identifier = patient.email ?? patient.phone!;

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
        patientId: patient.id,
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    let delivered = false;
    if (patient.email) {
      const result = await sendTemplatedEmail({
        templateKey: "patient_otp_verification",
        to: patient.email,
        vars: { patient_name: patient.name, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_sent",
      });
      delivered = result.delivery === "sent";
    }

    return NextResponse.json({
      message: patient.email ? "OTP sent to your registered email" : "OTP sent to your registered phone",
      needsOtp: true,
      contact: identifier,
      role: "patient",
      name: patient.name,
      devOtp: delivered ? undefined : code,
    });
  } catch (e) {
    console.error("Patient login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
