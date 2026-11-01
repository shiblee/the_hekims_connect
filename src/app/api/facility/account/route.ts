import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { logClinicEvent, changedFields } from "@/lib/clinic-audit";

const SELECT = {
  id: true, staffCode: true, name: true, photo: true, email: true, phone: true, contactVerifiedAt: true,
  employeeType: true, specialization: true, qualification: true, designation: true, registrationNumber: true,
  experience: true, role: true, active: true, lastLoginAt: true, createdAt: true, updatedAt: true,
  facility: { select: { id: true, facilityName: true } },
};
// What a staff member may change about themselves. Role, employee type, sign-in contact and
// permissions stay with the clinic owner.
const SELF_EDITABLE = ["name", "specialization", "qualification", "designation", "registrationNumber"] as const;

/** The signed-in staff member's own profile (clinic owners use Facility Profile). */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.staffId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const staff = await db.staff.findUnique({ where: { id: auth.staffId }, select: SELECT });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json({ staff });
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.staffId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const before = await db.staff.findUnique({ where: { id: auth.staffId }, select: { name: true, staffCode: true, specialization: true, qualification: true, designation: true, registrationNumber: true, experience: true } });
  if (!before) return NextResponse.json({ error: "Staff not found" }, { status: 404 });

  const data: Record<string, string | number | null> = {};
  for (const k of SELF_EDITABLE) {
    if (!(k in body)) continue;
    data[k] = typeof body[k] === "string" ? body[k].trim() || null : null;
  }
  if ("name" in data && !data.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if ("experience" in body) {
    const n = body.experience === "" || body.experience === null ? null : Number(body.experience);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 80)) return NextResponse.json({ error: "Years of experience must be a whole number" }, { status: 400 });
    data.experience = n;
  }
  if ("photo" in body) {
    const p = body.photo;
    if (p !== null && (typeof p !== "string" || !p.startsWith("data:image/") || p.length > 2_000_000)) return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
    data.photo = p;
  }

  const staff = await db.staff.update({ where: { id: auth.staffId }, data, select: SELECT });
  const fields = changedFields(before as unknown as Record<string, unknown>, data, Object.keys(data).filter((k) => k !== "photo"));
  if ("photo" in data) fields.push("photo");
  if (fields.length) {
    const label = `${staff.name} (${staff.staffCode})`;
    await logClinicEvent(req, auth, { action: "staff.updated", summary: `Updated own ${fields.join(", ")}`, entityType: "staff", entityId: staff.id, entityLabel: label, details: { fields, self: true } });
  }
  return NextResponse.json({ staff });
}
