import { db } from "@/lib/db";
import { deriveChiefComplaintKey } from "@/lib/chief-complaint-key";
import { isSameTerm, normalizeTerm, parseSynonyms } from "@/lib/complaint-search";

/**
 * Master data that clinicians may need to extend while seeing a patient.
 *
 * Three rules keep the system safe and the lists clean:
 *  1. Never block the clinician — the visit keeps their exact words.
 *  2. Unreviewed words never change what the system *recommends*:
 *     a pending chief complaint drives no rule (red flags, CDS, Dalail, humors,
 *     supplements). For allergies and current medicines the opposite direction is
 *     the safe one — the medicine-safety check reads them by name whether or not
 *     they're listed, because a missed allergy is worse than an extra warning.
 *  3. One clean master list — an Admin reviewer approves, merges (the words
 *     become a synonym) or rejects, and identical requests are resolved together.
 *
 * Classical Unani frameworks are closed: fixed by the tradition, no clinic adds to them.
 */
export type ListPolicy = "open" | "request" | "closed";

export const LIST_POLICIES: Record<string, { label: string; policy: ListPolicy }> = {
  chief_complaint: { label: "Chief complaint", policy: "open" },
  allergy: { label: "Allergy", policy: "open" },
  // What the patient already takes is a fact to record, so it's open; what the
  // doctor *prescribes* stays catalog-only (dossier prescription lines).
  medication: { label: "Current medicine / herb", policy: "open" },
  prescription: { label: "Prescribed medicine", policy: "request" },
  diagnosis: { label: "Diagnosis (Amraz)", policy: "request" },
  // Fixed by Unani theory — choose only, changed by Admin.
  akhlat: { label: "Humors (Akhlat-e-Arba'a)", policy: "closed" },
  mizaj: { label: "Temperament (Mizaj)", policy: "closed" },
  asbab_sitta: { label: "Asbab-e-Sitta Zaruriya", policy: "closed" },
  umoor_tabiya: { label: "Umoor-e-Tabiya", policy: "closed" },
  red_flag_rules: { label: "Red-flag rules", policy: "closed" },
};

export const REQUEST_LISTS = ["chief_complaint", "allergy", "medication"] as const;
export type RequestListKey = (typeof REQUEST_LISTS)[number];
export const isRequestList = (k: unknown): k is RequestListKey => typeof k === "string" && (REQUEST_LISTS as readonly string[]).includes(k);
export type MedKind = "supplement" | "medication";
const medKind = (k: unknown): MedKind => (k === "medication" ? "medication" : "supplement");

const MAX_TERM = 80;

interface MasterEntry { id: string; label: string; labelLocal?: string | null; synonyms: string; kind?: string; category?: string | null }

/** All active entries of a list, in one shape. */
async function masterEntries(listKey: RequestListKey): Promise<MasterEntry[]> {
  if (listKey === "chief_complaint") {
    return db.chiefComplaint.findMany({ where: { active: true }, select: { id: true, label: true, labelLocal: true, synonyms: true, category: true } });
  }
  if (listKey === "allergy") return db.allergyTag.findMany({ where: { active: true }, select: { id: true, label: true, synonyms: true } });
  return db.medicationTag.findMany({ where: { active: true }, select: { id: true, label: true, synonyms: true, kind: true } });
}

/** The approved entry a term already means (name, bracketed name, local name or synonym), if any. */
export async function findMasterMatch(listKey: RequestListKey, term: string, kind?: MedKind) {
  const all = await masterEntries(listKey);
  const hits = all.filter((e) => isSameTerm(term, e));
  // Medicines: prefer the same kind (Unani vs allopathic), but the same name in the other list still counts.
  return (kind && hits.find((h) => h.kind === kind)) || hits[0] || null;
}

/** Back-compat name used by the complaint code. */
export const findComplaintMatch = (term: string) => findMasterMatch("chief_complaint", term);

export type RequestResult =
  | { kind: "match"; entry: { id: string; label: string; kind?: string } }
  | { kind: "request"; request: { id: string; term: string; status: string } }
  | { kind: "rejected"; term: string; note: string | null };

