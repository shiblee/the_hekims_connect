import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { GUIDANCE_MODULES, syncGuidanceModules } from "@/lib/guidance/registry";
import { GUIDANCE_SETTING_DEFAULTS, getGuidanceSettings, saveGuidanceSettings, type GuidanceSettingKey } from "@/lib/guidance/server";
import { summarize } from "@/lib/guidance/admin-kind";

/** Admin → User guidance: settings and every module with its tours / tutorials. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if ((await db.guidanceModule.count()) < GUIDANCE_MODULES.length) await syncGuidanceModules(db);
  const [settings, modules, tours, docs, progress] = await Promise.all([
    getGuidanceSettings(),
    db.guidanceModule.findMany({ orderBy: { sortOrder: "asc" } }),
    db.guidanceTour.findMany({ orderBy: { createdAt: "asc" } }),
    db.guidanceDoc.findMany({ orderBy: { createdAt: "asc" } }),
    db.guidanceProgress.groupBy({ by: ["tourId", "state"], _count: { _all: true } }),
  ]);
  const def = new Map(GUIDANCE_MODULES.map((m) => [m.key, m]));
  return NextResponse.json({
    settings,
    modules: modules.filter((m) => def.has(m.key)).map((m) => ({
      key: m.key, app: m.app, name: m.name, route: m.route, enabled: m.enabled,
      permission: def.get(m.key)!.permission, ownerOnly: !!def.get(m.key)!.ownerOnly,
      tours: tours.filter((t) => t.moduleKey === m.key).map((t) => ({
        ...summarize("tours", t),
        progress: Object.fromEntries(progress.filter((p) => p.tourId === t.id).map((p) => [p.state, p._count._all])),
      })),
      docs: docs.filter((d) => d.moduleKey === m.key).map((d) => summarize("docs", d)),
    })),
  });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json();
  const patch: Partial<Record<GuidanceSettingKey, string>> = {};
  for (const k of Object.keys(GUIDANCE_SETTING_DEFAULTS) as GuidanceSettingKey[]) {
    const v = body?.[k];
    if (v === undefined) continue;
    if (k === "default_language" || k === "fallback_language") {
      const lang = await db.language.findUnique({ where: { code: String(v) }, select: { enabled: true } });
      if (!lang?.enabled) return NextResponse.json({ error: "Choose an enabled language" }, { status: 400 });
      patch[k] = String(v);
    } else patch[k] = v === true || v === "true" ? "true" : "false";
  }
  await saveGuidanceSettings(patch, session.admin.id);
  await logAdminActivity(session.admin.id, "guidance_settings_updated", `User guidance settings changed: ${Object.keys(patch).join(", ")}`, getClientIp(req));
  return NextResponse.json({ settings: await getGuidanceSettings() });
}
