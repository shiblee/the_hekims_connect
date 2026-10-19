import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { AUDIT_ACTIONS } from "@/lib/clinic-audit";

const PAGE = 50;

/** Super Admin: every clinic's activity log (read-only). Same filters as the clinic view, plus `facility`. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const where: Record<string, unknown> = {};
  if (p.get("facility")) where.facilityId = p.get("facility");
  if (p.get("actor")) where.actorId = p.get("actor");
  const valid = (v: string | null) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null);
  const fromAt = valid(p.get("from")), toAt = valid(p.get("to"));
  if (fromAt || toAt) where.createdAt = { ...(fromAt ? { gte: fromAt } : {}), ...(toAt ? { lte: toAt } : {}) };
  const group = p.get("group");
  if (group) where.action = { in: Object.entries(AUDIT_ACTIONS).filter(([, v]) => v.group === group).map(([k]) => k) };
  if (p.get("outcome")) where.outcome = p.get("outcome");
  const q = p.get("q")?.trim();
  if (q) where.OR = [{ entityLabel: { contains: q } }, { summary: { contains: q } }, { actorName: { contains: q } }];
  const page = Math.max(1, Number(p.get("page")) || 1);

  const [events, total, facilities, actors] = await Promise.all([
    db.facilityAuditEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.facilityAuditEvent.count({ where }),
    db.facility.findMany({ orderBy: { facilityName: "asc" }, select: { id: true, facilityName: true } }),
    p.get("facility") ? db.facilityAuditEvent.findMany({ where: { facilityId: p.get("facility")! }, distinct: ["actorId"], select: { actorId: true, actorName: true } }) : Promise.resolve([]),
  ]);
  const names = new Map(facilities.map((f) => [f.id, f.facilityName]));
  return NextResponse.json({
    scope: "all", total, page, pageSize: PAGE, facilities, actors: actors.filter((a) => a.actorId),
    events: events.map((e) => ({ id: e.id, createdAt: e.createdAt, actorType: e.actorType, actorName: e.actorName, action: e.action, entityLabel: e.entityLabel, outcome: e.outcome, summary: e.summary, ip: e.ip, facilityName: names.get(e.facilityId) ?? "Deleted clinic" })),
    groups: [...new Set(Object.values(AUDIT_ACTIONS).map((a) => a.group))],
    labels: Object.fromEntries(Object.entries(AUDIT_ACTIONS).map(([k, v]) => [k, v.label])),
  });
}
