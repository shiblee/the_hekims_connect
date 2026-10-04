import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeToken, fetchFacility, fetchPatient, fetchStaff } from "@/lib/api-auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";
import { getClientIp, parseUserAgent } from "@/lib/request-info";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { contact, code, role, patientId: chosenPatientId } = body;
    const ip = getClientIp(req);
    const { browser, os, device } = parseUserAgent(req.headers.get("user-agent"));

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

    // A phone can match more than one Patient row (family members sharing a
    // mobile). The code was correct, but we don't yet know which profile to
    // log in as — ask the frontend to pick one, without consuming the OTP yet.
    if (role === "patient" && !otp.patientId && !chosenPatientId) {
      const candidates = await db.patient.findMany({
        where: { OR: [{ email: otp.identifier }, { phone: otp.identifier }] },
        select: { id: true, patientCode: true, name: true, gender: true, dob: true, avatarColor: true, active: true },
      });
      const selectable = candidates.filter((c) => c.active);
      if (selectable.length > 1) {
        return NextResponse.json({ multiple: true, candidates: selectable });
      }
      if (selectable.length === 0) {
        return NextResponse.json({ error: "This account has been suspended. Contact support." }, { status: 403 });
      }
      // Exactly one active match after all — fall through and complete login as them.
    }

    let resolvedPatientId = otp.patientId;
    if (role === "patient" && !resolvedPatientId && chosenPatientId) {
      const chosen = await db.patient.findFirst({
        where: { id: chosenPatientId, OR: [{ email: otp.identifier }, { phone: otp.identifier }] },
      });
      if (!chosen || !chosen.active) {
        return NextResponse.json({ error: "Could not verify OTP" }, { status: 400 });
      }
      resolvedPatientId = chosen.id;
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

      if (facility) {
        const session = await db.userSession.create({
          data: { facilityId: facility.id, ip, browser, os, device },
        });
        await db.loginEvent.create({
          data: {
            facilityId: facility.id, identifier: contact, displayName: facility.facilityName,
            ip, browser, os, device, status: "success", sessionId: session.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        token: makeToken("facility", otp.facilityId),
        user: facility,
        role: "facility",
      });
    } else if (role === "patient" && resolvedPatientId) {
      await db.patient.update({ where: { id: resolvedPatientId }, data: { verified: true, lastLoginAt: new Date() } });
      const patient = await fetchPatient(resolvedPatientId);

      if (patient) {
        const session = await db.userSession.create({
          data: { patientId: patient.id, ip, browser, os, device },
        });
        await db.loginEvent.create({
          data: {
            patientId: patient.id, identifier: contact, displayName: patient.name,
            ip, browser, os, device, status: "success", sessionId: session.id,
          },
        });
      }

      return NextResponse.json({
        success: true,
        token: makeToken("patient", resolvedPatientId),
        user: patient,
        role: "patient",
      });
    } else if (role === "staff" && otp.staffId) {
      await db.staff.update({ where: { id: otp.staffId }, data: { lastLoginAt: new Date() } });
      const staff = await fetchStaff(otp.staffId);

      return NextResponse.json({
        success: true,
        token: makeToken("staff", otp.staffId),
        user: staff,
        role: "staff",
      });
    }

    return NextResponse.json({ error: "Could not verify OTP" }, { status: 400 });
  } catch (e) {
    console.error("OTP verify error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
