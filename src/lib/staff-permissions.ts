// Staff permissions for the clinic app: the catalogue, each role's defaults, and which
// permission an API request needs. Pure — used by the server (proxy, APIs) and the browser
// (navigation, Permissions screen). The facility owner always has everything.

export const PERMISSIONS = [
  { key: "dashboard", group: "General", label: "Dashboard", hint: "Clinic statistics and today's overview" },
  { key: "patients.view", group: "Patients", label: "View patients", hint: "Patient list, records and visit history" },
  { key: "patients.register", group: "Patients", label: "Register & edit patients", hint: "New registrations, edit details, start visits" },
  { key: "triage", group: "Assessment", label: "Stage 2 — Vitals & Triage", hint: "Vitals, main complaints, emergency screening" },
  { key: "mizaj", group: "Assessment", label: "Stage 3 — Temperament", hint: "Mizaj, body regions, onset & chronology" },
  { key: "asbab", group: "Assessment", label: "Stage 4 — Lifestyle Factors", hint: "Asbab-e-Sitta Zarooriya" },
  { key: "diagnosis", group: "Assessment", label: "Stage 5 — Diagnosis & Plan", hint: "Dala'il, Tashkhees, Usool-e-Ilaj, Ghiza" },
  { key: "prescribe", group: "Assessment", label: "Prescribe medicines", hint: "Ilaj-bil-Dawa and medicine decision support" },
  { key: "refer", group: "Assessment", label: "Refer patients", hint: "Refer out to another doctor or hospital" },
  { key: "reports", group: "Assessment", label: "Reports", hint: "Print assessment reports, add lab / imaging reports" },
  { key: "appointments", group: "Clinic", label: "Appointments", hint: "Book and manage appointments" },
  { key: "messages", group: "Clinic", label: "Messages", hint: "Patient conversations" },
  { key: "pharmacy", group: "Clinic", label: "Pharmacy", hint: "Pharmacy and dispensing" },
  { key: "payments", group: "Clinic", label: "Collect payments", hint: "Record payments, print receipts, see own collections" },
  { key: "finance.view", group: "Clinic", label: "Clinic finances", hint: "All collections, totals and reports for the clinic" },
  { key: "payments.refund", group: "Clinic", label: "Cancel / refund payments", hint: "With a reason — payments are never deleted" },
  { key: "staff.manage", group: "Administration", label: "Manage staff & permissions", hint: "Add or edit staff and their permissions" },
  { key: "settings", group: "Administration", label: "Facility profile & settings", hint: "Clinic details, location, schedule, services" },
  { key: "activity", group: "Administration", label: "Clinic activity log", hint: "Everyone's sign-ins and actions (without it, staff see only their own)" },
] as const;
export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) => p.key);
const isKey = (k: unknown): k is PermissionKey => typeof k === "string" && (ALL_PERMISSIONS as string[]).includes(k);

/** Built-in starting point for each role (Admin → Meta → Staff Role); the clinic can change them. */
export const ROLE_DEFAULTS: Record<string, PermissionKey[]> = {
  Hakim: ["dashboard", "patients.view", "patients.register", "triage", "mizaj", "asbab", "diagnosis", "prescribe", "refer", "reports", "appointments", "messages"],
  "Staff Nurse": ["dashboard", "patients.view", "patients.register", "triage", "mizaj", "appointments"],
  Counsellor: ["patients.view", "asbab", "appointments", "messages"],
  Administrator: ["dashboard", "patients.view", "patients.register", "reports", "appointments", "messages", "payments", "finance.view", "payments.refund", "staff.manage", "settings", "activity"],
  "Support Staff": ["patients.view", "patients.register", "appointments", "payments"],
  "Clinic Manager": ["dashboard", "patients.view", "patients.register", "reports", "appointments", "messages", "pharmacy", "payments", "finance.view", "payments.refund", "staff.manage", "settings", "activity"],
  "Junior Hakim / Intern": ["dashboard", "patients.view", "patients.register", "triage", "mizaj", "asbab", "diagnosis", "reports", "appointments"],
  Receptionist: ["dashboard", "patients.view", "patients.register", "appointments", "messages", "payments"],
  "Cashier / Accounts": ["patients.view", "payments", "finance.view", "payments.refund"],
  Pharmacist: ["patients.view", "pharmacy", "payments"],
  "Lab Technician": ["patients.view", "reports"],
  "Regimenal Therapist": ["patients.view", "triage", "appointments"],
  Dietitian: ["patients.view", "asbab", "appointments", "messages"],
  Physiotherapist: ["patients.view", "triage", "appointments"],
  "Data Entry Operator": ["patients.view", "patients.register", "reports"],
  Other: ["patients.view"],
};
export const roleKey = (role: string | null | undefined) => (role && role.trim() ? role.trim() : "Other");
export const defaultsFor = (role: string) => ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.Other;

