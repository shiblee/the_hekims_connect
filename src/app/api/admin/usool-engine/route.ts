import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { DEFAULT_USOOL_CONFIG, getUsoolConfig } from "@/lib/usool-engine";
import { cleanUsoolRule } from "@/lib/usool-validate";

/** Principles, engine settings and the lists their conditions can refer to. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [config, principles, lists, options] = await Promise.all([
    getUsoolConfig(),
    db.tashkheesOption.findMany({ where: { list: "usool" }, orderBy: { sortOrder: "asc" } }),
    db.tashkheesOption.findMany({ where: { list: { in: ["mizaj", "organ"] }, active: true }, orderBy: { sortOrder: "asc" }, select: { list: true, label: true } }),
    db.asbabOption.findMany({ where: { active: true, question: { active: true } }, select: { label: true } }),
  ]);
  return NextResponse.json({
    config, defaults: DEFAULT_USOOL_CONFIG, principles,
    mizaj: lists.filter((l) => l.list === "mizaj").map((l) => l.label),
    organs: lists.filter((l) => l.list === "organ").map((l) => l.label),
    findings: [...new Set(options.map((o) => o.label))].sort(),
  });
}

/** Body { config } — engine settings. */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const c = (await req.json().catch(() => ({}))).config || {};
  const n = Number(c.maxPrinciples);
  const config = { maxPrinciples: Number.isFinite(n) ? Math.max(2, Math.min(15, Math.round(n))) : DEFAULT_USOOL_CONFIG.maxPrinciples, ranking: c.ranking !== false };
  await db.portalSetting.upsert({
    where: { category_key: { category: "usool_engine", key: "config" } },
    create: { category: "usool_engine", key: "config", value: JSON.stringify(config), updatedBy: session.admin.id },
    update: { value: JSON.stringify(config), updatedBy: session.admin.id },
  });
  await logAdminActivity(session.admin.id, "usool_engine_updated", "Updated Usool-e-Ilaj engine settings", getClientIp(req));
  return NextResponse.json({ config });
}

/** Body { label, localName, description, priority, reviewStatus, rule } — add a principle (draft unless approved). */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 120) : "";
  if (!label) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (await db.tashkheesOption.findFirst({ where: { list: "usool", label } })) return NextResponse.json({ error: "A principle with this name already exists" }, { status: 400 });
  const max = await db.tashkheesOption.aggregate({ where: { list: "usool" }, _max: { sortOrder: true } });
  const o = await db.tashkheesOption.create({
    data: {
      list: "usool", label, localName: typeof b.localName === "string" ? b.localName.trim() || null : null,
      description: typeof b.description === "string" ? b.description.trim().slice(0, 300) || null : null,
      priority: Math.max(1, Math.min(5, Math.round(Number(b.priority) || 3))),
      reviewStatus: ["draft", "approved", "retired"].includes(b.reviewStatus) ? b.reviewStatus : "draft",
      appliesTo: JSON.stringify(cleanUsoolRule(b.rule)), sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  await logAdminActivity(session.admin.id, "usool_engine_updated", `Added Usool-e-Ilaj principle "${o.label}"`, getClientIp(req));
  return NextResponse.json({ principle: o });
}
