import { APP_LANGS, type AppString } from "./define";
import { COMMON } from "./common";
import { CLINIC_SHELL } from "./clinic-shell";
import { PATIENT_SHELL } from "./patient-shell";
import { STAFF_PORTAL } from "./staff-portal";
import { SHARED_WIDGETS, LEARNING } from "./shared-widgets";
import { CLINIC_RECEPTION, CLINIC_STAGES } from "./clinic-reception";
import { CLINIC_DASHBOARD, CLINIC_OVERVIEW } from "./clinic-dashboard";
import { CLINIC_PATIENTS } from "./clinic-patients";
import { VALUE_LABELS } from "./values";
import { CLINIC_REPORTS } from "./clinic-reports";
import { CLINIC_PAYMENTS, CLINIC_RECEIPT } from "./clinic-payments";
import { CLINIC_VITALS, VITAL_STATUS } from "./clinic-vitals";
import { CLINIC_COMPLAINTS, CLINIC_INSIGHT, CLINIC_JOURNEY, CLINIC_REDFLAG, CLINIC_REFERRAL_LINE, CLINIC_SIGNATURE, CLINIC_TRIAGE } from "./clinic-stage2";
import { CLINIC_ASBAB, CLINIC_STAGE, CLINIC_STAGE3 } from "./clinic-stage3";
import { CLINIC_DOSSIER, CLINIC_STAGE5 } from "./clinic-stage5";
import { CLINIC_REGISTER, CLINIC_VISIT } from "./clinic-visits";
import { CLINIC_REPORT } from "./clinic-report";
import { PATIENT_PAGES } from "./patient-pages";
import { API_ERRORS } from "./api-errors";
import { ACTIVITY_LOG, CLINIC_SETUP, CLINIC_FEES, CLINIC_PERMISSIONS, CLINIC_PROFILE, CLINIC_TEAM } from "./clinic-settings";
import { CLINIC_APPOINTMENTS, CLINIC_MESSAGES, CLINIC_PHARMACY, CLINIC_PRESCRIPTIONS, CLINIC_RECORD } from "./clinic-pages";

/** Every clinic / staff / patient app text. Add new files here. */
export const APP_STRINGS: AppString[] = [...API_ERRORS, ...LEARNING, ...PATIENT_PAGES, ...CLINIC_REPORT, ...CLINIC_VISIT, ...CLINIC_REGISTER, ...CLINIC_STAGE, ...CLINIC_STAGE3, ...CLINIC_ASBAB, ...CLINIC_STAGE5, ...CLINIC_DOSSIER, ...VITAL_STATUS, ...CLINIC_VITALS, ...CLINIC_JOURNEY, ...CLINIC_SIGNATURE, ...CLINIC_REFERRAL_LINE, ...CLINIC_TRIAGE, ...CLINIC_REDFLAG, ...CLINIC_COMPLAINTS, ...CLINIC_INSIGHT, ...CLINIC_SETUP, ...ACTIVITY_LOG, ...CLINIC_FEES, ...CLINIC_TEAM, ...CLINIC_PERMISSIONS, ...CLINIC_PROFILE, ...CLINIC_RECORD, ...CLINIC_APPOINTMENTS, ...CLINIC_MESSAGES, ...CLINIC_PHARMACY, ...CLINIC_PRESCRIPTIONS, ...CLINIC_PAYMENTS, ...CLINIC_RECEIPT, ...CLINIC_REPORTS, ...VALUE_LABELS, ...CLINIC_PATIENTS, ...CLINIC_DASHBOARD, ...CLINIC_OVERVIEW, ...CLINIC_STAGES, ...CLINIC_RECEPTION, ...SHARED_WIDGETS, ...COMMON, ...CLINIC_SHELL, ...PATIENT_SHELL, ...STAFF_PORTAL];

/** Message namespaces each app needs (the rest of the store — e.g. the public website — isn't sent). */
export const AREA_NAMESPACES = {
  public: ["landing", "site_header", "site_footer", "guidance", "common", "auth"],
  clinic: ["site_header", "guidance", "common", "auth", "clinic"],
  patient: ["site_header", "guidance", "common", "auth", "patient"],
  // Admin is always English; it reuses some clinic screens (vitals, asbab, activity log), so it gets their texts.
  admin: ["guidance", "common", "auth", "clinic"],
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
