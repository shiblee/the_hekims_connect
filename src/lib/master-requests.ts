import { db } from "@/lib/db";
import { deriveChiefComplaintKey } from "@/lib/chief-complaint-key";
import { isSameTerm, normalizeTerm, parseSynonyms } from "@/lib/complaint-search";

/**
 * Master data that clinicians may need to extend while seeing a patient.
 *
 * Three rules keep the system safe and the lists clean:
 *  1. Never block the clinician — the visit keeps their exact words.
 *  2. Unreviewed terms never drive clinical logic — they live here, not in the
 *     master tables the engines (red flags, CDS, Dalail, humors, supplements) read.
 *  3. One clean master list — an Admin reviewer approves, merges (the term
 *     becomes a synonym) or rejects, and identical requests are resolved together.
 *
 * Each list has a policy. Classical Unani frameworks are closed: they're
 * fixed by the tradition, so no clinic can add to them.
 */
export type ListPolicy = "open" | "request" | "closed";

export const LIST_POLICIES: Record<string, { label: string; policy: ListPolicy }> = {
  chief_complaint: { label: "Chief complaint", policy: "open" },
  // Next to move onto this flow (they take free text today):
  allergy: { label: "Allergy", policy: "open" },
  medication: { label: "Medication / supplement", policy: "request" },
  diagnosis: { label: "Diagnosis (Amraz)", policy: "request" },
  // Fixed by Unani theory — choose only, changed by Admin.
  akhlat: { label: "Humors (Akhlat-e-Arba'a)", policy: "closed" },
  mizaj: { label: "Temperament (Mizaj)", policy: "closed" },
  asbab_sitta: { label: "Asbab-e-Sitta Zaruriya", policy: "closed" },
  umoor_tabiya: { label: "Umoor-e-Tabiya", policy: "closed" },
  red_flag_rules: { label: "Red-flag rules", policy: "closed" },
};

export const REQUEST_LISTS = ["chief_complaint"] as const;
export type RequestListKey = (typeof REQUEST_LISTS)[number];

const MAX_TERM = 80;

/** The approved complaint a term already means (label, bracketed Unani name, local name or synonym), if any. */
export async function findComplaintMatch(term: string) {
  const all = await db.chiefComplaint.findMany({
    where: { active: true },
    select: { id: true, label: true, labelLocal: true, synonyms: true, category: true },
  });
  return all.find((c) => isSameTerm(term, c)) ?? null;
}

export type RequestResult =
  | { kind: "match"; complaint: { id: string; label: string } }
  | { kind: "request"; request: { id: string; term: string; status: string } }
  | { kind: "rejected"; term: string; note: string | null };

/** Clinic asks for a new chief complaint. Returns the existing entry when it already exists. */
export async function requestComplaint(facilityId: string, requestedById: string | null, requestedByName: string, rawTerm: string): Promise<RequestResult | { kind: "invalid" }> {
  const term = rawTerm.trim().replace(/\s+/g, " ").slice(0, MAX_TERM);
  const normalized = normalizeTerm(term);
  if (!normalized || normalized.length < 2) return { kind: "invalid" };

  const match = await findComplaintMatch(term);
  if (match) return { kind: "match", complaint: { id: match.id, label: match.label } };

  const existing = await db.masterDataRequest.findUnique({
    where: { listKey_facilityId_normalized: { listKey: "chief_complaint", facilityId, normalized } },
  });
  if (existing) {
    if (existing.status === "rejected") return { kind: "rejected", term: existing.term, note: existing.reviewNote };
    if ((existing.status === "approved" || existing.status === "merged") && existing.resolvedEntityId) {
      const c = await db.chiefComplaint.findUnique({ where: { id: existing.resolvedEntityId }, select: { id: true, label: true } });
      if (c) return { kind: "match", complaint: c };
    }
    return { kind: "request", request: { id: existing.id, term: existing.term, status: existing.status } };
  }

  const created = await db.masterDataRequest.create({
    data: { listKey: "chief_complaint", term, normalized, facilityId, requestedById, requestedByName },
    select: { id: true, term: true, status: true },
  });
  return { kind: "request", request: created };
}

