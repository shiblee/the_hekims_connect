import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { AUDIT_ACTIONS } from "@/lib/clinic-audit";
import { auditFilters, auditStats } from "@/lib/clinic-audit-stats";
import { listParam } from "@/lib/list-param";

const PAGE = 50;

/** Super Admin: every clinic's activity log (read-only). Same filters as the clinic view, plus `facility`. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const facilityIds = listParam(p, "facility"), actorIds = listParam(p, "actor");
  const where: Record<string, unknown> = auditFilters(p, (k) => listParam(p, k));
  if (facilityIds.length) where.facilityId = { in: facilityIds };
  if (actorIds.length) where.actorId = { in: actorIds };
  const page = Math.max(1, Number(p.get("page")) || 1);

  const [events, total, facilities, actors, stats] = await Promise.all([
    db.facilityAuditEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.facilityAuditEvent.count({ where }),
    db.facility.findMany({ orderBy: { facilityName: "asc" }, select: { id: true, facilityName: true } }),
    facilityIds.length ? db.facilityAuditEvent.findMany({ where: { facilityId: { in: facilityIds } }, distinct: ["actorId"], select: { actorId: true, actorName: true } }) : Promise.resolve([]),
    auditStats(where),
  ]);
  const names = new Map(facilities.map((f) => [f.id, f.facilityName]));
  return NextResponse.json({
    scope: "all", total, page, pageSize: PAGE, facilities, actors: actors.filter((a) => a.actorId), stats,
    events: events.map((e) => ({ id: e.id, createdAt: e.createdAt, actorType: e.actorType, actorName: e.actorName, action: e.action, entityLabel: e.entityLabel, outcome: e.outcome, summary: e.summary, ip: e.ip, facilityName: names.get(e.facilityId) ?? "Deleted clinic" })),
    groups: [...new Set(Object.values(AUDIT_ACTIONS).map((a) => a.group))],
    labels: Object.fromEntries(Object.entries(AUDIT_ACTIONS).map(([k, v]) => [k, v.label])),
    actionGroups: Object.fromEntries(Object.entries(AUDIT_ACTIONS).map(([k, v]) => [k, v.group])),
  });
}
