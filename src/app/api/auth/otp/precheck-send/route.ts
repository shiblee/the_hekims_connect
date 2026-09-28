import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

/**
 * Sends a code to verify ownership of an email/phone BEFORE an account exists —
 * used by the inline "Send Code" widget on the registration form. No Hakim/Patient
 * row is created here; see precheck-verify + the signup routes for the rest.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, role } = body;
    if (!contact || (role !== "hakim" && role !== "patient")) {
      return NextResponse.json({ error: "Contact and role are required" }, { status: 400 });
    }

    const { value: normalizedContact, isEmail } = normalizeContact(contact);

    const existing = role === "hakim"
      ? await db.hakim.findFirst({ where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] } })
      : await db.patient.findFirst({ where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] } });
    if (existing) {
      return NextResponse.json(
        { error: `An account with this ${isEmail ? "email" : "phone"} already exists` },
        { status: 409 }
      );
    }

    const cooldownSeconds = parseInt(await getSetting("verification", "otp_resend_cooldown_seconds", "30"), 10);
    const lastOtp = await db.otpCode.findFirst({
      where: { identifier: normalizedContact, purpose: "precheck" },
      orderBy: { createdAt: "desc" },
    });
    if (lastOtp && Date.now() - new Date(lastOtp.createdAt).getTime() < cooldownSeconds * 1000) {
      const waitSeconds = Math.ceil((cooldownSeconds * 1000 - (Date.now() - new Date(lastOtp.createdAt).getTime())) / 1000);
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another code` }, { status: 429 });
    }

    const otpValidityMinutes = await getSetting("verification", "otp_expiry_minutes", "10");
    const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier: normalizedContact,
        code,
        purpose: "precheck",
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    if (isEmail) {
      await sendTemplatedEmail({
        templateKey: "hakim_otp_verification",
        to: normalizedContact,
        vars: { hakim_name: "there", otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_sent",
      });
    }

    return NextResponse.json({
      message: isEmail ? "Code sent to your email" : "Code sent to your phone",
      contact: normalizedContact,
      devOtp: code,
    });
  } catch (e) {
    console.error("Precheck send error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
