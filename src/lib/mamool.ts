import { db } from "@/lib/db";
import { normalizeTerm, parseSynonyms } from "@/lib/complaint-search";

/**
 * Mamool-e-Matab — Treatment Regimens.
 *
 * A regimen is a clinical *template*, never a prescription: applying one adds its
 * medicines as separate, editable lines; the treating Hakim reviews and confirms.
 * Working copy (draft → pending → approved | rejected) is edited by Admin; each
 * approval freezes a snapshot (MamoolRegimenVersion) and doctors only ever see
 * the latest approved snapshot of an active regimen.
 */

export const REGIMEN_STATUSES = ["draft", "pending", "approved", "rejected"] as const;
export type RegimenStatus = (typeof REGIMEN_STATUSES)[number];

export interface RegimenMedicineInput {
  tagId: string; form?: string | null; dose?: string | null; timing?: string | null; duration?: string | null;
  adjuvant?: string | null; instructions?: string | null; notes?: string | null;
}
export interface RegimenInput {
  name: string; description?: string | null; clinicalNotes?: string | null;
  complaints: { complaintId: string; required?: boolean }[];
  medicines: RegimenMedicineInput[];
}

export interface SnapshotMedicine { tagId: string; name: string; kind: string; form: string; dose: string; timing: string; duration: string; adjuvant: string; instructions: string; notes: string }
export interface RegimenSnapshot {
  name: string; description: string | null; clinicalNotes: string | null;
  complaints: { id: string; label: string; required: boolean }[];
  medicines: SnapshotMedicine[];
}

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Clean and check an admin's input against the real masters. Returns errors in plain words. */
export async function validateRegimenInput(raw: any): Promise<{ input?: RegimenInput; error?: string }> {
  const name = s(raw?.name, 160);
  if (!name) return { error: "Enter the regimen name" };
  const complaints = (Array.isArray(raw?.complaints) ? raw.complaints : [])
    .filter((c: any) => typeof c?.complaintId === "string")
    .map((c: any) => ({ complaintId: c.complaintId as string, required: !!c.required }));
  const uniqC = [...new Map(complaints.map((c: { complaintId: string; required: boolean }) => [c.complaintId, c])).values()] as { complaintId: string; required: boolean }[];
  const medicines: RegimenMedicineInput[] = (Array.isArray(raw?.medicines) ? raw.medicines : [])
    .filter((m: any) => typeof m?.tagId === "string")
    .slice(0, 40)
    .map((m: any) => ({
      tagId: m.tagId, form: s(m.form, 80), dose: s(m.dose, 120), timing: s(m.timing, 120), duration: s(m.duration, 80),
      adjuvant: s(m.adjuvant, 160), instructions: s(m.instructions, 1000), notes: s(m.notes, 1000),
    }));

  // Only real master rows — no new complaints or medicines are ever created here.
  if (uniqC.length) {
    const found = await db.chiefComplaint.count({ where: { id: { in: uniqC.map((c) => c.complaintId) } } });
    if (found !== uniqC.length) return { error: "One of the complaints no longer exists — reload and choose again" };
  }
  if (medicines.length) {
    const ids = [...new Set(medicines.map((m) => m.tagId))];
    const found = await db.medicationTag.count({ where: { id: { in: ids }, kind: { in: ["supplement", "medication"] } } });
    if (found !== ids.length) return { error: "One of the medicines isn't in the medicine list — reload and choose again" };
  }
  return { input: { name, description: s(raw?.description, 2000), clinicalNotes: s(raw?.clinicalNotes, 4000), complaints: uniqC, medicines } };
}

/** What's needed before a regimen can go for clinical approval. */
export function readinessProblems(r: { complaints: unknown[]; medicines: { dose?: string | null; timing?: string | null }[] }): string[] {
  const p: string[] = [];
  if (!r.complaints.length) p.push("Link at least one chief complaint");
  if (!r.medicines.length) p.push("Add at least one medicine");
  return p;
}

export async function nextRegimenCode(): Promise<string> {
  const last = await db.mamoolRegimen.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const n = last ? parseInt(last.code.replace(/\D/g, ""), 10) || 0 : 0;
  return `MM-${String(n + 1).padStart(4, "0")}`;
}

