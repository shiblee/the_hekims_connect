import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cleanDoc, DOC_SECTIONS, pickLang, RTL_LANGS, t } from "@/lib/guidance/content";
import { moduleDef } from "@/lib/guidance/registry";
import { canOpenModule, getGuidanceSettings, viewerFrom } from "@/lib/guidance/server";
import { viewerLanguage, visibleDocs } from "@/lib/guidance/viewer-content";

/**
 * The published tutorial for a module (?module=key), in the user's language (or the fallback),
 * plus related modules — only ones this user can open. Checked on the server: a user who can't
 * open the module gets 404, so tutorials never reveal restricted pages.
 */
export async function GET(req: NextRequest) {
  const viewer = await viewerFrom(req);
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getGuidanceSettings();
  if (!settings.enabled || !settings.docsEnabled || viewer.clinicOff) return NextResponse.json({ error: "Tutorials are switched off" }, { status: 404 });

  const key = req.nextUrl.searchParams.get("module") || "";
  const docs = await visibleDocs(viewer);
  const row = docs.find((d) => d.moduleKey === key);
  const def = moduleDef(key);
  if (!row?.published || !def) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const c = cleanDoc(JSON.parse(row.published));
  const { lang, isFallback } = pickLang(c, await viewerLanguage(settings), settings.fallbackLanguage);
  const enabled = new Set((await db.guidanceModule.findMany({ where: { enabled: true }, select: { key: true } })).map((m) => m.key));
  const withDoc = new Set(docs.map((d) => d.moduleKey));
  const related = def.related
    .map((k) => moduleDef(k))
    .filter((m): m is NonNullable<typeof m> => !!m && enabled.has(m.key) && canOpenModule(viewer, m))
    .map((m) => ({ key: m.key, name: m.name, route: m.route, hasDoc: withDoc.has(m.key) }));

  return NextResponse.json({
    doc: {
      moduleKey: key, moduleName: def.name, title: t(c.title, lang), lang, rtl: RTL_LANGS.includes(lang), isFallback,
      version: row.version, updatedAt: row.publishedAt,
      sections: DOC_SECTIONS.map(([k]) => ({ key: k, text: t(c.sections[k], lang) })).filter((s) => s.text),
      faqs: c.faqs.map((f) => ({ id: f.id, q: t(f.q, lang), a: t(f.a, lang) })).filter((f) => f.q && f.a),
    },
    related,
  });
}
