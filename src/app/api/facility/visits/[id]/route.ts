import { NextRequest, NextResponse } from "next/server";
import { logClinicEvent } from "@/lib/clinic-audit";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

// Lets the doctor correct the attending-Hekim assignment from the
// pre-filled Registration wizard, without spinning up a new Visit the way
// the wizard's own first-time flow does.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const visit = await db.visit.findFirst({ where: { id, facilityId: auth.id }, select: { id: true, visitCode: true, doctorId: true, patient: { select: { name: true } } } });
  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const { doctorId } = await req.json();
  let validDoctorId: string | null = null;
  if (doctorId) {
    const doctor = await db.staff.findFirst({ where: { id: doctorId, facilityId: auth.id, active: true } });
    if (!doctor) {
      return NextResponse.json({ error: "Selected doctor was not found at this facility" }, { status: 400 });
    }
    validDoctorId = doctor.id;
  }

  const updated = await db.visit.update({
    where: { id },
    data: { doctorId: validDoctorId },
    select: { id: true, doctorId: true },
  });
  if (visit.doctorId !== validDoctorId) {
    const doc = validDoctorId ? await db.staff.findUnique({ where: { id: validDoctorId }, select: { name: true } }) : null;
    await logClinicEvent(req, auth, { action: "visit.updated", summary: `Attending Hakim for ${visit.visitCode} set to ${doc?.name ?? "any doctor"}`, entityType: "visit", entityId: id, entityLabel: `${visit.visitCode} · ${visit.patient.name}` });
  }

  return NextResponse.json({ visit: updated });
}