/** Freeze the working copy as it is now (used on approval). */
export async function buildSnapshot(regimenId: string): Promise<RegimenSnapshot | null> {
  const r = await db.mamoolRegimen.findUnique({
    where: { id: regimenId },
    include: {
      complaints: { include: { complaint: { select: { id: true, label: true } } } },
      medicines: { orderBy: { sortOrder: "asc" }, include: { tag: { select: { label: true, kind: true } } } },
    },
  });
  if (!r) return null;
  return {
    name: r.name, description: r.description, clinicalNotes: r.clinicalNotes,
    complaints: r.complaints.map((c) => ({ id: c.complaint.id, label: c.complaint.label, required: c.required })).sort((a, b) => a.label.localeCompare(b.label)),
    medicines: r.medicines.map((m) => ({
      tagId: m.tagId, name: m.tag.label, kind: m.tag.kind, form: m.form ?? "", dose: m.dose ?? "", timing: m.timing ?? "",
      duration: m.duration ?? "", adjuvant: m.adjuvant ?? "", instructions: m.instructions ?? "", notes: m.notes ?? "",
    })),
  };
}

export function parseSnapshot(raw: string): RegimenSnapshot | null {
  try { return JSON.parse(raw) as RegimenSnapshot; } catch { return null; }
}

// ---------- Doctor side ----------

/** The chief complaints on this visit, as master ids (doctor's list first, then reception's). */
export async function visitComplaintIds(visitId: string): Promise<string[]> {
  const [rows, intake] = await Promise.all([
    db.complaintAssessment.findMany({ where: { visitId }, select: { chiefComplaintId: true, chiefComplaintLabel: true } }),
    db.visitIntake.findUnique({ where: { visitId }, select: { chiefComplaints: true } }),
  ]);
  const ids = new Set(rows.map((r) => r.chiefComplaintId).filter((x): x is string => !!x));
  const labels = [...rows.filter((r) => !r.chiefComplaintId).map((r) => r.chiefComplaintLabel), ...parseSynonyms(intake?.chiefComplaints)];
  if (labels.length) {
    const want = new Set(labels.map(normalizeTerm));
    const all = await db.chiefComplaint.findMany({ select: { id: true, label: true } });
    for (const c of all) if (want.has(normalizeTerm(c.label))) ids.add(c.id);
  }
  return [...ids];
}

export interface RegimenMatch { matched: string[]; missingRequired: string[]; suggested: boolean }

/**
 * Why a regimen is (or isn't) suggested for these complaints.
 * Default: one matching complaint is enough ("any"). If the regimen marks some
 * complaints as required, all required ones must be present ("all required").
 */
export function matchRegimen(snap: RegimenSnapshot, complaintIds: string[]): RegimenMatch {
  const have = new Set(complaintIds);
  const matched = snap.complaints.filter((c) => have.has(c.id)).map((c) => c.label);
  const required = snap.complaints.filter((c) => c.required);
  const missingRequired = required.filter((c) => !have.has(c.id)).map((c) => c.label);
  const suggested = required.length ? missingRequired.length === 0 : matched.length > 0;
  return { matched, missingRequired, suggested };
}

/** Approved, active regimens (their approved snapshots) with match info for a visit. */
export async function regimensForVisit(visitId: string | null) {
  const [complaintIds, regimens] = await Promise.all([
    visitId ? visitComplaintIds(visitId) : Promise.resolve([] as string[]),
    db.mamoolRegimen.findMany({
      where: { active: true, approvedVersion: { not: null } },
      select: { id: true, code: true, approvedVersion: true, versions: { select: { version: true, snapshot: true, approvedByName: true, createdAt: true } } },
    }),
  ]);
  // Medicines withdrawn from the master since approval are flagged, never silently applied.
  const tagIds = new Set<string>();
  const out = regimens.flatMap((r) => {
    const v = r.versions.find((x) => x.version === r.approvedVersion);
    const snap = v ? parseSnapshot(v.snapshot) : null;
    if (!v || !snap) return [];
    snap.medicines.forEach((m) => tagIds.add(m.tagId));
    return [{ id: r.id, code: r.code, version: v.version, approvedByName: v.approvedByName, approvedAt: v.createdAt, ...snap, match: matchRegimen(snap, complaintIds) }];
  });
  const active = new Set((await db.medicationTag.findMany({ where: { id: { in: [...tagIds] }, active: true }, select: { id: true } })).map((t) => t.id));
  const withAvailability = out.map((r) => ({ ...r, medicines: r.medicines.map((m) => ({ ...m, available: active.has(m.tagId) })) }));
  // Suggested first (more matching complaints first), then the rest A–Z.
  withAvailability.sort((a, b) => Number(b.match.suggested) - Number(a.match.suggested) || b.match.matched.length - a.match.matched.length || a.name.localeCompare(b.name));
  return { complaintIds, regimens: withAvailability };
}
