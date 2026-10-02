import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, normalizeContact, isSecurePassword } from "@/lib/auth";
import { makeToken, fetchPatient } from "@/lib/api-auth";
import { sendTemplatedEmail } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { getSiteUrl } from "@/lib/site-url";
import { getClientIp, parseUserAgent } from "@/lib/request-info";

const PRECHECK_VALIDITY_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, contact, password } = body;
    const ip = getClientIp(req);
    const { browser, os, device } = parseUserAgent(req.headers.get("user-agent"));

    if (!name || !contact || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isSecurePassword(password)) {
      return NextResponse.json({ error: "Password must be at least 8 characters with one uppercase letter and one number" }, { status: 400 });
    }

    const registrationEnabled = await getSetting("registration", "patient_registration_enabled", "true");
    if (registrationEnabled === "false") {
      return NextResponse.json({ error: "Patient registration is currently closed. Please check back later." }, { status: 403 });
    }

    const { value: normalizedContact, isEmail } = normalizeContact(contact);

    const existing = await db.patient.findFirst({
      where: { OR: [{ email: normalizedContact }, { phone: normalizedContact }] },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A patient with this ${isEmail ? "email" : "phone"} already exists` },
        { status: 409 }
      );
    }

    const precheck = await db.otpCode.findFirst({
      where: { identifier: normalizedContact, purpose: "precheck", role: "patient", verifiedAt: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!precheck || Date.now() - new Date(precheck.verifiedAt!).getTime() > PRECHECK_VALIDITY_MS) {
      return NextResponse.json({ error: "Please verify your email or phone before registering" }, { status: 400 });
    }

    const patient = await db.patient.create({
      data: {
        name,
        email: isEmail ? normalizedContact : null,
        phone: isEmail ? null : normalizedContact,
        password: hashPassword(password),
        verified: true,
        lastLoginAt: new Date(),
      },
    });

    if (isEmail) {
      const portalName = await getSetting("general", "portal_name", "The Hekim's Connect");
      await sendTemplatedEmail({
        templateKey: "patient_welcome",
        to: normalizedContact,
        vars: {
          patient_name: patient.name,
          patient_email: normalizedContact,
          portal_name: portalName,
          registration_date: new Date().toLocaleDateString(),
          login_url: `${getSiteUrl(req)}/login/patient`,
        },
        event: "welcome_sent",
      });
    }

    const session = await db.userSession.create({
      data: { patientId: patient.id, ip, browser, os, device },
    });
    await db.loginEvent.create({
      data: {
        patientId: patient.id, identifier: normalizedContact, displayName: patient.name,
        ip, browser, os, device, status: "success", sessionId: session.id,
      },
    });

    return NextResponse.json({
      success: true,
      token: makeToken("patient", patient.id),
      user: await fetchPatient(patient.id),
      role: "patient",
    });
  } catch (e) {
    console.error("Patient signup error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
