import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getGuidanceSettings, tourDue, viewerFrom } from "@/lib/guidance/server";
import { moduleForPath, tourPayload, viewerLanguage, visibleDocs, visibleTours } from "@/lib/guidance/viewer-content";

/**
 * Guidance for the page the user is on: whether guidance is on, the page's tours (with progress),
 * whether it has a tutorial, and at most one tour to start automatically (first sign-in / first visit).
 * Never fails the page: errors simply mean "no guidance".
 */
export async function GET(req: NextRequest) {
  try {
    const viewer = await viewerFrom(req);
    if (!viewer) return NextResponse.json({ on: false });
    const settings = await getGuidanceSettings();
    const on = settings.enabled && !viewer.clinicOff;
    if (!on) return NextResponse.json({ on: false });

    const path = req.nextUrl.searchParams.get("path") || "/";
    const mod = moduleForPath(viewer.app, path);
    const lang = await viewerLanguage(settings);
    const [tours, docs, progress] = await Promise.all([
      settings.toursEnabled ? visibleTours(viewer) : Promise.resolve([]),
      settings.docsEnabled ? visibleDocs(viewer) : Promise.resolve([]),
      db.guidanceProgress.findMany({ where: { userKey: viewer.userKey } }),
    ]);
    const prog = new Map(progress.map((p) => [p.tourId, p]));

    // Auto-start: first-sign-in tours anywhere, then first-visit tours for this page — only ever once per version.
    const due = (t: (typeof tours)[number]) => tourDue(t, prog.get(t.id), settings.reofferUpdated);
    const auto = settings.toursEnabled
      ? (settings.loginTours ? tours.find((t) => t.trigger === "first_login" && due(t)) : undefined)
        ?? (settings.firstVisitTours && mod ? tours.find((t) => t.trigger === "first_visit" && t.moduleKey === mod.key && due(t)) : undefined)
      : undefined;

    return NextResponse.json({
      on: true, toursOn: settings.toursEnabled, docsOn: settings.docsEnabled, lang,
      module: mod ? { key: mod.key, name: mod.name, hasDoc: docs.some((d) => d.moduleKey === mod.key) } : null,
      pageTours: mod ? tours.filter((t) => t.moduleKey === mod.key).map((t) => {
        const p = prog.get(t.id);
        return { id: t.id, title: tourPayload(t, lang, settings.fallbackLanguage)?.title ?? t.name, state: p?.state ?? "new", step: p?.step ?? 0, outdated: !!p && p.version < t.version };
      }) : [],
      autostart: auto ? tourPayload(auto, lang, settings.fallbackLanguage) : null,
    });
  } catch {
    return NextResponse.json({ on: false });
  }
}
