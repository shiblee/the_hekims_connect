import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeToken, fetchFacility, fetchPatient } from "@/lib/api-auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, code, role } = body;

    if (!contact || !code || !role) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const otp = await db.otpCode.findFirst({
      where: { identifier: contact, used: false },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json({ error: "No pending verification found. Please request a new OTP." }, { status: 400 });
    }

    if (new Date(otp.expiresAt).getTime() < Date.now()) {
      await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
      return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 410 });
    }

    const MAX_OTP_ATTEMPTS = parseInt(await getSetting("verification", "max_otp_attempts", "5"), 10);
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
      return NextResponse.json({ error: "Too many incorrect attempts. Please request a new OTP." }, { status: 429 });
    }

    if (otp.code !== code) {
      await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });

    if (role === "facility" && otp.facilityId) {
      const isSignup = otp.purpose === "signup";
      await db.facility.update({ where: { id: otp.facilityId }, data: { verified: true, lastLoginAt: new Date() } });
      const facility = await fetchFacility(otp.facilityId);

      await db.notificationLog.create({
        data: { recipient: contact, templateKey: "facility_otp_verification", status: "verified", event: "otp_verified" },
      });

      if (isSignup && facility?.email) {
        const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
        await sendTemplatedEmail({
          templateKey: "facility_welcome",
          to: facility.email,
          vars: {
            facility_name: facility.facilityName,
            facility_email: facility.email,
            portal_name: portalName,
            registration_date: new Date().toLocaleDateString(),
            login_url: `${getSiteUrl(req)}/login/facility`,
          },
          event: "welcome_sent",
        });
      }

      return NextResponse.json({
        success: true,
        token: makeToken("facility", otp.facilityId),
        user: facility,
        role: "facility",
      });
    } else if (role === "patient" && otp.patientId) {
      await db.patient.update({ where: { id: otp.patientId }, data: { verified: true, lastLoginAt: new Date() } });
      const patient = await fetchPatient(otp.patientId);
      return NextResponse.json({
        success: true,
        token: makeToken("patient", otp.patientId),
        user: patient,
        role: "patient",
      });
    }

    return NextResponse.json({ error: "Could not verify OTP" }, { status: 400 });
  } catch (e) {
    console.error("OTP verify error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
