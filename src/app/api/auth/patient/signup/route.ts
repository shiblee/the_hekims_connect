import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateOtp } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, password } = body;

    if (!name || !phone || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const existing = await db.patient.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json(
        { error: "A patient with this phone number already exists" },
        { status: 409 }
      );
    }

    const patient = await db.patient.create({
      data: {
        name,
        phone,
        password: hashPassword(password),
      },
    });

    const code = generateOtp();
    await db.otpCode.create({
      data: {
        identifier: patient.phone,
        code,
        purpose: "signup",
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
    console.error("Patient signup error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
