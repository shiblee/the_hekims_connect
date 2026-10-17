import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";

/** Clinic (facility) or staff caller, resolved to their facility and display name. */
export async function getClinicActor(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || (auth.type !== "facility" && auth.type !== "staff")) return null;
  if (auth.type === "facility") {
    const f = await db.facility.findUnique({ where: { id: auth.id }, select: { facilityName: true } });
    return f ? { type: "facility" as const, id: auth.id, facilityId: auth.id, name: f.facilityName } : null;
  }
  const s = await db.staff.findUnique({ where: { id: auth.id }, select: { facilityId: true, name: true, designation: true } });
  return s ? { type: "staff" as const, id: auth.id, facilityId: s.facilityId, name: s.designation ? `${s.name} (${s.designation})` : s.name } : null;
}

/** A clinic only sees patients it has a visit or appointment with — same rule as the patient routes. */
export function patientInScope(patientId: string, facilityId: string) {
  return db.patient.findFirst({
    where: { id: patientId, OR: [{ visits: { some: { facilityId } } }, { appointments: { some: { facilityId } } }] },
    select: { id: true },
  });
}
