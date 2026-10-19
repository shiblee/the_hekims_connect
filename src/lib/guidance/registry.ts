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
const T = (...items: [string, string][]) => [...items.map(([id, label]) => ({ id, label })), ...SHELL];

export const GUIDANCE_MODULES: GuidanceModuleDef[] = [
  // Clinic app
  { key: "clinic.profile-setup", app: "clinic", name: "Profile setup", route: "/facility/profile-setup", permission: [], ownerOnly: true, related: ["clinic.fees", "clinic.staff"], targets: [{ id: "setup.steps", label: "Setup steps (top)" }, { id: "setup.continue", label: "Continue button" }] },
  { key: "clinic.dashboard", app: "clinic", name: "Dashboard", route: "/facility/dashboard", permission: ["dashboard"], related: ["clinic.reception", "clinic.patients"], targets: T(["dashboard.actions", "Quick actions"], ["dashboard.today", "Today's figures"]) },
  { key: "clinic.reception", app: "clinic", name: "Reception desk", route: "/facility/reception", permission: ["patients.view"], related: ["clinic.patient-register", "clinic.payments"], targets: T(["reception.register", "Register new patient button"], ["reception.week", "Seven-day strip"], ["reception.tabs", "Visits / New registrations tabs"], ["reception.search", "Search box"], ["reception.list", "Patient list"]) },
  { key: "clinic.patients", app: "clinic", name: "Patients", route: "/facility/patients", permission: ["patients.view"], related: ["clinic.patient-register", "clinic.reception"], targets: [...SHELL] },
  { key: "clinic.patient-register", app: "clinic", name: "Register a patient", route: "/facility/patients/register", permission: ["patients.register"], related: ["clinic.patients", "clinic.payments"], targets: [] },
  { key: "clinic.payments", app: "clinic", name: "Payments & receipts", route: "/facility/payments", permission: ["payments", "finance.view"], related: ["clinic.fees", "clinic.reception"], targets: T(["payments.totals", "Collection totals"], ["payments.search", "Search box"], ["payments.list", "Payments list (receipts, refunds)"]) },
  { key: "clinic.appointments", app: "clinic", name: "Appointments", route: "/facility/appointments", permission: ["appointments"], related: ["clinic.patients"], targets: [...SHELL] },
  { key: "clinic.messages", app: "clinic", name: "Messages", route: "/facility/messages", permission: ["messages"], related: [], targets: [...SHELL] },
  { key: "clinic.pharmacy", app: "clinic", name: "Pharmacy", route: "/facility/pharmacy", permission: ["pharmacy"], related: ["clinic.prescriptions"], targets: [...SHELL] },
  { key: "clinic.prescriptions", app: "clinic", name: "Prescriptions", route: "/facility/prescriptions", permission: ["prescribe", "patients.view"], related: ["clinic.pharmacy"], targets: [...SHELL] },
  { key: "clinic.mizaj", app: "clinic", name: "Mizaj assessment", route: "/facility/mizaj", permission: ["mizaj"], related: ["clinic.patients"], targets: [...SHELL] },
  { key: "clinic.profile", app: "clinic", name: "Facility profile", route: "/facility/profile/overview", permission: ["settings"], related: ["clinic.fees", "clinic.staff"], targets: [...SHELL] },
  { key: "clinic.fees", app: "clinic", name: "Fees", route: "/facility/profile/fees", permission: ["settings"], related: ["clinic.payments", "clinic.staff"], targets: T(["fees.add", "Add fee button"], ["fees.list", "Fee list"]) },
  { key: "clinic.staff", app: "clinic", name: "Staff", route: "/facility/profile/staff", permission: ["staff.manage"], related: ["clinic.permissions"], targets: T(["staff.add", "Add Staff button"], ["staff.search", "Search box"], ["staff.list", "Staff list"]) },
  { key: "clinic.permissions", app: "clinic", name: "Permissions", route: "/facility/profile/permissions", permission: ["staff.manage"], related: ["clinic.staff", "clinic.activity"], targets: T(["permissions.roles", "Role permissions grid"], ["permissions.save", "Save permissions button"], ["permissions.people", "Per-person changes"]) },
  { key: "clinic.activity", app: "clinic", name: "Activity log", route: "/facility/profile/activity", permission: [], related: [], targets: [...SHELL] },
  { key: "clinic.learning", app: "clinic", name: "Learning & tutorials", route: "/facility/profile/learning", permission: [], related: [], targets: [...SHELL] },
  // Admin panel
  { key: "admin.dashboard", app: "admin", name: "Admin dashboard", route: "/admin", permission: [], related: ["admin.facilities"], targets: [] },
  { key: "admin.facilities", app: "admin", name: "Facilities", route: "/admin/facilities", permission: [], related: ["admin.staff", "admin.payments"], targets: [] },
  { key: "admin.patients", app: "admin", name: "Patients", route: "/admin/patients", permission: [], related: [], targets: [] },
  { key: "admin.staff", app: "admin", name: "Staff", route: "/admin/staff", permission: [], related: ["admin.facilities"], targets: [] },
  { key: "admin.payments", app: "admin", name: "Payments", route: "/admin/payments", permission: [], related: ["admin.facilities"], targets: [] },
  { key: "admin.meta", app: "admin", name: "Meta lists", route: "/admin/meta", permission: [], related: [], targets: [] },
  { key: "admin.settings", app: "admin", name: "Settings", route: "/admin/settings", permission: [], related: ["admin.guidance"], targets: [] },
  { key: "admin.notifications", app: "admin", name: "Notifications", route: "/admin/notifications", permission: [], related: [], targets: [] },
  { key: "admin.languages", app: "admin", name: "Languages", route: "/admin/languages", permission: [], related: ["admin.guidance"], targets: [] },
  { key: "admin.guidance", app: "admin", name: "User guidance", route: "/admin/guidance", permission: [], related: ["admin.languages"], targets: [] },
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
