import { db } from "@/lib/db";

export async function getSetting(category: string, key: string, fallback: string): Promise<string> {
  const row = await db.portalSetting.findUnique({ where: { category_key: { category, key } } });
  return row?.value ?? fallback;
}
