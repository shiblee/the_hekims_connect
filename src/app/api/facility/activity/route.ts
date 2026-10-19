import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";
import { AUDIT_ACTIONS } from "@/lib/clinic-audit";

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
  const where: Record<string, unknown> = { facilityId: auth.id };
  if (!all) where.actorId = auth.staffId;
  else if (p.get("actor")) where.actorId = p.get("actor");
  const from = p.get("from"), to = p.get("to");
  // The browser sends exact instants for the start / end of its local days (the server runs in UTC).
  const valid = (v: string | null) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null);
  const fromAt = valid(from), toAt = valid(to);
  if (fromAt || toAt) where.createdAt = { ...(fromAt ? { gte: fromAt } : {}), ...(toAt ? { lte: toAt } : {}) };
  const group = p.get("group");
  if (group) where.action = { in: Object.entries(AUDIT_ACTIONS).filter(([, v]) => v.group === group).map(([k]) => k) };
  if (p.get("outcome")) where.outcome = p.get("outcome");
  const q = p.get("q")?.trim();
  if (q) where.OR = [{ entityLabel: { contains: q } }, { summary: { contains: q } }, { actorName: { contains: q } }];
  const page = Math.max(1, Number(p.get("page")) || 1);

  const [events, total, actors] = await Promise.all([
    db.facilityAuditEvent.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      select: { id: true, createdAt: true, actorType: true, actorId: true, actorName: true, action: true, entityType: true, entityLabel: true, outcome: true, summary: true, ip: true },
    }),
    db.facilityAuditEvent.count({ where }),
    all ? db.facilityAuditEvent.findMany({ where: { facilityId: auth.id }, distinct: ["actorId"], select: { actorId: true, actorName: true } }) : Promise.resolve([]),
  ]);
  return NextResponse.json({
    scope: all ? "clinic" : "own", events, total, page, pageSize: PAGE,
    actors: actors.filter((a) => a.actorId),
    groups: [...new Set(Object.values(AUDIT_ACTIONS).map((a) => a.group))],
    labels: Object.fromEntries(Object.entries(AUDIT_ACTIONS).map(([k, v]) => [k, v.label])),
  });
}
