import { db } from "@/lib/db";

/** Derives a unique, URL/code-safe key from a chief complaint label, appending
 * a numeric suffix on collision. Shared by the admin "Add Complaint" route and
 * the discovery bot's suggestion-approval route so both create rows the same way. */
export async function deriveChiefComplaintKey(label: string): Promise<string | null> {
  const baseKey = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseKey) return null;

  let key = baseKey;
  let suffix = 2;
  while (await db.chiefComplaint.findUnique({ where: { key } })) {
    key = `${baseKey}_${suffix}`;
    suffix++;
  }
  return key;
}