/** Clinic asks for a term to be added. Returns the existing entry when it already exists. */
export async function requestTerm(listKey: RequestListKey, facilityId: string, requestedById: string | null, requestedByName: string, rawTerm: string, rawKind?: unknown): Promise<RequestResult | { kind: "invalid" }> {
  const term = rawTerm.trim().replace(/\s+/g, " ").slice(0, MAX_TERM);
  const normalized = normalizeTerm(term);
  if (!normalized || normalized.length < 2) return { kind: "invalid" };
  const kind = listKey === "medication" ? medKind(rawKind) : undefined;

  const match = await findMasterMatch(listKey, term, kind);
  if (match) return { kind: "match", entry: { id: match.id, label: match.label, kind: match.kind } };

  const existing = await db.masterDataRequest.findUnique({ where: { listKey_facilityId_normalized: { listKey, facilityId, normalized } } });
  if (existing) {
    if (existing.status === "rejected") return { kind: "rejected", term: existing.term, note: existing.reviewNote };
    if ((existing.status === "approved" || existing.status === "merged") && existing.resolvedLabel) {
      return { kind: "match", entry: { id: existing.resolvedEntityId ?? "", label: existing.resolvedLabel } };
    }
    return { kind: "request", request: { id: existing.id, term: existing.term, status: existing.status } };
  }

  const created = await db.masterDataRequest.create({
    data: { listKey, kind: kind ?? null, term, normalized, facilityId, requestedById, requestedByName },
    select: { id: true, term: true, status: true },
  });
  return { kind: "request", request: created };
}

/** Back-compat wrapper for chief complaints. */
export async function requestComplaint(facilityId: string, requestedById: string | null, requestedByName: string, rawTerm: string) {
  const r = await requestTerm("chief_complaint", facilityId, requestedById, requestedByName, rawTerm);
  if (r.kind === "match") return { kind: "match" as const, complaint: { id: r.entry.id, label: r.entry.label } };
  return r;
}

/** This clinic's pending requests for a list — shown in its search with a "pending review" mark. */
export async function pendingRequests(listKey: RequestListKey, facilityId: string) {
  return db.masterDataRequest.findMany({
    where: { listKey, facilityId, status: "pending" },
    select: { id: true, term: true, status: true, kind: true, createdAt: true },
    orderBy: { term: "asc" },
  });
}
export const pendingComplaintRequests = (facilityId: string) => pendingRequests("chief_complaint", facilityId);

/**
 * After a visit is saved: any value that matches one of this clinic's pending
 * requests is recorded against the visit, so approval/merge can re-link it later.
 */
export async function recordRequestUses(listKey: RequestListKey, facilityId: string, visitId: string, labels: string[]) {
  if (!labels.length) return;
  const pending = await db.masterDataRequest.findMany({ where: { listKey, facilityId, status: "pending" }, select: { id: true, normalized: true } });
  if (!pending.length) return;
  const byNorm = new Map(pending.map((p) => [p.normalized, p.id]));
  const ids = [...new Set(labels.map((l) => byNorm.get(normalizeTerm(l))).filter((x): x is string => !!x))];
  for (const requestId of ids) {
    await db.masterDataRequestUse.upsert({ where: { requestId_visitId: { requestId, visitId } }, update: {}, create: { requestId, visitId } });
  }
}
export const recordComplaintRequestUses = (facilityId: string, visitId: string, labels: string[]) =>
  recordRequestUses("chief_complaint", facilityId, visitId, labels);

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
  for (const i of intakes) for (const l of parseSynonyms(i.chiefComplaints)) counts.set(l, (counts.get(l) ?? 0) + 1);
  if (!counts.size) return [];
  const complaints = await db.chiefComplaint.findMany({ where: { active: true, label: { in: [...counts.keys()] } }, select: { id: true, label: true } });
  return complaints
    .sort((a, b) => (counts.get(b.label) ?? 0) - (counts.get(a.label) ?? 0) || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((c) => c.id);
}

// ---------- Review (Admin) ----------

