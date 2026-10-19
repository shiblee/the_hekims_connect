import type { PrismaClient } from "@prisma/client";
import { APP_LANGS } from "./define";
import { APP_STRINGS } from "./index";

/**
 * Copies the app texts into the translation store, all published. English always follows the code.
 * Other languages: created when missing, and refreshed only while untouched (source "seed") —
 * anything an admin has edited in Admin → Languages is never overwritten.
 */
export async function seedAppStrings(db: PrismaClient) {
  let created = 0, updated = 0;
  for (const s of APP_STRINGS) {
    const key = await db.translationKey.upsert({
      where: { key: s.key },
      update: { group: s.group, sourceText: s.en },
      create: { key: s.key, group: s.group, sourceText: s.en },
    });
    const values = await db.translationValue.findMany({ where: { keyId: key.id }, select: { languageCode: true, text: true, source: true, status: true } });
    const byLang = new Map(values.map((v) => [v.languageCode, v]));
    for (const lang of ["en", ...APP_LANGS] as const) {
      const text = lang === "en" ? s.en : s.tr[lang];
      const v = byLang.get(lang);
      if (!v) {
        await db.translationValue.create({ data: { keyId: key.id, languageCode: lang, text, status: "published", source: lang === "en" ? "manual" : "seed" } });
        created++;
      } else if ((lang === "en" || v.source === "seed") && (v.text !== text || v.status !== "published")) {
        await db.translationValue.update({ where: { keyId_languageCode: { keyId: key.id, languageCode: lang } }, data: { text, status: "published" } });
        updated++;
      }
    }
  }
  return { keys: APP_STRINGS.length, created, updated };
}