/** This clinic's pending complaint requests — shown in its search with a "pending review" mark. */
export async function pendingComplaintRequests(facilityId: string) {
  return db.masterDataRequest.findMany({
    where: { listKey: "chief_complaint", facilityId, status: "pending" },
    select: { id: true, term: true, status: true, createdAt: true },
    orderBy: { term: "asc" },
  });
}

/**
 * After a visit's complaint labels are saved: any label that isn't an approved
 * complaint but is one of this clinic's pending requests is recorded against
 * the visit, so approval/merge can re-link it later.
 */
export async function recordComplaintRequestUses(facilityId: string, visitId: string, labels: string[]) {
  if (!labels.length) return;
  const pending = await db.masterDataRequest.findMany({
    where: { listKey: "chief_complaint", facilityId, status: "pending" },
    select: { id: true, normalized: true },
  });
  if (!pending.length) return;
  const byNorm = new Map(pending.map((p) => [p.normalized, p.id]));
  const ids = [...new Set(labels.map((l) => byNorm.get(normalizeTerm(l))).filter((x): x is string => !!x))];
  for (const requestId of ids) {
    await db.masterDataRequestUse.upsert({
      where: { requestId_visitId: { requestId, visitId } },
      update: {},
      create: { requestId, visitId },
    });
  }
}

