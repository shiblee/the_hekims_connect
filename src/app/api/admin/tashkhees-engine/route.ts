import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { DEFAULT_ENGINE_CONFIG, getEngineConfig, type EngineConfig } from "@/lib/tashkhees-engine";

/** Everything the Tashkhees Engine admin tab manages. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [config, pillars, organs, mizaj] = await Promise.all([
    getEngineConfig(),
    db.asbabPillar.findMany({
      orderBy: [{ framework: "asc" }, { sortOrder: "asc" }],
      select: { key: true, label: true, english: true, framework: true, active: true,
        questions: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true, reviewStatus: true, options: { where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true, maddi: true } } } } },
    }),
    db.tashkheesOption.findMany({ where: { list: "organ" }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true, localName: true, description: true, appliesTo: true, priority: true, active: true } }),
    db.tashkheesOption.findMany({ where: { list: "mizaj" }, orderBy: { sortOrder: "asc" }, select: { id: true, label: true, localName: true, description: true, sortOrder: true, active: true } }),
  ]);
  return NextResponse.json({
    config, defaults: DEFAULT_ENGINE_CONFIG,
    sections: pillars.map((p) => ({ key: p.key, label: p.label, english: p.english, framework: p.framework })),
    maddi: pillars.filter((p) => p.framework === "dalail" && p.active).map((p) => ({ section: p.key, sectionLabel: p.label, questions: p.questions.filter((q) => q.options.length) })),
    organs, mizaj,
  });
}

const n = (v: unknown, lo: number, hi: number, fb: number) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : fb; };

/** Body { config } — saves the engine settings (validated, clamped). */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const c = b.config || {};
  const d = DEFAULT_ENGINE_CONFIG;
  const bands = Array.isArray(c.darjaBands) ? c.darjaBands.map((x: unknown, i: number) => n(x, 1, 90, d.darjaBands[i])) : d.darjaBands;
  const cfg: EngineConfig = {
    weights: { complaints: n(c.weights?.complaints, 0, 3, d.weights.complaints), asbab: n(c.weights?.asbab, 0, 3, d.weights.asbab), dalail: n(c.weights?.dalail, 0, 3, d.weights.dalail), assessment: n(c.weights?.assessment, 0, 3, d.weights.assessment) },
    constitutionalSections: Array.isArray(c.constitutionalSections) ? c.constitutionalSections.filter((x: unknown) => typeof x === "string").slice(0, 30) : d.constitutionalSections,
    minEvidence: n(c.minEvidence, 0, 30, d.minEvidence),
    balancedMargin: n(c.balancedMargin, 1, 50, d.balancedMargin),
    darjaBands: [bands[0], Math.max(bands[0], bands[1]), Math.max(bands[1], bands[2])] as [number, number, number],
    severityBoost: c.severityBoost !== false,
    maddiThreshold: n(c.maddiThreshold, 0.5, 20, d.maddiThreshold),
    maxOrgans: Math.round(n(c.maxOrgans, 1, 10, d.maxOrgans)),
    ranking: c.ranking !== false,
  };
  await db.portalSetting.upsert({
    where: { category_key: { category: "tashkhees_engine", key: "config" } },
    create: { category: "tashkhees_engine", key: "config", value: JSON.stringify(cfg), updatedBy: session.admin.id },
    update: { value: JSON.stringify(cfg), updatedBy: session.admin.id },
  });
  await logAdminActivity(session.admin.id, "tashkhees_engine_updated", "Updated Tashkhees engine settings", getClientIp(req));
  return NextResponse.json({ config: cfg });
}

/** Body { maddi: [{ id, maddi }] } — morbid-matter weights on examination options. */
export async function PATCH(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const rows = Array.isArray(b.maddi) ? b.maddi.filter((r: any) => typeof r?.id === "string").slice(0, 500) : [];
  await db.$transaction(rows.map((r: { id: string; maddi: unknown }) => db.asbabOption.update({ where: { id: r.id }, data: { maddi: n(r.maddi, 0, 5, 0) } })));
  await logAdminActivity(session.admin.id, "tashkhees_engine_updated", `Updated ${rows.length} morbid-matter (Maddi) weight${rows.length === 1 ? "" : "s"}`, getClientIp(req));
  return NextResponse.json({ updated: rows.length });
}
