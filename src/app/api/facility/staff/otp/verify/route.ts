import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { normalizeContact } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

/** Confirms the code from staff/otp/send. Marks it verified so POST /api/facility/staff can trust it. */
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { contact, code } = body;
  if (!contact || !code) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { value: normalizedContact } = normalizeContact(contact);

  const otp = await db.otpCode.findFirst({
    where: { identifier: normalizedContact, purpose: "staff_verify", used: false },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    return NextResponse.json({ error: "No pending code found. Please request a new one." }, { status: 400 });
  }
  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    return NextResponse.json({ error: "Code expired. Please request a new one." }, { status: 410 });
  }

  const MAX_OTP_ATTEMPTS = parseInt(await getSetting("verification", "max_otp_attempts", "5"), 10);
  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await db.otpCode.update({ where: { id: otp.id }, data: { used: true } });
    return NextResponse.json({ error: "Too many incorrect attempts. Please request a new code." }, { status: 429 });
  }

  if (otp.code !== code) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await db.otpCode.update({ where: { id: otp.id }, data: { used: true, verifiedAt: new Date() } });

  return NextResponse.json({ verified: true, contact: normalizedContact });
}
