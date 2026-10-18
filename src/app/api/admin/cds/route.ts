import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { DEFAULT_CDS_CONFIG, getCdsConfig } from "@/lib/cds-engine";

/** Settings, data readiness (verification) and usage/audit summary for clinical decision support. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const v = (m: any, where: any = {}) => m.groupBy({ by: ["verificationStatus"], where, _count: true }).then((rows: any[]) => Object.fromEntries(rows.map((r) => [r.verificationStatus, r._count])));
  const [config, indications, symptoms, ingredients, safety, allergy, sessions, decisions, recent] = await Promise.all([
    getCdsConfig(),
    v(db.supplementComplaintLink, { profile: { tag: { kind: "supplement" } } }),
    v(db.supplementSymptomLink),
    v(db.supplementIngredient),
    v(db.supplementSafetyItem),
    v(db.supplementAllergyLink, { relation: "caution" }),
    db.cdsSession.count(),
    db.cdsDecision.groupBy({ by: ["action"], _count: true }),
    db.cdsDecision.findMany({ where: { action: "rejected" }, orderBy: { createdAt: "desc" }, take: 10, select: { label: true, reason: true, createdAt: true } }),
  ]);
  return NextResponse.json({
    config, defaults: DEFAULT_CDS_CONFIG,
    readiness: { indications, symptoms, ingredients, safety, allergy },
    usage: { sessions, decisions: Object.fromEntries(decisions.map((d) => [d.action, d._count])), recentRejections: recent },
  });
}

/** Body { config } — pilot switch and settings. */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const c = (await req.json().catch(() => ({}))).config || {};
  const n = Number(c.maxPerCategory);
  const config = { enabled: c.enabled === true, maxPerCategory: Number.isFinite(n) ? Math.max(2, Math.min(15, Math.round(n))) : DEFAULT_CDS_CONFIG.maxPerCategory, ranking: c.ranking !== false };
  await db.portalSetting.upsert({
    where: { category_key: { category: "cds", key: "config" } },
    create: { category: "cds", key: "config", value: JSON.stringify(config), updatedBy: session.admin.id },
    update: { value: JSON.stringify(config), updatedBy: session.admin.id },
  });
  await logAdminActivity(session.admin.id, "cds_updated", `Clinical decision support ${config.enabled ? "ENABLED" : "disabled"} (max ${config.maxPerCategory}, ranking ${config.ranking ? "on" : "off"})`, getClientIp(req));
  return NextResponse.json({ config });
}
