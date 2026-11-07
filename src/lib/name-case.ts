/**
 * Person/clinic names are shown with a capital letter at the start of every
 * word ("mohammad shiblee" → "Mohammad Shiblee", "staff32" → "Staff32").
 * Only the first letter of each word is raised — the rest is kept as typed,
 * so "McDonald", "MD" or "al-Hakim" are not damaged. Scripts without case
 * (Urdu, Arabic, Hindi, Persian) pass through unchanged.
 */
export function toNameCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(^|[\s\-.(])(\p{Ll})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

/** The name fields, per model, that are always stored in name case. */
export const NAME_FIELDS: Record<string, readonly string[]> = {
  patient: ["name", "emergencyContactName"],
  staff: ["name"],
  admin: ["name"],
  facility: ["facilityName", "registeredFacilityName"],
};

/** Name-case the listed fields of a Prisma `data` object, in place. Handles `{ set: "..." }` too. */
export function nameCaseData(data: unknown, fields: readonly string[]): void {
  if (!data || typeof data !== "object") return;
  const rec = data as Record<string, unknown>;
  for (const f of fields) {
    const v = rec[f];
    if (typeof v === "string") rec[f] = toNameCase(v);
    else if (v && typeof v === "object" && typeof (v as { set?: unknown }).set === "string") {
      (v as { set: string }).set = toNameCase((v as { set: string }).set);
    }
  }
}
