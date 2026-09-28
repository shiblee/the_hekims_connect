import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { newEmail, code } = await req.json();
  if (!newEmail || !code) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  const email = String(newEmail).toLowerCase().trim();

  const otp = await db.otpCode.findFirst({
    where: { identifier: email, adminId: session.admin.id, purpose: "admin_email_change", used: false },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) {
    return NextResponse.json({ error: "No pending verification for this email. Request a new OTP." }, { status: 400 });
  }

  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    return NextResponse.json({ error: "OTP expired. Please request a new one." }, { status: 410 });
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    return NextResponse.json({ error: "Too many incorrect attempts. Request a new OTP." }, { status: 429 });
  }

  if (otp.code !== code) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  // Re-check uniqueness in case another admin claimed this email meanwhile.
  const existing = await db.admin.findUnique({ where: { email } });
  if (existing && existing.id !== session.admin.id) {
    return NextResponse.json({ error: "This email is already registered to another admin" }, { status: 409 });
  }

  await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });

  const previousEmail = session.admin.email;
  const updated = await db.admin.update({
    where: { id: session.admin.id },
    data: { email },
    select: { id: true, name: true, email: true, avatarColor: true, avatarImage: true },
  });

  const ip = getClientIp(req);
  await logAdminActivity(session.admin.id, "otp_verified", `OTP verified for email change to ${email}`, ip);
  await logAdminActivity(session.admin.id, "email_changed", `Email changed from ${previousEmail} to ${email}`, ip);

  return NextResponse.json({ admin: updated });
}
