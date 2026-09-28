import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp } from "@/lib/auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, role } = body;
    if (!contact) {
      return NextResponse.json({ error: "Contact is required" }, { status: 400 });
    }

    const user = role === "hakim"
      ? await db.hakim.findUnique({ where: { email: contact.toLowerCase() } })
      : await db.patient.findUnique({ where: { phone: contact } });
    if (!user) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const identifier = role === "hakim" ? (user as { email: string }).email : (user as { phone: string }).phone;

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

    if (role === "hakim") {
      const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
      await sendTemplatedEmail({
        templateKey: "hakim_otp_verification",
        to: identifier,
        vars: { hakim_name: (user as { name: string }).name, otp: code, otp_validity: otpValidityMinutes, portal_name: portalName },
        event: "otp_resent",
      });
    }

    return NextResponse.json({
      message: "A fresh OTP has been sent",
      devOtp: code,
    });
  } catch (e) {
    console.error("OTP send error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
