import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { DEFAULT_GHIZA_CONFIG, getGhizaConfig } from "@/lib/ghiza-engine";
import { CONDITIONS } from "@/lib/ghiza-conditions";
import { cleanGhizaRule, cleanImage, foodMizajOf } from "@/lib/ghiza-validate";

/** Foods, engine settings and the lists a food's rules can refer to. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [config, foods, organs, allergies, symptoms] = await Promise.all([
    getGhizaConfig(),
    db.tashkheesOption.findMany({ where: { list: "ghiza" }, orderBy: { sortOrder: "asc" } }),
    db.tashkheesOption.findMany({ where: { list: "organ", active: true }, orderBy: { sortOrder: "asc" }, select: { label: true } }),
    db.allergyTag.findMany({ where: { active: true }, orderBy: { label: "asc" }, select: { label: true } }).catch(() => []),
    db.acuteSymptomTag.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { label: true } }),
  ]);
  return NextResponse.json({
    config, defaults: DEFAULT_GHIZA_CONFIG, foods,
    conditions: CONDITIONS.map((c) => ({ key: c.key, label: c.label })),
    organs: organs.map((o) => o.label), allergies: allergies.map((a) => a.label), symptoms: symptoms.map((s) => s.label),
  });
}

/** Body { config } — engine settings. */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const c = (await req.json().catch(() => ({}))).config || {};
  const n = (v: unknown, fb: number) => { const x = Number(v); return Number.isFinite(x) ? Math.max(2, Math.min(20, Math.round(x))) : fb; };
  const config = { maxRecommended: n(c.maxRecommended, DEFAULT_GHIZA_CONFIG.maxRecommended), maxAvoid: n(c.maxAvoid, DEFAULT_GHIZA_CONFIG.maxAvoid), ranking: c.ranking !== false };
  await db.portalSetting.upsert({
    where: { category_key: { category: "ghiza_engine", key: "config" } },
    create: { category: "ghiza_engine", key: "config", value: JSON.stringify(config), updatedBy: session.admin.id },
    update: { value: JSON.stringify(config), updatedBy: session.admin.id },
  });
  await logAdminActivity(session.admin.id, "ghiza_engine_updated", "Updated diet engine settings", getClientIp(req));
  return NextResponse.json({ config });
}

/** Add a food (draft unless approved). */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 120) : "";
  if (!label) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (await db.tashkheesOption.findFirst({ where: { list: "ghiza", label } })) return NextResponse.json({ error: "A food with this name already exists" }, { status: 400 });
  const max = await db.tashkheesOption.aggregate({ where: { list: "ghiza" }, _max: { sortOrder: true } });
  const o = await db.tashkheesOption.create({
    data: {
      list: "ghiza", label, description: typeof b.description === "string" ? b.description.trim().slice(0, 300) || null : null,
      category: typeof b.category === "string" ? b.category.trim().slice(0, 60) || null : null,
      foodMizaj: foodMizajOf(b.hot, b.moist, b.degree), appliesTo: JSON.stringify(cleanGhizaRule(b.rule)),
      reviewStatus: ["draft", "approved", "retired"].includes(b.reviewStatus) ? b.reviewStatus : "draft",
      sortOrder: (max._max.sortOrder ?? -1) + 1, ...cleanImage(b),
    },
  });
  await logAdminActivity(session.admin.id, "ghiza_engine_updated", `Added food "${o.label}"`, getClientIp(req));
  return NextResponse.json({ food: o });
}
