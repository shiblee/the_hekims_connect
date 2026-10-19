// Server side of user guidance: settings, publishing, and who may see what.
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import type { PermissionKey } from "@/lib/staff-permissions";
import { cleanDoc, cleanTour, parseAudience } from "./content";
import { moduleDef, type GuidanceModuleDef } from "./registry";

// ── Settings (PortalSetting category "guidance") ─────────────────────────────
export const GUIDANCE_SETTING_DEFAULTS = {
  enabled: "true",
  tours_enabled: "true",
  docs_enabled: "true",
  login_tours: "true",
  first_visit_tours: "true",
  reoffer_updated: "false",
  default_language: "en",
  fallback_language: "en",
} as const;
export type GuidanceSettingKey = keyof typeof GUIDANCE_SETTING_DEFAULTS;
export interface GuidanceSettings {
  enabled: boolean; toursEnabled: boolean; docsEnabled: boolean; loginTours: boolean; firstVisitTours: boolean;
  reofferUpdated: boolean; defaultLanguage: string; fallbackLanguage: string;
}

export async function getGuidanceSettings(): Promise<GuidanceSettings> {
  const rows = await db.portalSetting.findMany({ where: { category: "guidance" } });
  const v = (k: GuidanceSettingKey) => rows.find((r) => r.key === k)?.value ?? GUIDANCE_SETTING_DEFAULTS[k];
  return {
    enabled: v("enabled") === "true", toursEnabled: v("tours_enabled") === "true", docsEnabled: v("docs_enabled") === "true",
    loginTours: v("login_tours") === "true", firstVisitTours: v("first_visit_tours") === "true", reofferUpdated: v("reoffer_updated") === "true",
    defaultLanguage: v("default_language"), fallbackLanguage: v("fallback_language"),
  };
}

export async function saveGuidanceSettings(patch: Partial<Record<GuidanceSettingKey, string>>, updatedBy: string) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in GUIDANCE_SETTING_DEFAULTS) || typeof value !== "string") continue;
    await db.portalSetting.upsert({
      where: { category_key: { category: "guidance", key } },
      create: { category: "guidance", key, value, updatedBy },
      update: { value, updatedBy },
    });
  }
}

// ── Publishing ───────────────────────────────────────────────────────────────
type Kind = "tour" | "doc";
const table = (kind: Kind) => (kind === "tour" ? db.guidanceTour : db.guidanceDoc) as unknown as {
  findUnique: (a: object) => Promise<{ id: string; draft: string; version: number; status: string } | null>;
  update: (a: object) => Promise<unknown>;
};

/** Freezes the draft as the next published version and records it in history. */
export async function publishGuidance(kind: Kind, id: string, by: string, note?: string) {
  const row = await table(kind).findUnique({ where: { id } });
  if (!row) throw new Error("Not found");
  const content = kind === "tour" ? cleanTour(JSON.parse(row.draft)) : cleanDoc(JSON.parse(row.draft));
  const snapshot = JSON.stringify(content);
  const version = row.version + 1;
  const data = { published: snapshot, version, status: "published", dirty: false, publishedAt: new Date(), publishedBy: by };
  const history = db.guidanceVersion.create({ data: { kind, entityId: id, version, snapshot, publishedBy: by, note: note?.slice(0, 300) || null } });
  if (kind === "tour") await db.$transaction([history, db.guidanceTour.update({ where: { id }, data })]);
  else await db.$transaction([history, db.guidanceDoc.update({ where: { id }, data })]);
  return version;
}

export async function setGuidanceStatus(kind: Kind, id: string, status: "draft" | "archived") {
  // Unpublish keeps the history and the last published copy (so re-publishing is one click), but users stop seeing it.
  await table(kind).update({ where: { id }, data: { status } });
}

// ── Viewers ──────────────────────────────────────────────────────────────────
export interface Viewer {
  app: "clinic" | "admin";
  userKey: string;
  /** null = clinic owner or admin (everything in their app). */
  permissions: PermissionKey[] | null;
  isOwner: boolean;
  staffRole: string | null;
  facilityId: string | null;
  /** The clinic owner switched guidance off for their clinic. */
  clinicOff: boolean;
}

/** Who is asking (clinic owner, staff member or admin) — null for patients and anonymous requests. */
export async function viewerFrom(req: NextRequest): Promise<Viewer | null> {
  const auth = await getAuthUser(req);
  if (auth?.type === "facility") {
    const f = await db.facility.findUnique({ where: { id: auth.id }, select: { guidanceEnabled: true } });
    if (auth.staffId) {
      const access = await loadStaffAccess(auth.staffId);
      if (!access) return null;
      return { app: "clinic", userKey: `staff:${auth.staffId}`, permissions: access.permissions, isOwner: false, staffRole: access.role, facilityId: auth.id, clinicOff: f?.guidanceEnabled === false };
    }
    return { app: "clinic", userKey: `facility:${auth.id}`, permissions: null, isOwner: true, staffRole: null, facilityId: auth.id, clinicOff: f?.guidanceEnabled === false };
  }
  if (req.headers.get("x-hekim-admin-auth")) {
    const session = await requireAdmin(req);
    if (session) return { app: "admin", userKey: `admin:${session.admin.id}`, permissions: null, isOwner: false, staffRole: null, facilityId: null, clinicOff: false };
  }
  return null;
}

/** Can this viewer open the module's page at all? (Server-side source of truth for guidance access.) */
export function canOpenModule(v: Viewer, m: GuidanceModuleDef): boolean {
  if (m.app !== v.app) return false;
  if (m.ownerOnly && !v.isOwner) return false;
  if (!v.permissions || !m.permission.length) return true;
  return m.permission.some((p) => v.permissions!.includes(p));
}

/** Is this tour / tutorial written for this viewer? Empty audience = everyone who can open the module. */
export function audienceMatches(v: Viewer, audienceJson: string): boolean {
  const a = parseAudience(audienceJson);
  if (!a.length) return true;
  if (v.app === "admin") return a.includes("admin");
  if (v.isOwner) return a.includes("owner");
  return a.includes("staff") || (!!v.staffRole && a.includes(`role:${v.staffRole}`));
}

export function visibleModule(v: Viewer, key: string, enabledInDb: boolean): GuidanceModuleDef | null {
  const m = moduleDef(key);
  return m && enabledInDb && canOpenModule(v, m) ? m : null;
}

/** Should this tour start by itself for a user? Once per version; never while they're mid-way; updates only if re-offering is on. */
export function tourDue(tour: { version: number; reoffer: boolean }, progress: { state: string; version: number } | undefined, reofferUpdated: boolean): boolean {
  if (!progress) return true;
  return progress.state !== "in_progress" && progress.version < tour.version && (tour.reoffer || reofferUpdated);
}
