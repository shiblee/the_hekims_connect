/**
 * Person/clinic names are shown with a capital letter at the start of every
 * word ("mohammad shiblee" → "Mohammad Shiblee", "staff32" → "Staff32").
 * Only the first letter of each word is raised — the rest is kept as typed,
 * so "McDonald", "MD" or "al-Hakim" are not damaged. Scripts without case
 * (Urdu, Arabic, Hindi, Persian) pass through unchanged.
 */
// Joining words and name particles stay as typed unless they start the name
// ("Care and Cure Clinic", "Zia-ul-Haq", "Shifa-e-Hayat", "Ahmad bin Ali").
const SMALL_WORDS = new Set([
  "and", "or", "of", "the", "for", "in", "at", "on", "by", "to", "with", "a", "an",
  "bin", "bint", "ibn", "ul", "ud", "ur", "un", "us", "al", "el", "e", "o", "de", "da", "van", "von",
]);

export function toNameCase(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  const words = [...clean.matchAll(/[^\s\-.(]+/gu)];
  let out = "";
  let last = 0;
  words.forEach((m, i) => {
    const word = m[0];
    const start = m.index ?? 0;
    out += clean.slice(last, start);
    // A joining word stays as typed only in the middle of a name; first and last words are always capitalised.
    const keep = i > 0 && i < words.length - 1 && SMALL_WORDS.has(word.toLowerCase());
    out += keep ? word : word.replace(/^\p{Ll}/u, (ch) => ch.toLocaleUpperCase());
    last = start + word.length;
  });
  return out + clean.slice(last);
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
