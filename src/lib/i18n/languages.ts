import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const DEFAULT_LOCALE = "en";

export async function getEnabledLanguages() {
  return db.language.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
}

/** The visitor's resolved locale: their NEXT_LOCALE cookie if it's an enabled language, else the default. */
export async function getCurrentLocale(): Promise<string> {
  const cookieStore = await cookies();
  const requested = cookieStore.get("NEXT_LOCALE")?.value;
  const enabled = await getEnabledLanguages();
  const fallback = enabled.find((l) => l.isDefault)?.code ?? DEFAULT_LOCALE;
  return requested && enabled.some((l) => l.code === requested) ? requested : fallback;
}
