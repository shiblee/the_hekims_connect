import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { makeSessionToken, readSessionToken } from "@/lib/session-token";

export interface AuthUser {
  id: string;
  type: "facility" | "patient" | "staff";
  /**
   * Set when a staff member is signed in. They act on behalf of their clinic, so `type` is
   * "facility" and `id` is the clinic — every clinic route is scoped correctly — while this
   * keeps who actually did it (attribution, doctor-only checks). Permissions are enforced in
   * src/proxy.ts before the route runs.
   */
  staffId?: string;
  /** The login session behind this request (for logout and audit). */
  sessionId?: string;
}

/**
 * Reads the signed session token from the `x-hekim-auth` header (see src/lib/session-token.ts):
 * the signature must be valid, the login session still open and unexpired, and the account
 * (and, for staff, their clinic) still active — so logout, expiry, suspension and deactivation
 * all end access immediately, even with an already-issued token in hand.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const claims = await readSessionToken(req.headers.get("x-hekim-auth"));
    if (!claims) return null;
    const session = await db.userSession.findUnique({ where: { id: claims.sessionId }, select: { logoutAt: true, facilityId: true, patientId: true, staffId: true } });
    if (!session || session.logoutAt) return null;
    if (claims.expired) {
      await db.userSession.update({ where: { id: claims.sessionId }, data: { logoutAt: new Date(), logoutType: "expired" } }).catch(() => {});
      return null;
    }
    const { type, id } = claims;
    // The session must belong to the account the token names.
    const owner = type === "staff" ? session.staffId : type === "facility" ? (session.staffId ? null : session.facilityId) : session.patientId;
    if (owner !== id) return null;

    if (type === "staff") {
      const s = await db.staff.findUnique({ where: { id }, select: { active: true, facilityId: true, facility: { select: { active: true } } } });
      if (!s || !s.active || !s.facility.active) return null;
      return { type: "facility", id: s.facilityId, staffId: id, sessionId: claims.sessionId };
    }
    const account = type === "facility"
      ? await db.facility.findUnique({ where: { id }, select: { active: true } })
      : await db.patient.findUnique({ where: { id }, select: { active: true } });
    if (!account || !account.active) return null;

    return { type, id, sessionId: claims.sessionId };
  } catch {
    return null;
  }
}

/** Opens a login session and returns its signed token. Call only after the person has been verified. */
export async function startSession(
  type: "facility" | "patient" | "staff",
  id: string,
  meta: { ip?: string | null; browser?: string | null; os?: string | null; device?: string | null; facilityId?: string | null } = {},
): Promise<{ token: string; sessionId: string }> {
  const session = await db.userSession.create({
    data: {
      facilityId: type === "facility" ? id : type === "staff" ? meta.facilityId ?? null : null,
      patientId: type === "patient" ? id : null,
      staffId: type === "staff" ? id : null,
      ip: meta.ip ?? null, browser: meta.browser ?? null, os: meta.os ?? null, device: meta.device ?? null,
    },
  });
  return { token: await makeSessionToken(type, id, session.id), sessionId: session.id };
}

/**
 * Whether this caller may act as the treating doctor — the Facility-owner
 * account itself (today's only active clinical-portal caller; see the
 * Clinical Workflow Phase 1 plan), or a Staff member whose employeeType is
 * "Hakim (Unani Physician)" (kept for forward-compatibility and correct
 * attribution, even though no staff-facing clinical UI calls this yet).
 */
export async function isDoctor(auth: AuthUser): Promise<boolean> {
  const staffId = auth.staffId ?? (auth.type === "staff" ? auth.id : null);
  if (!staffId) return auth.type === "facility";
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { employeeType: true } });
  return staff?.employeeType === "Hakim (Unani Physician)";
}

export async function fetchFacility(id: string) {
  return db.facility.findUnique({
    where: { id },
    select: {
      id: true,
      facilityName: true,
      email: true,
      phone: true,
      specialization: true,
      experience: true,
      rating: true,
      license: true,
      avatarColor: true,
      bio: true,
      verified: true,
      profileCompleted: true,
    },
  });
}

export async function fetchStaff(id: string) {
  return db.staff.findUnique({
    where: { id },
    select: {
      id: true,
      staffCode: true,
      name: true,
      photo: true,
      email: true,
      phone: true,
      employeeType: true,
      specialization: true,
      qualification: true,
      designation: true,
      registrationNumber: true,
      experience: true,
      role: true,
      responsibilities: true,
      facility: { select: { id: true, facilityName: true } },
    },
  });
}

export async function fetchPatient(id: string) {
  return db.patient.findUnique({
    where: { id },
    select: {
      id: true,
      patientCode: true,
      name: true,
      email: true,
      phone: true,
      titlePrefix: true,
      registrationFor: true,
      relationship: true,
      dob: true,
      dobApprox: true,
      gender: true,
      maritalStatus: true,
      bloodGroup: true,
      address: true,
      state: true,
      city: true,
      emergencyContact: true,
      emergencyContactName: true,
      emergencyRelationship: true,
      occupation: true,
      height: true,
      weight: true,
      familyHistory: true,
      medicalHistory: true,
      chronicConditions: true,
      allergies: true,
      currentMedications: true,
      surgicalHistory: true,
      lifestyle: true,
      mizaj: true,
      photo: true,
      avatarColor: true,
    },
  });
}
