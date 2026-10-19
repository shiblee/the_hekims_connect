import { APP_LANGS, type AppString } from "./define";
import { COMMON } from "./common";
import { CLINIC_SHELL } from "./clinic-shell";
import { PATIENT_SHELL } from "./patient-shell";
import { STAFF_PORTAL } from "./staff-portal";
import { SHARED_WIDGETS } from "./shared-widgets";
import { CLINIC_RECEPTION, CLINIC_STAGES } from "./clinic-reception";
import { CLINIC_DASHBOARD, CLINIC_OVERVIEW } from "./clinic-dashboard";
import { CLINIC_PATIENTS } from "./clinic-patients";
import { VALUE_LABELS } from "./values";
import { CLINIC_REPORTS } from "./clinic-reports";

/** Every clinic / staff / patient app text. Add new files here. */
export const APP_STRINGS: AppString[] = [...CLINIC_REPORTS, ...VALUE_LABELS, ...CLINIC_PATIENTS, ...CLINIC_DASHBOARD, ...CLINIC_OVERVIEW, ...CLINIC_STAGES, ...CLINIC_RECEPTION, ...SHARED_WIDGETS, ...COMMON, ...CLINIC_SHELL, ...PATIENT_SHELL, ...STAFF_PORTAL];

/** Message namespaces each app needs (the rest of the store — e.g. the public website — isn't sent). */
export const AREA_NAMESPACES = {
  public: ["landing", "site_header", "site_footer", "guidance", "common", "auth"],
  clinic: ["site_header", "guidance", "common", "auth", "clinic"],
  patient: ["site_header", "guidance", "common", "auth", "patient"],
} as const;

/** The code's own copy of a language's app texts — used for any key not (yet) in the translation store. */
export function appStringFallbacks(locale: string): { key: string; text: string }[] {
  const lang = (APP_LANGS as readonly string[]).includes(locale) ? (locale as (typeof APP_LANGS)[number]) : null;
  return APP_STRINGS.map((s) => ({ key: s.key, text: lang ? s.tr[lang] : s.en }));
}

/** Keeps only the given top-level namespaces of a nested message bundle. */
export function pickNamespaces(messages: Record<string, unknown>, namespaces: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(namespaces.filter((n) => n in messages).map((n) => [n, messages[n]]));
}