export function parseKeys(raw: string | null | undefined): PermissionKey[] {
  try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v.filter(isKey) : []; } catch { return []; }
}

/** Role permissions, plus this person's extra grants, minus their removals. */
export function effectivePermissions(rolePerms: PermissionKey[], grants: PermissionKey[], revokes: PermissionKey[]): PermissionKey[] {
  const set = new Set<PermissionKey>([...rolePerms, ...grants]);
  for (const r of revokes) set.delete(r);
  return ALL_PERMISSIONS.filter((k) => set.has(k));
}

type Need = "allow" | "deny" | PermissionKey[]; // any one of the listed keys is enough
const R = (re: string) => new RegExp(`^${re}/?$`);
const READ_LISTS = R("/api/facility/(acute-symptoms|allergies|anatomical-regions|asbab/config|humor/config|medications|metadata|onset-patterns|red-flags|screening/config|tashkhees/options|vitals/validation-config)");
const V = "/api/facility/visits/[^/]+";
const TRIAGE = R(`${V}/(vitals|screening|complaint-assessments|red-flag-screening|acute-symptoms|humoral-assessment|clinical-routing-insight|humoral-clues-insight)`);
const MIZAJ = R(`${V}/(anatomical-regions|chronology)`);
const DIAG = R(`${V}/(dalail-selection|dossier|tashkhees-engine|usool-engine|ghiza-engine|clinical-assessment|treatment-plan|clinical-summary|case-context|differentials|reasoning)`);

/** What a staff member needs for this API request. Reads of a visit need "View patients"; changes need the stage's permission. */
export function requiredPermission(path: string, method: string): Need {
  const read = method === "GET" || method === "HEAD";
  const rw = (r: PermissionKey[], w: PermissionKey[]): Need => (read ? r : w);
  if (path.startsWith("/api/auth/")) return "allow";
  if (read && READ_LISTS.test(path)) return "allow";
  if (R("/api/facility/me").test(path)) return read ? "allow" : ["settings"];
  if (/^\/api\/facility\/profile(\/|$)/.test(path)) return read ? "allow" : ["settings"];
  if (R("/api/facility/staff-permissions").test(path)) return ["staff.manage"];
  if (R("/api/facility/activity").test(path)) return read ? "allow" : "deny"; // the route scopes it: own history unless "activity"
  if (/^\/api\/facility\/staff(\/|$)/.test(path)) return read ? "allow" : ["staff.manage"];
  if (R("/api/facility/stats").test(path)) return ["dashboard"];
  if (R("/api/facility/reception").test(path)) return ["dashboard", "patients.view"];
  if (R("/api/facility/payments").test(path)) return ["payments", "finance.view"]; // the route scopes reads; POST re-checks "payments"
  if (R("/api/facility/payments/[^/]+").test(path)) return read ? ["payments", "finance.view"] : ["payments.refund"];
  if (R("/api/facility/finance").test(path)) return ["finance.view"];
  if (R("/api/facility/fees").test(path)) return read ? ["payments", "finance.view", "settings"] : ["settings"];
  if (R("/api/facility/patients/search").test(path)) return ["patients.view"];
  if (R("/api/facility/patients/[^/]+/vitals-insight").test(path)) return ["triage"];
  if (/^\/api\/facility\/(patients\/[^/]+\/reports|reports)(\/|$)/.test(path)) return rw(["patients.view"], ["reports"]);
  if (/^\/api\/facility\/patients(\/|$)/.test(path)) return rw(["patients.view"], ["patients.register"]);
  if (R("/api/facility/visits").test(path)) return rw(["patients.view"], ["patients.register", "triage"]);
  if (R(V).test(path) || R(`${V}/registration`).test(path)) return rw(["patients.view"], ["patients.register"]);
  // Reason for visit is taken at registration by reception, and corrected later at triage.
  if (R(`${V}/intake`).test(path)) return rw(["patients.view"], ["patients.register", "triage"]);
  if (TRIAGE.test(path)) return rw(["patients.view"], ["triage"]);
  if (R(`${V}/resident-notes`).test(path)) return rw(["patients.view"], ["triage", "mizaj", "asbab", "diagnosis"]);
  if (MIZAJ.test(path) || /^\/api\/mizaj(\/|$)/.test(path)) return rw(["patients.view"], ["mizaj"]);
  if (R(`${V}/asbab`).test(path)) return rw(["patients.view"], ["asbab"]);
  if (DIAG.test(path)) return rw(["patients.view"], ["diagnosis"]);
  if (R(`${V}/cds`).test(path)) return ["prescribe"];
  // Read-only safety check: whoever can write medicine lines in the dossier must be able to check them.
  if (R("/api/facility/tashkhees/prescription-check").test(path)) return ["prescribe", "diagnosis"];
  if (/^\/api\/prescriptions(\/|$)/.test(path)) return rw(["patients.view"], ["prescribe"]);
  if (R(`${V}/referral`).test(path)) return rw(["patients.view"], ["refer"]);
  if (R(`${V}/report`).test(path)) return ["reports"];
  if (/^\/api\/appointments(\/|$)/.test(path)) return ["appointments"];
  if (/^\/api\/messages(\/|$)/.test(path)) return ["messages"];
  if (/^\/api\/pharmacy(\/|$)/.test(path)) return ["pharmacy"];
  if (/^\/api\/(facility|visits)(\/|$)/.test(path)) return read ? ["patients.view"] : "deny";
  return "allow"; // public / patient / admin APIs check their own sessions
}

