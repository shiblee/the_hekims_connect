import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export interface AuthUser {
  id: string;
  type: "facility" | "patient" | "staff";
}

/**
 * Reads the simple session token from the `x-hekim-auth` header.
 * Token format: base64(`${type}|${userId}`).
 *
 * Also re-checks the account's `active` flag on every call, so a facility,
 * patient or staff member suspended/deactivated loses API access immediately —
 * not just on their next login — even with an already-issued token in hand.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const raw = req.headers.get("x-hekim-auth");
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf-8");
    const [type, id] = decoded.split("|");
    if (type !== "facility" && type !== "patient" && type !== "staff") return null;
    if (!id) return null;

    const account = type === "facility"
      ? await db.facility.findUnique({ where: { id }, select: { active: true } })
      : type === "patient"
      ? await db.patient.findUnique({ where: { id }, select: { active: true } })
      : await db.staff.findUnique({ where: { id }, select: { active: true } });
    if (!account || !account.active) return null;

    return { type, id };
  } catch {
    return null;
  }
}

export function makeToken(type: "facility" | "patient" | "staff", id: string): string {
  return Buffer.from(`${type}|${id}`, "utf-8").toString("base64");
}

/**
 * Whether this caller may act as the treating doctor — the Facility-owner
 * account itself (today's only active clinical-portal caller; see the
 * Clinical Workflow Phase 1 plan), or a Staff member whose employeeType is
 * "Hakim (Unani Physician)" (kept for forward-compatibility and correct
 * attribution, even though no staff-facing clinical UI calls this yet).
 */
export async function isDoctor(auth: AuthUser): Promise<boolean> {
  if (auth.type === "facility") return true;
  if (auth.type !== "staff") return false;
  const staff = await db.staff.findUnique({ where: { id: auth.id }, select: { employeeType: true } });
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
