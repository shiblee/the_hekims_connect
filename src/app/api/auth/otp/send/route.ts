import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp, normalizeContact } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, role } = body;
    if (!contact) {
      return NextResponse.json({ error: "Contact is required" }, { status: 400 });
    }

    const { value: normalizedContact } = normalizeContact(contact);

    const user = role === "hakim"
      ? await db.hakim.findFirst({ where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] } })
      : await db.patient.findFirst({ where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] } });
    if (!user) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const identifier = (user as { email: string | null; phone: string | null }).email ?? (user as { phone: string }).phone;

    const cooldownSeconds = parseInt(await getSetting("verification", "otp_resend_cooldown_seconds", "30"), 10);
    const lastOtp = await db.otpCode.findFirst({ where: { identifier }, orderBy: { createdAt: "desc" } });
    if (lastOtp && Date.now() - new Date(lastOtp.createdAt).getTime() < cooldownSeconds * 1000) {
      const waitSeconds = Math.ceil((cooldownSeconds * 1000 - (Date.now() - new Date(lastOtp.createdAt).getTime())) / 1000);
      return NextResponse.json({ error: `Please wait ${waitSeconds}s before requesting another OTP` }, { status: 429 });
    }

    // Invalidate any previous unused OTPs for this identifier before issuing a new one.
    await db.otpCode.updateMany({ where: { identifier, used: false }, data: { used: true } });

    const otpValidityMinutes = await getSetting("verification", "otp_expiry_minutes", "10");
    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier,
        code,
        purpose: "resend",
        hakimId: role === "hakim" ? user.id : undefined,
        patientId: role === "patient" ? user.id : undefined,
        expiresAt: new Date(Date.now() + parseInt(otpValidityMinutes, 10) * 60 * 1000),
      },
    });

    let delivered = false;
    if ((user as { email: string | null }).email) {
      const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
      const nameVar = role === "hakim" ? "hakim_name" : "patient_name";
      const result = await sendTemplatedEmail({
        templateKey: role === "hakim" ? "hakim_otp_verification" : "patient_otp_verification",
        to: identifier,
        vars: { [nameVar]: (user as { name: string }).name, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_resent",
      });
      delivered = result.delivery === "sent";
    }

    return NextResponse.json({
      message: "A fresh OTP has been sent",
      devOtp: delivered ? undefined : code,
    });
  } catch (e) {
    console.error("OTP send error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
