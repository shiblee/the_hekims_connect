// Who may share a sign-in email / mobile.
//
// • Clinic group — facilities and staff share one clinic login page that finds the account
//   by email or mobile, so an email or mobile can belong to only ONE facility or staff member
//   (otherwise the staff member could never sign in, or the wrong person would).
// • Patients are a separate group with their own rules (email unique; a mobile may be shared
//   by family members registered at a clinic).
// • Across the groups sharing is allowed: a clinic owner or staff member can also be a patient
//   with the same email or mobile.

import { db } from "@/lib/db";
import { normalizeContact } from "@/lib/auth";

export interface ClinicContactClash { kind: "facility" | "staff"; field: "email" | "phone"; name: string }

/**
 * Returns the facility or staff member already using this contact in the clinic sign-in group,
 * or null if it's free. Pass the record being edited in `exclude` so it doesn't clash with itself.
 */
export async function findClinicContactClash(contact: string, exclude: { facilityId?: string; staffId?: string } = {}): Promise<ClinicContactClash | null> {
  const { value, isEmail } = normalizeContact(contact);
  if (!value) return null;
  const field = isEmail ? "email" : "phone";
  const where = isEmail ? { email: value } : { phone: value };

  const facility = await db.facility.findFirst({ where: { ...where, ...(exclude.facilityId ? { id: { not: exclude.facilityId } } : {}) }, select: { facilityName: true } });
  if (facility) return { kind: "facility", field, name: facility.facilityName };
  const staff = await db.staff.findFirst({ where: { ...where, ...(exclude.staffId ? { id: { not: exclude.staffId } } : {}) }, select: { name: true } });
  if (staff) return { kind: "staff", field, name: staff.name };
  return null;
}

/** A user-facing message for a clash (never reveals which clinic or person, only the kind of account). */
export function clinicClashMessage(c: ClinicContactClash): string {
  const what = c.field === "email" ? "email" : "mobile number";
  return c.kind === "facility"
    ? `This ${what} is already used by a clinic account. Each clinic and staff member needs their own ${what} to sign in.`
    : `This ${what} is already used by a staff member. Each clinic and staff member needs their own ${what} to sign in.`;
}
