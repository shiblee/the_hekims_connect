import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

/** Passwordless login: sends an OTP straight to an existing account, no password required. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, role } = body;
    if (!contact || (role !== "facility" && role !== "patient")) {
      return NextResponse.json({ error: "Contact and role are required" }, { status: 400 });
    }

    const { value: normalizedContact } = normalizeContact(contact);

    const user = role === "facility"
      ? await db.facility.findFirst({ where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] } })
      : await db.patient.findFirst({ where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] } });

    if (!user) {
      return NextResponse.json({ error: "No account found with this email or phone" }, { status: 404 });
    }
    if (!user.active) {
      return NextResponse.json({ error: "This account has been suspended. Contact support." }, { status: 403 });
    }

    const identifier = (user as { email: string | null; phone: string | null }).email ?? (user as { phone: string }).phone;

    const cooldownSeconds = parseInt(await getSetting("verification", "otp_resend_cooldown_seconds", "30"), 10);
    const lastOtp = await db.otpCode.findFirst({ where: { identifier, purpose: "login" }, orderBy: { createdAt: "desc" } });
    if (lastOtp && Date.now() - new Date(lastOtp.createdAt).getTime() < cooldownSeconds * 1000) {
      const waitSeconds = Math.ceil((cooldownSeconds * 1000 - (Date.now() - new Date(lastOtp.createdAt).getTime())) / 1000);
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another code` }, { status: 429 });
    }

    const otpValidityMinutes = await getSetting("verification", "otp_expiry_minutes", "10");
    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier,
        code,
        purpose: "login",
        facilityId: role === "facility" ? user.id : undefined,
        patientId: role === "patient" ? user.id : undefined,
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    const hasEmail = !!(user as { email: string | null }).email;
    let delivered = false;
    if (hasEmail) {
      const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
      const nameVar = role === "facility" ? "facility_name" : "patient_name";
      const result = await sendTemplatedEmail({
        templateKey: role === "facility" ? "facility_otp_verification" : "patient_otp_verification",
        to: identifier,
        vars: { [nameVar]: user.name, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_sent",
      });
      delivered = result.delivery === "sent";
    }

    return NextResponse.json({
      message: hasEmail ? "OTP sent to your registered email" : "OTP sent to your registered phone",
      contact: identifier,
      name: user.name,
      devOtp: delivered ? undefined : code,
    });
  } catch (e) {
    console.error("OTP login-send error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
