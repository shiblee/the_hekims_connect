// Modules that can carry guidance. Registering a module here (and running the seed) is the
// controlled way to add a new one; admins then write its tours / tutorial without code changes.
// `permission` reuses the clinic permission keys — a user who can't open the page never gets its
// guidance. `targets` lists the data-tour markers placed on that page (for the step editor).

import type { PermissionKey } from "@/lib/staff-permissions";

export interface GuidanceModuleDef {
  key: string;
  app: "clinic" | "admin";
  name: string;
  route: string;
  /** Any of these opens it (clinic owner always can). Empty = everyone in the app. */
  permission: PermissionKey[];
  /** Clinic owner only (e.g. profile setup). */
  ownerOnly?: boolean;
  related: string[];
  targets: { id: string; label: string }[];
}

const NAV_ITEMS: [string, string][] = [["dashboard", "Dashboard"], ["reception", "Reception desk"], ["patients", "Patients"], ["payments", "Payments"], ["mizaj", "Mizaj Assessment"], ["pharmacy", "Pharmacy"], ["appointments", "Appointments"], ["messages", "Messages"], ["prescriptions", "Prescriptions"]];
const SHELL: GuidanceModuleDef["targets"] = [
  { id: "shell.nav", label: "Main menu (left)" },
  ...NAV_ITEMS.map(([id, label]) => ({ id: `nav.${id}`, label: `Menu item: ${label}` })),
  { id: "shell.search", label: "Patient search (top bar)" },
  { id: "shell.help", label: "Help button (?)" },
  { id: "shell.account", label: "Account & profile (bottom left)" },
];

const STAGE_COMMON = (...items: [string, string][]): GuidanceModuleDef["targets"] => [
  { id: "stage.tracker", label: "Stage tracker (top)" },
  { id: "stage.patient", label: "Patient card" },
  ...items.map(([id, label]) => ({ id, label })),
  { id: "stage.insight", label: "Hakeem Insight (right)" },
  { id: "stage.note", label: "Resident clinical note (right)" },
  { id: "stage.actions", label: "Save / Refer / Proceed bar (bottom)" },
];
const ADMIN_NAV: [string, string][] = [["dashboard", "Dashboard"], ["facilities", "Facility"], ["patients", "Patient"], ["humor", "Humoral Matrix"], ["payments", "Payments"], ["staff", "Staff"], ["meta", "Meta"], ["settings", "Settings"], ["notifications", "Notifications"], ["languages", "Languages"], ["guidance", "Guidance"]];
const ADMIN_SHELL: GuidanceModuleDef["targets"] = [
  { id: "admin.nav", label: "Admin menu" },
  ...ADMIN_NAV.map(([id, label]) => ({ id: `admin.nav.${id}`, label: `Menu item: ${label}` })),
  { id: "shell.help", label: "Help button (?)" },
  { id: "admin.account", label: "Your account menu" },
];
const T = (...items: [string, string][]) => [...items.map(([id, label]) => ({ id, label })), ...SHELL];

