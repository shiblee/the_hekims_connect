import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { searchEntries } from "@/lib/complaint-search";
import { isRequestList, reviewTargets, type RequestListKey } from "@/lib/master-requests";

// Admin → Requests: terms clinicians asked to add to a master list (complaints, allergies, medicines).
// ?status=pending (default) | resolved; ?count=1 just returns the pending count (nav badge).
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  if (sp.get("count")) {
    const groups = await db.masterDataRequest.groupBy({ by: ["listKey", "normalized"], where: { status: "pending" } });
    return NextResponse.json({ pending: groups.length });
  }
  const resolved = sp.get("status") === "resolved";
  const rows = await db.masterDataRequest.findMany({
    where: resolved ? { status: { not: "pending" } } : { status: "pending" },
    include: { facility: { select: { id: true, facilityName: true } }, _count: { select: { uses: true } } },
    orderBy: resolved ? { reviewedAt: "desc" } : { createdAt: "asc" },
    take: resolved ? 200 : 500,
  });

  // Merge targets per list, also used for "closest in the list".
  const lists = [...new Set(rows.map((r) => r.listKey))].filter(isRequestList);
  const targets: Partial<Record<RequestListKey, { id: string; label: string; group: string | null }[]>> = {};
  const searchable: Partial<Record<RequestListKey, { id: string; label: string; labelLocal?: string | null; synonyms?: string; category?: string | null }[]>> = {};
  for (const k of lists) {
    targets[k] = await reviewTargets(k);
    searchable[k] = k === "chief_complaint"
      ? await db.chiefComplaint.findMany({ where: { active: true }, select: { id: true, label: true, labelLocal: true, synonyms: true, category: true } })
      : k === "allergy"
        ? await db.allergyTag.findMany({ where: { active: true }, select: { id: true, label: true, synonyms: true } })
        : (await db.medicationTag.findMany({ where: { active: true }, select: { id: true, label: true, synonyms: true, kind: true } })).map((m) => ({ ...m, category: m.kind === "medication" ? "Allopathic" : "Unani" }));
  }

  // One card per term: the same words asked for by several clinics are reviewed once.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = resolved ? r.id : `${r.listKey}|${r.normalized}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const requests = [...groups.values()].map((g) => {
    const first = g[0];
    const list = isRequestList(first.listKey) ? first.listKey : null;
    return {
      id: first.id,
      listKey: first.listKey,
      kind: first.kind,
      term: first.term,
      terms: [...new Set(g.map((x) => x.term))],
      status: first.status,
      clinics: g.map((x) => ({ id: x.facility.id, name: x.facility.facilityName, requestedByName: x.requestedByName, at: x.createdAt, visits: x._count.uses })),
      visits: g.reduce((n, x) => n + x._count.uses, 0),
      createdAt: first.createdAt,
      resolvedLabel: first.resolvedLabel, reviewNote: first.reviewNote, reviewedByName: first.reviewedByName, reviewedAt: first.reviewedAt,
      similar: resolved || !list ? [] : searchEntries(searchable[list] ?? [], first.term, 5).map((c) => ({ id: c.id, label: c.label, category: c.category ?? null })),
    };
  });
  const categories = [...new Set((await db.chiefComplaint.findMany({ where: { active: true }, select: { category: true } })).map((c) => c.category))].sort();
  return NextResponse.json({ requests, categories, targets });
}