export const allowed = (perms: readonly string[], need: Need) => need === "allow" || (need !== "deny" && need.some((k) => perms.includes(k)));

/** Which clinic-app page needs which permission (for navigation and page guards). */
export const PAGE_PERMISSION: { prefix: string; need: PermissionKey[] }[] = [
  { prefix: "/facility/dashboard", need: ["dashboard"] },
  { prefix: "/facility/patients/register", need: ["patients.register"] },
  { prefix: "/facility/patients", need: ["patients.view"] },
  { prefix: "/facility/reception", need: ["patients.view"] },
  { prefix: "/facility/mizaj", need: ["mizaj"] },
  { prefix: "/facility/asbab", need: ["asbab"] },
  { prefix: "/facility/tashkhees", need: ["diagnosis"] },
  { prefix: "/facility/pharmacy", need: ["pharmacy"] },
  { prefix: "/facility/appointments", need: ["appointments"] },
  { prefix: "/facility/messages", need: ["messages"] },
  { prefix: "/facility/prescriptions", need: ["prescribe", "patients.view"] },
  { prefix: "/facility/payments", need: ["payments", "finance.view"] },
  { prefix: "/facility/profile/staff", need: ["staff.manage"] },
  { prefix: "/facility/profile/permissions", need: ["staff.manage"] },
  { prefix: "/facility/profile/activity", need: [] }, // everyone: own history at least
  { prefix: "/facility/profile/learning", need: [] }, // everyone: their own tours and tutorials
  { prefix: "/facility/profile", need: ["settings"] },
];
/** Where a staff member lands after signing in — their own profile when they can't open any clinic page. */
export function firstAllowedPage(perms: readonly string[]): string {
  for (const p of ["/facility/dashboard", "/facility/patients", "/facility/appointments", "/facility/messages", "/facility/pharmacy"]) if (canOpenPage(perms, p)) return p;
  return "/staff";
}

export function canOpenPage(perms: readonly string[] | null, path: string): boolean {
  if (!perms) return true; // owner
  const rule = PAGE_PERMISSION.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`) || path.startsWith(`${r.prefix}?`));
  return !rule || rule.need.length === 0 || rule.need.some((k) => perms.includes(k));
}