export const GUIDANCE_MODULES: GuidanceModuleDef[] = [
  // Clinic app
  { key: "clinic.profile-setup", app: "clinic", name: "Profile setup", route: "/facility/profile-setup", permission: [], ownerOnly: true, related: ["clinic.fees", "clinic.staff", "clinic.permissions"], targets: [{ id: "setup.steps", label: "Setup steps (top)" }, { id: "setup.continue", label: "Continue button" }] },
  { key: "clinic.dashboard", app: "clinic", name: "Dashboard", route: "/facility/dashboard", permission: ["dashboard"], related: ["clinic.reception", "clinic.patient-register", "clinic.payments"], targets: T(["dashboard.actions", "Quick actions"], ["dashboard.today", "Today's figures"]) },
  { key: "clinic.reception", app: "clinic", name: "Reception desk", route: "/facility/reception", permission: ["patients.view"], related: ["clinic.patient-register", "clinic.payments"], targets: T(["reception.register", "Register new patient button"], ["reception.week", "Seven-day strip"], ["reception.tabs", "Visits / New registrations tabs"], ["reception.search", "Search box"], ["reception.list", "Patient list"]) },
  { key: "clinic.patients", app: "clinic", name: "Patients", route: "/facility/patients", permission: ["patients.view"], related: ["clinic.patient-register", "clinic.reception"], targets: [...SHELL] },
  { key: "clinic.patient-register", app: "clinic", name: "Register a patient", route: "/facility/patients/register", permission: ["patients.register"], related: ["clinic.reception", "clinic.payments"], targets: [{ id: "register.search", label: "Find existing patient (search first)" }, { id: "register.payment", label: "Payment section (optional)" }] },
  { key: "clinic.payments", app: "clinic", name: "Payments & receipts", route: "/facility/payments", permission: ["payments", "finance.view"], related: ["clinic.fees", "clinic.reception"], targets: T(["payments.totals", "Collection totals"], ["payments.search", "Search box"], ["payments.list", "Payments list (receipts, refunds)"]) },
  { key: "clinic.appointments", app: "clinic", name: "Appointments", route: "/facility/appointments", permission: ["appointments"], related: ["clinic.patients"], targets: [...SHELL] },
  { key: "clinic.messages", app: "clinic", name: "Messages", route: "/facility/messages", permission: ["messages"], related: [], targets: [...SHELL] },
  { key: "clinic.pharmacy", app: "clinic", name: "Pharmacy", route: "/facility/pharmacy", permission: ["pharmacy"], related: ["clinic.prescriptions"], targets: [...SHELL] },
  { key: "clinic.prescriptions", app: "clinic", name: "Prescriptions", route: "/facility/prescriptions", permission: ["prescribe", "patients.view"], related: ["clinic.pharmacy"], targets: [...SHELL] },
  { key: "clinic.record", app: "clinic", name: "Stage 2 — Vitals & triage", route: "/facility/patients/[id]/record", permission: ["patients.view"], related: ["clinic.mizaj", "clinic.patient-register"], targets: STAGE_COMMON(["record.vitals", "Vitals"], ["stage.complaints", "Main complaints"], ["record.redflags", "Emergency warning signs"], ["record.symptoms", "Other symptoms"]) },
  { key: "clinic.mizaj", app: "clinic", name: "Stage 3 — Mizaj & morphometry", route: "/facility/mizaj", permission: ["mizaj"], related: ["clinic.record", "clinic.asbab"], targets: STAGE_COMMON(["mizaj.regions", "Body regions"], ["stage.complaints", "Main complaints (detail)"], ["mizaj.chronology", "Onset & chronology"]) },
  { key: "clinic.asbab", app: "clinic", name: "Stage 4 — Asbab-e-Sitta", route: "/facility/asbab", permission: ["asbab"], related: ["clinic.mizaj", "clinic.tashkhees"], targets: STAGE_COMMON(["asbab.pillars", "Six essential factors"], ["asbab.drift", "Lifestyle drift (right)"]) },
  { key: "clinic.tashkhees", app: "clinic", name: "Stage 5 — Tashkhees & handover", route: "/facility/tashkhees", permission: ["diagnosis"], related: ["clinic.asbab", "clinic.prescriptions"], targets: STAGE_COMMON(["dossier.dalail", "Dala'il — clinical signs"], ["dossier.diagnosis", "Tashkhees — diagnosis"], ["dossier.usool", "Usool-e-Ilaj — principles"], ["dossier.cds", "Decision support — medicines"], ["dossier.ghiza", "Ilaj-bil-Ghiza — diet"], ["dossier.dawa", "Ilaj-bil-Dawa — medicines"], ["dossier.tadbeer", "Ilaj-bil-Tadbeer — regimens"], ["dossier.handover", "Prognosis & handover"]) },
  { key: "clinic.profile", app: "clinic", name: "Facility profile", route: "/facility/profile/overview", permission: ["settings"], related: ["clinic.fees", "clinic.staff"], targets: [...SHELL] },
  { key: "clinic.fees", app: "clinic", name: "Fees", route: "/facility/profile/fees", permission: ["settings"], related: ["clinic.payments", "clinic.staff"], targets: T(["fees.add", "Add fee button"], ["fees.list", "Fee list"]) },
  { key: "clinic.staff", app: "clinic", name: "Staff", route: "/facility/profile/staff", permission: ["staff.manage"], related: ["clinic.permissions", "clinic.reception"], targets: T(["staff.add", "Add Staff button"], ["staff.search", "Search box"], ["staff.list", "Staff list"]) },
  { key: "clinic.permissions", app: "clinic", name: "Permissions", route: "/facility/profile/permissions", permission: ["staff.manage"], related: ["clinic.staff", "clinic.activity", "clinic.reception"], targets: T(["permissions.roles", "Role permissions grid"], ["permissions.save", "Save permissions button"], ["permissions.people", "Per-person changes"]) },
  { key: "clinic.activity", app: "clinic", name: "Activity log", route: "/facility/profile/activity", permission: [], related: [], targets: [...SHELL] },
  { key: "clinic.learning", app: "clinic", name: "Learning & tutorials", route: "/facility/profile/learning", permission: [], related: [], targets: [...SHELL] },
  // Admin panel
  { key: "admin.dashboard", app: "admin", name: "Admin dashboard", route: "/admin", permission: [], related: ["admin.facilities", "admin.guidance"], targets: ADMIN_SHELL },
  { key: "admin.facilities", app: "admin", name: "Facilities", route: "/admin/facilities", permission: [], related: ["admin.staff", "admin.payments"], targets: [{ id: "facilities.kpis", label: "Headline figures" }, { id: "facilities.insights", label: "Insights & engagement health" }, { id: "facilities.filters", label: "Search & filters" }, { id: "facilities.table", label: "Facilities table" }, ...ADMIN_SHELL] },
  { key: "admin.patients", app: "admin", name: "Patients", route: "/admin/patients", permission: [], related: [], targets: ADMIN_SHELL },
  { key: "admin.staff", app: "admin", name: "Staff", route: "/admin/staff", permission: [], related: ["admin.facilities"], targets: ADMIN_SHELL },
  { key: "admin.payments", app: "admin", name: "Payments", route: "/admin/payments", permission: [], related: ["admin.facilities"], targets: ADMIN_SHELL },
  { key: "admin.meta", app: "admin", name: "Meta lists", route: "/admin/meta", permission: [], related: [], targets: ADMIN_SHELL },
  { key: "admin.settings", app: "admin", name: "Settings", route: "/admin/settings", permission: [], related: ["admin.guidance"], targets: ADMIN_SHELL },
  { key: "admin.notifications", app: "admin", name: "Notifications", route: "/admin/notifications", permission: [], related: [], targets: ADMIN_SHELL },
  { key: "admin.languages", app: "admin", name: "Languages", route: "/admin/languages", permission: [], related: ["admin.guidance"], targets: ADMIN_SHELL },
  { key: "admin.guidance", app: "admin", name: "User guidance", route: "/admin/guidance", permission: [], related: ["admin.languages"], targets: [{ id: "guidance.settings", label: "Guidance settings" }, { id: "guidance.modules", label: "Modules, tours and tutorials" }, ...ADMIN_SHELL] },
];

export const moduleDef = (key: string) => GUIDANCE_MODULES.find((m) => m.key === key);

/** Mirrors the code registry into the database (adds new modules, refreshes names/routes; never touches content). */
export async function syncGuidanceModules(db: import("@prisma/client").PrismaClient) {
  for (const [i, m] of GUIDANCE_MODULES.entries()) {
    await db.guidanceModule.upsert({
      where: { key: m.key },
      create: { key: m.key, app: m.app, name: m.name, route: m.route, sortOrder: i },
      update: { app: m.app, name: m.name, route: m.route, sortOrder: i },
    });
  }
}
