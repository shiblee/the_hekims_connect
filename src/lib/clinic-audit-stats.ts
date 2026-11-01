import { db } from "@/lib/db";
import { AUDIT_ACTIONS } from "@/lib/clinic-audit";

/** Activity-log filters (comma-separated multi-select values) → Prisma where for facilityAuditEvent. */
export function auditFilters(p: URLSearchParams, list: (key: string) => string[]): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const valid = (v: string | null) => (v && !Number.isNaN(new Date(v).getTime()) ? new Date(v) : null);
  const fromAt = valid(p.get("from")), toAt = valid(p.get("to"));
  if (fromAt || toAt) where.createdAt = { ...(fromAt ? { gte: fromAt } : {}), ...(toAt ? { lte: toAt } : {}) };
  const groups = list("group");
  if (groups.length) where.action = { in: Object.entries(AUDIT_ACTIONS).filter(([, v]) => groups.includes(v.group)).map(([k]) => k) };
  const outcomes = list("outcome");
  if (outcomes.length) where.outcome = { in: outcomes };
  const q = p.get("q")?.trim();
  if (q) where.OR = [{ entityLabel: { contains: q } }, { summary: { contains: q } }, { actorName: { contains: q } }];
  return where;
}

/** Headline figures for the filtered log: sign-ins, problems, people, mix by group, most active people. */
export async function auditStats(where: Record<string, unknown>) {
  const [byAction, byActor] = await Promise.all([
    db.facilityAuditEvent.groupBy({ by: ["action", "outcome"], where, _count: { _all: true } }),
    db.facilityAuditEvent.groupBy({ by: ["actorId", "actorName"], where, _count: { _all: true } }),
  ]);
  const groups = new Map<string, number>();
  let signIns = 0, problems = 0;
  for (const r of byAction) {
    const n = r._count._all;
    const g = AUDIT_ACTIONS[r.action]?.group ?? "General";
    groups.set(g, (groups.get(g) ?? 0) + n);
    if (r.action === "auth.login" && r.outcome === "success") signIns += n;
    if (r.outcome !== "success") problems += n;
  }
  const people = new Map<string, { name: string; count: number }>();
  for (const r of byActor) {
    if (!r.actorId) continue;
    const cur = people.get(r.actorId);
    people.set(r.actorId, { name: cur?.name ?? r.actorName, count: (cur?.count ?? 0) + r._count._all });
  }
  return {
    signIns, problems, people: people.size,
    byGroup: [...groups].map(([group, count]) => ({ group, count })).sort((a, b) => b.count - a.count),
    top: [...people.values()].sort((a, b) => b.count - a.count).slice(0, 3),
  };
}
