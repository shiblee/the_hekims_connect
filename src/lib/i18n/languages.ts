import { db } from "@/lib/db";

export const DEFAULT_LOCALE = "en";

export async function getEnabledLanguages() {
  return db.language.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
}
