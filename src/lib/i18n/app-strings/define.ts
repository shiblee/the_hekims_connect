// App text (clinic, staff and patient apps) in all five languages, side by side.
// Seeded into the translation store (Admin → Languages), where admins can change any of it.
export const APP_LANGS = ["hi", "ur", "ar", "fa"] as const;
export type AppLang = (typeof APP_LANGS)[number];

/** [English, Hindi, Urdu, Arabic, Farsi]. Placeholders like {name} must appear in every language. */
export type Tr = readonly [en: string, hi: string, ur: string, ar: string, fa: string];

export interface AppString { key: string; group: string; en: string; tr: Record<AppLang, string> }

/** `defineStrings("clinic.reception", { title: [...] })` → keys "clinic.reception.title", group "clinic.reception". */
export function defineStrings(ns: string, entries: Record<string, Tr>): AppString[] {
  return Object.entries(entries).map(([k, [en, hi, ur, ar, fa]]) => ({ key: `${ns}.${k}`, group: ns, en, tr: { hi, ur, ar, fa } }));
}
