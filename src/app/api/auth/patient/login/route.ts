import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, generateOtp } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json({ error: "Phone and password are required" }, { status: 400 });
    }

    const patient = await db.patient.findUnique({ where: { phone } });
    if (!patient || !verifyPassword(password, patient.password)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!patient.active) {
      return NextResponse.json({ error: "This account has been suspended. Contact support." }, { status: 403 });
    }

    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier: patient.phone,
        code,
        purpose: "login",
        patientId: patient.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    return NextResponse.json({
      message: "OTP sent to your registered phone",
      needsOtp: true,
      contact: patient.phone,
      role: "patient",
      name: patient.name,
      devOtp: code,
    });
  } catch (e) {
    console.error("Patient login error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
