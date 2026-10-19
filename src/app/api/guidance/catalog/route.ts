import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanDoc, pickLang, t } from "@/lib/guidance/content";
import { GUIDANCE_MODULES } from "@/lib/guidance/registry";
import { getGuidanceSettings, viewerFrom } from "@/lib/guidance/server";
import { tourPayload, viewerLanguage, visibleDocs, visibleTours } from "@/lib/guidance/viewer-content";

/** Every tour and tutorial this user may use (by module, in their language), with their progress — for Learning & tutorials. */
export async function GET(req: NextRequest) {
  const viewer = await viewerFrom(req);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getGuidanceSettings();
  const on = settings.enabled && !viewer.clinicOff;
  if (!on) return NextResponse.json({ on: false, clinicOff: viewer.clinicOff, modules: [] });

  const lang = await viewerLanguage(settings);
  const [tours, docs, progress] = await Promise.all([
    settings.toursEnabled ? visibleTours(viewer) : Promise.resolve([]),
    settings.docsEnabled ? visibleDocs(viewer) : Promise.resolve([]),
    db.guidanceProgress.findMany({ where: { userKey: viewer.userKey } }),
  ]);
  const prog = new Map(progress.map((p) => [p.tourId, p]));
  const modules = GUIDANCE_MODULES.filter((m) => m.app === viewer.app).map((m) => {
    const doc = docs.find((d) => d.moduleKey === m.key);
    const docTitle = doc?.published ? (() => { const c = cleanDoc(JSON.parse(doc.published!)); return t(c.title, pickLang(c, lang, settings.fallbackLanguage).lang); })() : null;
    return {
      key: m.key, name: m.name, route: m.route, doc: docTitle ? { title: docTitle } : null,
      tours: tours.filter((x) => x.moduleKey === m.key).map((x) => {
        const p = prog.get(x.id);
        const payload = tourPayload(x, lang, settings.fallbackLanguage);
        return { id: x.id, title: payload?.title ?? x.name, steps: payload?.steps.length ?? 0, firstRoute: payload?.steps[0]?.route ?? m.route, state: p?.state ?? "new", step: p?.step ?? 0, outdated: !!p && p.version < x.version, completedAt: p?.completedAt ?? null };
      }),
    };
  }).filter((m) => m.doc || m.tours.length);
  return NextResponse.json({ on: true, lang, toursOn: settings.toursEnabled, docsOn: settings.docsEnabled, modules });
}
