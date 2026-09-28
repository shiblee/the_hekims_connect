import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const patient = await db.patient.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, phone: true, dob: true, gender: true, bloodGroup: true,
      address: true, emergencyContact: true, occupation: true, height: true, weight: true,
      familyHistory: true, medicalHistory: true, chronicConditions: true, allergies: true,
      currentMedications: true, surgicalHistory: true, lifestyle: true, mizaj: true, avatarColor: true,
      verified: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      _count: { select: { appointments: true, records: true, prescriptions: true, mizajAssessments: true } },
    },
  });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  return NextResponse.json({ patient });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { active } = await req.json();
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const patient = await db.patient.update({ where: { id }, data: { active }, select: { id: true, name: true, active: true } });
  await logAdminActivity(
    session.admin.id,
    "patient_account_status_changed",
    `Patient "${patient.name}" ${active ? "activated" : "suspended"}`,
    getClientIp(req)
  );

  return NextResponse.json({ patient });
}