/** Most-used approved complaints in this clinic (last 180 days) — quick picks before typing. */
export async function frequentComplaintIds(facilityId: string, limit = 8): Promise<string[]> {
  const since = new Date(Date.now() - 180 * 86400_000);
  const intakes = await db.visitIntake.findMany({
    where: { visit: { facilityId }, createdAt: { gte: since } },
    select: { chiefComplaints: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const counts = new Map<string, number>();
  for (const i of intakes) {
    for (const l of parseSynonyms(i.chiefComplaints)) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  if (!counts.size) return [];
  const complaints = await db.chiefComplaint.findMany({ where: { active: true, label: { in: [...counts.keys()] } }, select: { id: true, label: true } });
  return complaints
    .sort((a, b) => (counts.get(b.label) ?? 0) - (counts.get(a.label) ?? 0) || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((c) => c.id);
}

// ---------- Review (Admin) ----------

/** Replace `term` with `label` in a JSON label array, without duplicates. */
function relabel(json: string, term: string, label: string): string | null {
  const labels = parseSynonyms(json);
  const n = normalizeTerm(term);
  if (!labels.some((l) => normalizeTerm(l) === n)) return null;
  const out: string[] = [];
  for (const l of labels) {
    const v = normalizeTerm(l) === n ? label : l;
    if (!out.includes(v)) out.push(v);
  }
  return JSON.stringify(out);
}

/** Point every visit that used these requests at the approved complaint. */
async function relinkVisits(requestIds: string[], terms: string[], complaint: { id: string; label: string }) {
  const uses = await db.masterDataRequestUse.findMany({ where: { requestId: { in: requestIds } }, select: { visitId: true } });
  const visitIds = [...new Set(uses.map((u) => u.visitId))];
  let visits = 0;
  for (const visitId of visitIds) {
    let changed = false;
    const intake = await db.visitIntake.findUnique({ where: { visitId }, select: { id: true, chiefComplaints: true } });
    if (intake) {
      let next = intake.chiefComplaints;
      for (const t of terms) next = relabel(next, t, complaint.label) ?? next;
      if (next !== intake.chiefComplaints) { await db.visitIntake.update({ where: { id: intake.id }, data: { chiefComplaints: next } }); changed = true; }
    }
    const rows = await db.complaintAssessment.findMany({ where: { visitId }, select: { id: true, chiefComplaintLabel: true, chiefComplaintId: true } });
    const norms = new Set(terms.map(normalizeTerm));
    const hasTarget = rows.some((r) => r.chiefComplaintLabel === complaint.label);
    for (const r of rows) {
      if (!norms.has(normalizeTerm(r.chiefComplaintLabel))) continue;
      // If the doctor already has a row for the approved complaint, just link this one; never merge their notes.
      await db.complaintAssessment.update({
        where: { id: r.id },
        data: hasTarget ? { chiefComplaintId: complaint.id } : { chiefComplaintId: complaint.id, chiefComplaintLabel: complaint.label },
      });
      changed = true;
    }
    if (changed) visits++;
  }
  return visits;
}

/** Same term asked for by other clinics — resolved in one go. */
async function siblingsOf(id: string) {
  const r = await db.masterDataRequest.findUnique({ where: { id } });
  if (!r) return null;
  const all = await db.masterDataRequest.findMany({ where: { listKey: r.listKey, normalized: r.normalized, status: "pending" } });
  return { request: r, group: all.some((x) => x.id === r.id) ? all : [r, ...all] };
}

function addSynonyms(existing: string, add: string[], label: string): string {
  const list = parseSynonyms(existing);
  for (const a of add) {
    const t = a.trim();
    if (!t || normalizeTerm(t) === normalizeTerm(label)) continue;
    if (!list.some((l) => normalizeTerm(l) === normalizeTerm(t))) list.push(t);
  }
  return JSON.stringify(list);
}

export type ReviewAction =
  | { action: "approve"; label: string; labelLocal?: string | null; category: string; synonyms?: string[] }
  | { action: "merge"; targetId: string }
  | { action: "reject"; note: string };

export async function reviewRequest(id: string, reviewer: string, input: ReviewAction) {
  const found = await siblingsOf(id);
  if (!found) return { error: "Request not found" as const };
  const { request, group } = found;
  if (request.status !== "pending") return { error: "This request has already been reviewed" as const };
  const ids = group.map((g) => g.id);
  const terms = [...new Set(group.map((g) => g.term))];
  const reviewedAt = new Date();

  if (input.action === "reject") {
    const note = input.note.trim();
    if (!note) return { error: "Give a reason so the clinic knows why" as const };
    await db.masterDataRequest.updateMany({ where: { id: { in: ids } }, data: { status: "rejected", reviewNote: note, reviewedByName: reviewer, reviewedAt } });
    return { ok: true as const, resolved: ids.length, visits: 0 };
  }

  let complaint: { id: string; label: string };
  if (input.action === "merge") {
    const target = await db.chiefComplaint.findUnique({ where: { id: input.targetId } });
    if (!target) return { error: "Choose the complaint to merge into" as const };
    await db.chiefComplaint.update({ where: { id: target.id }, data: { synonyms: addSynonyms(target.synonyms, terms, target.label) } });
    complaint = { id: target.id, label: target.label };
  } else {
    const label = input.label.trim();
    const category = input.category.trim();
    if (!label) return { error: "Enter the complaint name" as const };
    if (!category) return { error: "Choose a category" as const };
    const clash = await findComplaintMatch(label);
    if (clash) return { error: `"${clash.label}" already exists — merge into it instead` as const };
    const key = await deriveChiefComplaintKey(label);
    if (!key) return { error: "Could not derive a key from this name" as const };
    const maxOrder = await db.chiefComplaint.aggregate({ _max: { sortOrder: true } });
    const created = await db.chiefComplaint.create({
      data: {
        key, label, labelLocal: input.labelLocal?.trim() || null, category,
        synonyms: addSynonyms("[]", [...terms, ...(input.synonyms ?? [])], label),
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      select: { id: true, label: true },
    });
    complaint = created;
  }

  await db.masterDataRequest.updateMany({
    where: { id: { in: ids } },
    data: { status: input.action === "merge" ? "merged" : "approved", resolvedEntityId: complaint.id, resolvedLabel: complaint.label, reviewedByName: reviewer, reviewedAt },
  });
  const visits = await relinkVisits(ids, terms, complaint);
  return { ok: true as const, resolved: ids.length, visits, complaint };
}
