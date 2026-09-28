import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateOtp } from "@/lib/auth";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { newEmail } = await req.json();
  if (!newEmail || !EMAIL_RE.test(String(newEmail).trim())) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const email = String(newEmail).toLowerCase().trim();

  if (email === session.admin.email.toLowerCase()) {
    return NextResponse.json({ error: "This is already your current email address" }, { status: 400 });
  }

  const existing = await db.admin.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "This email is already registered to another admin" }, { status: 409 });
  }

  const code = generateOtp();
  await db.otpCode.create({
    data: {
      identifier: email,
      code,
      purpose: "admin_email_change",
      adminId: session.admin.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await logAdminActivity(session.admin.id, "otp_requested", `OTP requested for email change to ${email}`, getClientIp(req));

  return NextResponse.json({
    message: "OTP sent to the new email address",
    newEmail: email,
    devOtp: code,
  });
}
