import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { makeToken, fetchPatient } from "@/lib/api-auth";

const PRECHECK_VALIDITY_MS = 30 * 60 * 1000;

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

    const precheck = await db.otpCode.findFirst({
      where: { identifier: phone, purpose: "precheck", verifiedAt: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (!precheck || Date.now() - new Date(precheck.verifiedAt!).getTime() > PRECHECK_VALIDITY_MS) {
      return NextResponse.json({ error: "Please verify your phone number before registering" }, { status: 400 });
    }

    const patient = await db.patient.create({
      data: {
        name,
        phone,
        password: hashPassword(password),
        verified: true,
        lastLoginAt: new Date(),
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
