import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "patient") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const patient = await db.patient.findUnique({ where: { id: auth.id } });
  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Strip password
  const { password, ...safe } = patient;
  return NextResponse.json({ user: safe });
}

export async function PUT(req: NextRequest) {
  const auth = getAuthUser(req);
  if (!auth || auth.type !== "patient") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const allowed = [
      "name", "phone", "dob", "gender", "bloodGroup", "address",
      "emergencyContact", "occupation", "height", "weight",
      "familyHistory", "medicalHistory", "chronicConditions", "allergies",
      "currentMedications", "surgicalHistory", "lifestyle", "mizaj", "avatarColor",
    ];
    const data: Record<string, any> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    const updated = await db.patient.update({
      where: { id: auth.id },
      data,
      select: {
        id: true, name: true, email: true, phone: true, dob: true, gender: true,
        bloodGroup: true, address: true, emergencyContact: true, occupation: true,
        height: true, weight: true, familyHistory: true, medicalHistory: true,
        chronicConditions: true, allergies: true, currentMedications: true,
        surgicalHistory: true, lifestyle: true, mizaj: true, avatarColor: true,
      },
    });
    return NextResponse.json({ user: updated });
  } catch (e) {
    console.error("Patient update error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
