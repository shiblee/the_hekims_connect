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
      id: true, patientCode: true, name: true, email: true, phone: true, dob: true, dobApprox: true, gender: true, bloodGroup: true,
      titlePrefix: true, maritalStatus: true, city: true, state: true, emergencyContactName: true, emergencyRelationship: true,
      address: true, emergencyContact: true, occupation: true, height: true, weight: true,
      familyHistory: true, medicalHistory: true, chronicConditions: true, allergies: true,
      currentMedications: true, surgicalHistory: true, lifestyle: true, mizaj: true, photo: true, avatarColor: true,
      verified: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      _count: { select: { appointments: true, records: true, prescriptions: true, mizajAssessments: true, visits: true } },
    },
  });
  if (!patient) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  return NextResponse.json({ patient });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Profile edit: only these fields; sign-in email/phone stay with the patient's own verified flow.
  if (body.profile && typeof body.profile === "object") {
    const EDITABLE = [
      "name", "titlePrefix", "gender", "dob", "maritalStatus", "bloodGroup", "occupation", "address", "city", "state",
      "emergencyContactName", "emergencyContact", "emergencyRelationship", "height", "weight",
      "chronicConditions", "allergies", "currentMedications", "medicalHistory", "familyHistory", "surgicalHistory", "lifestyle",
    ] as const;
    const data: Record<string, string | boolean | null> = {};
    for (const k of EDITABLE) {
      if (!(k in body.profile)) continue;
      const v = body.profile[k];
      data[k] = typeof v === "string" ? (v.trim() || null) : null;
    }
    if ("name" in data && !data.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (data.dob && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.dob))) return NextResponse.json({ error: "Date of birth must be YYYY-MM-DD" }, { status: 400 });
    if ("dob" in data) data.dobApprox = false;
    const patient = await db.patient.update({ where: { id }, data, select: { id: true, name: true } });
    await logAdminActivity(session.admin.id, "patient_profile_updated", `Patient "${patient.name}" profile updated (${Object.keys(data).filter((k) => k !== "dobApprox").join(", ")})`, getClientIp(req));
    return NextResponse.json({ patient });
  }

  const { active } = body;
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
