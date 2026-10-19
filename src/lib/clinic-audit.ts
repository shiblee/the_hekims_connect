import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getClientIp } from "@/lib/request-info";
import type { AuthUser } from "@/lib/api-auth";

// Clinic activity log (FacilityAuditEvent). Recording never blocks or breaks the action it
// describes — a failed write is reported to the server log only.

export const AUDIT_ACTIONS: Record<string, { label: string; group: string }> = {
  "auth.login": { label: "Signed in", group: "Sign-in" },
  "auth.login_failed": { label: "Sign-in failed", group: "Sign-in" },
  "auth.logout": { label: "Signed out", group: "Sign-in" },
  "auth.session_expired": { label: "Session expired", group: "Sign-in" },
  "access.denied": { label: "Access refused", group: "Security" },
  "patient.registered": { label: "Patient registered", group: "Patients" },
  "patient.linked": { label: "Existing patient linked", group: "Patients" },
  "patient.updated": { label: "Patient details updated", group: "Patients" },
  "visit.created": { label: "Visit started", group: "Visits" },
  "visit.updated": { label: "Visit updated", group: "Visits" },
  "visit.referred": { label: "Patient referred out", group: "Visits" },
  "visit.referral_withdrawn": { label: "Referral withdrawn", group: "Visits" },
  "payment.recorded": { label: "Payment recorded", group: "Payments" },
  "payment.cancelled": { label: "Payment cancelled", group: "Payments" },
  "payment.refunded": { label: "Payment refunded", group: "Payments" },
  "staff.created": { label: "Staff added", group: "Staff" },
  "staff.updated": { label: "Staff updated", group: "Staff" },
  "staff.activated": { label: "Staff activated", group: "Staff" },
  "staff.deactivated": { label: "Staff deactivated", group: "Staff" },
  "permissions.role_changed": { label: "Role permissions changed", group: "Staff" },
  "permissions.person_changed": { label: "Person's permissions changed", group: "Staff" },
  "facility.updated": { label: "Clinic settings changed", group: "Clinic" },
};

export interface AuditInput {
  action: keyof typeof AUDIT_ACTIONS | string;
  summary: string;
  entityType?: string;
  entityId?: string | null;
  entityLabel?: string | null;
  outcome?: "success" | "denied" | "failed";
  details?: Record<string, unknown>;
}

/** Who is acting: the clinic owner, or a staff member working for the clinic. */
async function actorOf(auth: Pick<AuthUser, "id" | "type" | "staffId">) {
  if (auth.staffId) {
    const s = await db.staff.findUnique({ where: { id: auth.staffId }, select: { name: true, staffCode: true } });
    return { actorType: "staff", actorId: auth.staffId, actorName: s ? `${s.name} (${s.staffCode})` : "Staff member" };
  }
  const f = await db.facility.findUnique({ where: { id: auth.id }, select: { facilityName: true } });
  return { actorType: "facility", actorId: auth.id, actorName: f ? `${f.facilityName} (owner)` : "Clinic owner" };
}

export async function logClinicEvent(req: NextRequest | null, auth: Pick<AuthUser, "id" | "type" | "staffId" | "sessionId">, e: AuditInput) {
  try {
    if (auth.type !== "facility") return; // clinic events only (staff sessions act as their facility)
    const actor = await actorOf(auth);
    await db.facilityAuditEvent.create({
      data: {
        facilityId: auth.id, ...actor,
        action: e.action, summary: e.summary.slice(0, 500),
        entityType: e.entityType ?? null, entityId: e.entityId ?? null, entityLabel: e.entityLabel?.slice(0, 200) ?? null,
        outcome: e.outcome ?? "success",
        details: e.details ? JSON.stringify(e.details).slice(0, 2000) : null,
        ip: req ? getClientIp(req) : null, sessionId: auth.sessionId ?? null,
      },
    });
  } catch (err) {
    console.error("Clinic audit write failed:", err);
  }
}

/** For events before a session exists (sign-in) or outside a request's auth (system). */
export async function logClinicEventRaw(data: {
  facilityId: string; actorType: string; actorId?: string | null; actorName: string; action: string; summary: string;
  outcome?: string; entityType?: string; entityId?: string | null; entityLabel?: string | null; ip?: string | null; sessionId?: string | null;
}) {
  try {
    await db.facilityAuditEvent.create({ data: { ...data, outcome: data.outcome ?? "success", summary: data.summary.slice(0, 500) } });
  } catch (err) {
    console.error("Clinic audit write failed:", err);
  }
}

/** Names of the fields that differ between two plain records (values are not stored). */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]) {
  return keys.filter((k) => after[k] !== undefined && String(before[k] ?? "") !== String(after[k] ?? ""));
}
