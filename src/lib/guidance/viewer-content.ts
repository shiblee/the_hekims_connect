// What a signed-in user may see: published tours / tutorials for modules they can open, in their language.
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { cleanDoc, cleanTour, pickLang, RTL_LANGS, t, type GuideLang } from "./content";
import { GUIDANCE_MODULES, moduleDef, type GuidanceModuleDef } from "./registry";
import { audienceMatches, canOpenModule, getGuidanceSettings, type GuidanceSettings, type Viewer } from "./server";

export async function viewerLanguage(settings: GuidanceSettings): Promise<string> {
  const requested = (await cookies()).get("NEXT_LOCALE")?.value;
  if (requested) {
    const lang = await db.language.findUnique({ where: { code: requested }, select: { enabled: true } });
    if (lang?.enabled) return requested;
  }
  return settings.defaultLanguage;
}

/** The module a page belongs to (longest matching route in the viewer's app). */
export function moduleForPath(app: "clinic" | "admin", path: string): GuidanceModuleDef | null {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  return GUIDANCE_MODULES.filter((m) => m.app === app && (clean === m.route || clean.startsWith(`${m.route}/`)))
    .sort((a, b) => b.route.length - a.route.length)[0] ?? null;
}

export interface TourPayload {
  id: string; version: number; trigger: string; moduleKey: string; title: string; lang: GuideLang; rtl: boolean; isFallback: boolean;
  steps: { id: string; title: string; body: string; route?: string; target?: string; placement?: string }[];
}

/**
 * A tour in the user's language. Pass `viewer` to drop steps on pages that user can't open
 * (a user is never guided to something they can't use).
 */
export function tourPayload(row: { id: string; version: number; trigger: string; moduleKey: string; published: string | null }, wanted: string, fallback: string, viewer?: Viewer): TourPayload | null {
  if (!row.published) return null;
  const c = cleanTour(JSON.parse(row.published));
  const { lang, isFallback } = pickLang(c, wanted, fallback);
  const reachable = (route?: string) => {
    if (!viewer || !route) return true;
    const m = moduleForPath(viewer.app, route);
    return !m || canOpenModule(viewer, m);
  };
  const steps = c.steps.filter((s) => s.active && reachable(s.route)).map((s) => ({ id: s.id, title: t(s.title, lang), body: t(s.body, lang), route: s.route, target: s.target, placement: s.placement }));
  if (!steps.length) return null;
  return { id: row.id, version: row.version, trigger: row.trigger, moduleKey: row.moduleKey, title: t(c.title, lang), lang, rtl: RTL_LANGS.includes(lang), isFallback, steps };
}

/** Published tours this viewer may see (module enabled, can open it, audience matches). */
export async function visibleTours(v: Viewer) {
  const [rows, mods] = await Promise.all([
    db.guidanceTour.findMany({ where: { status: "published" }, select: { id: true, name: true, moduleKey: true, version: true, trigger: true, reoffer: true, audience: true, published: true } }),
    db.guidanceModule.findMany({ where: { enabled: true }, select: { key: true } }),
  ]);
  const on = new Set(mods.map((m) => m.key));
  return rows.filter((r) => {
    const m = moduleDef(r.moduleKey);
    return m && on.has(r.moduleKey) && canOpenModule(v, m) && audienceMatches(v, r.audience);
  });
}

export async function visibleDocs(v: Viewer) {
  const [rows, mods] = await Promise.all([
    db.guidanceDoc.findMany({ where: { status: "published" }, select: { id: true, moduleKey: true, version: true, audience: true, published: true, publishedAt: true } }),
    db.guidanceModule.findMany({ where: { enabled: true }, select: { key: true } }),
  ]);
  const on = new Set(mods.map((m) => m.key));
  // One tutorial per module for this viewer: the most specific audience match wins (role > staff/owner > everyone).
  const score = (a: string) => (a.includes("role:") ? 2 : a === "[]" ? 0 : 1);
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const m = moduleDef(r.moduleKey);
    if (!m || !on.has(r.moduleKey) || !canOpenModule(v, m) || !audienceMatches(v, r.audience)) continue;
    const cur = best.get(r.moduleKey);
    if (!cur || score(r.audience) > score(cur.audience)) best.set(r.moduleKey, r);
  }
  return [...best.values()];
}

export { cleanDoc, getGuidanceSettings };