/** Replace `terms` with `label` in a JSON string array, without duplicates. Null when nothing changed. */
function relabelStrings(json: string, terms: string[], label: string): string | null {
  const labels = parseSynonyms(json);
  const norms = new Set(terms.map(normalizeTerm));
  if (!labels.some((l) => norms.has(normalizeTerm(l)))) return null;
  const out: string[] = [];
  for (const l of labels) {
    const v = norms.has(normalizeTerm(l)) ? label : l;
    if (!out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return JSON.stringify(out);
}

/** Same for the intake medicines list ([{ label, kind }]). */
function relabelMedicines(json: string, terms: string[], label: string, kind: string): string | null {
  let list: { label: string; kind: string }[] = [];
  try { const v = JSON.parse(json || "[]"); if (Array.isArray(v)) list = v.filter((m) => m && typeof m.label === "string"); } catch { return null; }
  const norms = new Set(terms.map(normalizeTerm));
  if (!list.some((m) => norms.has(normalizeTerm(m.label)))) return null;
  const out: { label: string; kind: string }[] = [];
  for (const m of list) {
    const v = norms.has(normalizeTerm(m.label)) ? { label, kind } : m;
    if (!out.some((o) => o.kind === v.kind && o.label.toLowerCase() === v.label.toLowerCase())) out.push(v);
  }
  return JSON.stringify(out);
}

/** Point every visit that used these requests at the approved entry. */
async function relinkVisits(listKey: RequestListKey, requestIds: string[], terms: string[], entry: { id: string; label: string; kind?: string }) {
  const uses = await db.masterDataRequestUse.findMany({ where: { requestId: { in: requestIds } }, select: { visitId: true } });
  const visitIds = [...new Set(uses.map((u) => u.visitId))];
  let visits = 0;
  for (const visitId of visitIds) {
    let changed = false;
    const intake = await db.visitIntake.findUnique({ where: { visitId }, select: { id: true, chiefComplaints: true, allergies: true, medications: true } });
    if (intake) {
      const data: Record<string, string> = {};
      if (listKey === "chief_complaint") { const n = relabelStrings(intake.chiefComplaints, terms, entry.label); if (n) data.chiefComplaints = n; }
      if (listKey === "allergy") { const n = relabelStrings(intake.allergies, terms, entry.label); if (n) data.allergies = n; }
      if (listKey === "medication") { const n = relabelMedicines(intake.medications, terms, entry.label, entry.kind ?? "supplement"); if (n) data.medications = n; }
      if (Object.keys(data).length) { await db.visitIntake.update({ where: { id: intake.id }, data }); changed = true; }
    }
    if (listKey === "chief_complaint") {
      const rows = await db.complaintAssessment.findMany({ where: { visitId }, select: { id: true, chiefComplaintLabel: true } });
      const norms = new Set(terms.map(normalizeTerm));
      const hasTarget = rows.some((r) => r.chiefComplaintLabel === entry.label);
      for (const r of rows) {
        if (!norms.has(normalizeTerm(r.chiefComplaintLabel))) continue;
        // If the doctor already has a row for the approved complaint, just link this one; never merge their notes.
        await db.complaintAssessment.update({
          where: { id: r.id },
          data: hasTarget ? { chiefComplaintId: entry.id } : { chiefComplaintId: entry.id, chiefComplaintLabel: entry.label },
        });
        changed = true;
      }
    }
    if (changed) visits++;
  }
  return visits;
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
  | { action: "approve"; label: string; labelLocal?: string | null; category?: string; kind?: string; synonyms?: string[] }
  | { action: "merge"; targetId: string }
  | { action: "reject"; note: string };

/** Merge targets for the review dialog. */
export async function reviewTargets(listKey: RequestListKey) {
  const all = await masterEntries(listKey);
  return all.map((e) => ({ id: e.id, label: e.label, group: e.category ?? (e.kind === "medication" ? "Allopathic" : e.kind ? "Unani" : null) }));
}

export async function reviewRequest(id: string, reviewer: string, input: ReviewAction) {
  const request = await db.masterDataRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found" as const };
  if (request.status !== "pending") return { error: "This request has already been reviewed" as const };
  if (!isRequestList(request.listKey)) return { error: "Unknown list" as const };
  const listKey = request.listKey;
  // The same words from other clinics are resolved in one go.
  const group = await db.masterDataRequest.findMany({ where: { listKey, normalized: request.normalized, status: "pending" } });
  const ids = group.map((g) => g.id);
  const terms = [...new Set(group.map((g) => g.term))];
  const reviewedAt = new Date();

  if (input.action === "reject") {
    const note = input.note.trim();
    if (!note) return { error: "Give a reason so the clinic knows why" as const };
    await db.masterDataRequest.updateMany({ where: { id: { in: ids } }, data: { status: "rejected", reviewNote: note, reviewedByName: reviewer, reviewedAt } });
    return { ok: true as const, resolved: ids.length, visits: 0 };
  }

  let entry: { id: string; label: string; kind?: string };
  if (input.action === "merge") {
    if (listKey === "chief_complaint") {
      const t = await db.chiefComplaint.findUnique({ where: { id: input.targetId } });
      if (!t) return { error: "Choose the entry to merge into" as const };
      await db.chiefComplaint.update({ where: { id: t.id }, data: { synonyms: addSynonyms(t.synonyms, terms, t.label) } });
      entry = { id: t.id, label: t.label };
    } else if (listKey === "allergy") {
      const t = await db.allergyTag.findUnique({ where: { id: input.targetId } });
      if (!t) return { error: "Choose the entry to merge into" as const };
      await db.allergyTag.update({ where: { id: t.id }, data: { synonyms: addSynonyms(t.synonyms, terms, t.label) } });
      entry = { id: t.id, label: t.label };
    } else {
      const t = await db.medicationTag.findUnique({ where: { id: input.targetId } });
      if (!t) return { error: "Choose the entry to merge into" as const };
      await db.medicationTag.update({ where: { id: t.id }, data: { synonyms: addSynonyms(t.synonyms, terms, t.label) } });
      entry = { id: t.id, label: t.label, kind: t.kind };
    }
  } else {
    const label = input.label.trim();
    if (!label) return { error: "Enter the name" as const };
    const kind = listKey === "medication" ? medKind(input.kind ?? request.kind) : undefined;
    const clash = await findMasterMatch(listKey, label, kind);
    if (clash && (listKey !== "medication" || clash.kind === kind)) return { error: `"${clash.label}" already exists — merge into it instead` as const };
    const synonyms = addSynonyms("[]", [...terms, ...(input.synonyms ?? [])], label);
    if (listKey === "chief_complaint") {
      const category = (input.category ?? "").trim();
      if (!category) return { error: "Choose a category" as const };
      const key = await deriveChiefComplaintKey(label);
      if (!key) return { error: "Could not derive a key from this name" as const };
      const max = await db.chiefComplaint.aggregate({ _max: { sortOrder: true } });
      entry = await db.chiefComplaint.create({
        data: { key, label, labelLocal: input.labelLocal?.trim() || null, category, synonyms, sortOrder: (max._max.sortOrder ?? -1) + 1 },
        select: { id: true, label: true },
      });
    } else if (listKey === "allergy") {
      const max = await db.allergyTag.aggregate({ _max: { sortOrder: true } });
      entry = await db.allergyTag.create({ data: { label, synonyms, sortOrder: (max._max.sortOrder ?? -1) + 1 }, select: { id: true, label: true } });
    } else {
      const max = await db.medicationTag.aggregate({ _max: { sortOrder: true } });
      const created = await db.medicationTag.create({ data: { kind: kind!, label, synonyms, sortOrder: (max._max.sortOrder ?? -1) + 1 }, select: { id: true, label: true, kind: true } });
      entry = created;
    }
  }

  await db.masterDataRequest.updateMany({
    where: { id: { in: ids } },
    data: { status: input.action === "merge" ? "merged" : "approved", resolvedEntityId: entry.id, resolvedLabel: entry.label, reviewedByName: reviewer, reviewedAt },
  });
  const visits = await relinkVisits(listKey, ids, terms, entry);
  return { ok: true as const, resolved: ids.length, visits, complaint: entry, entry };
}
