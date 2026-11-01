import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import { AUDIT_ACTIONS } from "@/lib/clinic-audit";
import { auditFilters, auditStats } from "@/lib/clinic-audit-stats";
import { listParam } from "@/lib/list-param";

const PAGE = 50;

/**
 * Clinic activity log (read-only — nothing can edit or delete it). The owner, and staff with
 * "Clinic activity log", see the whole clinic; other staff see only their own actions.
 * Query: from, to (ISO instants), actor, group, outcome, q (patient / record / text), page.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const access = auth.staffId ? await loadStaffAccess(auth.staffId) : null;
  const all = !auth.staffId || !!access?.permissions.includes("activity");

  const p = req.nextUrl.searchParams;
  const actors = listParam(p, "actor");
  const where: Record<string, unknown> = { facilityId: auth.id, ...auditFilters(p, (k) => listParam(p, k)) };
  if (!all) where.actorId = auth.staffId;
  else if (actors.length) where.actorId = { in: actors };
  const page = Math.max(1, Number(p.get("page")) || 1);

  const [events, total, people, stats] = await Promise.all([
    db.facilityAuditEvent.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      select: { id: true, createdAt: true, actorType: true, actorId: true, actorName: true, action: true, entityType: true, entityLabel: true, outcome: true, summary: true, ip: true },
    }),
    db.facilityAuditEvent.count({ where }),
    all ? db.facilityAuditEvent.findMany({ where: { facilityId: auth.id }, distinct: ["actorId"], select: { actorId: true, actorName: true } }) : Promise.resolve([]),
    auditStats(where),
  ]);
  return NextResponse.json({
    scope: all ? "clinic" : "own", events, total, page, pageSize: PAGE,
    actors: people.filter((a) => a.actorId), stats,
    groups: [...new Set(Object.values(AUDIT_ACTIONS).map((a) => a.group))],
    labels: Object.fromEntries(Object.entries(AUDIT_ACTIONS).map(([k, v]) => [k, v.label])),
    actionGroups: Object.fromEntries(Object.entries(AUDIT_ACTIONS).map(([k, v]) => [k, v.group])),
  });
}
