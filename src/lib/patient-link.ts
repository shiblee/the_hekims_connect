import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { checkPass } from "@/lib/session-token";
import { logClinicEvent } from "@/lib/clinic-audit";
import type { AuthUser } from "@/lib/api-auth";

/** Is this patient already connected to the clinic (a visit or appointment there)? */
export async function patientLinked(patientId: string, facilityId: string) {
  return !!(await db.visit.findFirst({ where: { patientId, facilityId }, select: { id: true } }))
    || !!(await db.appointment.findFirst({ where: { patientId, facilityId }, select: { id: true } }));
}

/**
 * Before a clinic creates the FIRST visit or appointment for a patient (which gives it access to the
 * patient's profile), the patient must have been registered here, or found by exact-match search —
 * proved by the signed link pass the search hands out. A patient ID alone is never enough.
 * Returns null when allowed, otherwise an error message (and the refusal is logged).
 */
export async function checkNewPatientLink(req: NextRequest, auth: AuthUser, patientId: string, linkPass: unknown): Promise<string | null> {
  if (await patientLinked(patientId, auth.id)) return null;
  if (await checkPass(linkPass, "link", [patientId, auth.id])) return null;
  const registeredHere = await db.facilityAuditEvent.findFirst({ where: { facilityId: auth.id, action: "patient.registered", entityId: patientId }, select: { id: true } });
  if (registeredHere) return null;
  await logClinicEvent(req, auth, { action: "access.denied", outcome: "denied", summary: "Refused: a patient not linked to this clinic (patient ID used without search)", entityType: "patient", entityId: patientId });
  return "Find this patient with the search (full mobile number and name, or patient ID) first.";
}
