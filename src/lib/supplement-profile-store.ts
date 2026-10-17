import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Read/write helpers for the search-backed catalog profiles — Unani
// Supplements & Herbs (MedicationTag kind "supplement") and allopathic
// Medications (kind "medication") share one profile model: serialization for
// the admin UI, revision snapshots (compare + restore), completeness scoring
// and the data-quality report.

type Tx = Prisma.TransactionClient;

export const parseJson = <T = any>(s: string | null | undefined, fallback: T): T => {
  try { return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};

export const PROFILE_CATEGORIES = [
  "Single Herb (Mufrad)", "Compound Formulation (Murakkab)", "Mineral (Ma'dani)",
  "Animal-derived (Haiwani)", "Oil (Roghan)", "Nutritional Supplement",
] as const;

export type ProfileKind = "supplement" | "medication";

export const MEDICATION_CATEGORIES = [
  "Single-ingredient medicine", "Fixed-dose combination", "Biologic / Insulin", "Vitamin / Mineral preparation",
] as const;

/** Scalar fields stored directly on SupplementProfile — Supplements & Herbs. */
export const SCALAR_FIELDS = [
  "herbType", "unaniName", "englishName", "urduName", "hindiName", "arabicName", "botanicalName", "family",
  "partsUsed", "mizaj", "preparation", "summary", "traditionalDescription", "modernEvidence",
] as const;
/** JSON-array fields stored on SupplementProfile — Supplements & Herbs. */
export const LIST_FIELDS = ["synonyms", "actions", "dosageForms", "routes", "brands"] as const;

/** Allopathic medication fields ("herbType" holds the medication category). */
export const MED_SCALAR_FIELDS = [
  "herbType", "genericName", "saltForm", "therapeuticClass", "pharmacologicalClass", "mechanism",
  "atcCode", "rxStatus", "productStatus", "summary",
] as const;
export const MED_LIST_FIELDS = ["synonyms", "strengths", "dosageForms", "routes", "brands"] as const;

export const ALL_SCALAR_FIELDS = [...new Set([...SCALAR_FIELDS, ...MED_SCALAR_FIELDS])];
export const ALL_LIST_FIELDS = [...new Set([...LIST_FIELDS, ...MED_LIST_FIELDS])];
export type ProfileField = (typeof SCALAR_FIELDS)[number] | (typeof LIST_FIELDS)[number] | (typeof MED_SCALAR_FIELDS)[number] | (typeof MED_LIST_FIELDS)[number];

export const fieldsFor = (kind: string) =>
  kind === "medication"
    ? { scalar: MED_SCALAR_FIELDS as readonly string[], list: MED_LIST_FIELDS as readonly string[], categories: MEDICATION_CATEGORIES as readonly string[] }
    : { scalar: SCALAR_FIELDS as readonly string[], list: LIST_FIELDS as readonly string[], categories: PROFILE_CATEGORIES as readonly string[] };

export const SAFETY_TOPICS = ["pregnancy", "lactation", "pediatric", "interactions", "allergy"] as const;

const RELATION_INCLUDE = {
  complaints: { include: { complaint: { select: { id: true, label: true, active: true } } } },
  allergies: { include: { allergy: { select: { id: true, label: true, active: true } } } },
  symptoms: { include: { symptom: { select: { id: true, label: true, active: true } } } },
  ingredients: { include: { ingredientTag: { select: { id: true, label: true } } } },
  safetyItems: { include: { medication: { select: { id: true, label: true } } } },
  fieldReviews: true,
  citations: { include: { source: true } },
  tag: { select: { kind: true } },
} satisfies Prisma.SupplementProfileInclude;

export type FullProfile = Prisma.SupplementProfileGetPayload<{ include: typeof RELATION_INCLUDE }>;

export function loadFullProfile(where: Prisma.SupplementProfileWhereUniqueInput, tx: Tx | typeof db = db) {
  return tx.supplementProfile.findUnique({ where, include: RELATION_INCLUDE });
}

// ---------------------------------------------------------------- completeness

/**
 * % of the fields that apply to this item's type that are filled. A field the
 * search explicitly found "not documented" still counts as missing — the
 * score measures how much is known, never how accurate it is.
 */
export function computeCompleteness(p: FullProfile): number {
  if (p.tag.kind === "medication") return computeMedicationCompleteness(p);
  const type = p.herbType || "";
  const isHerb = type.startsWith("Single Herb");
  const isCompound = type.startsWith("Compound");
  const isNutritional = type === "Nutritional Supplement";
  const live = <T extends { verificationStatus: string }>(rows: T[]) => rows.filter((r) => r.verificationStatus !== "rejected");
  const safetyCats = new Set(live(p.safetyItems).map((s) => s.category));
  const unknown = new Set(parseJson<string[]>(p.unknownFields, []));
  const has = (v: string | null | undefined) => !!v && !!v.trim();
  const hasList = (v: string) => parseJson<unknown[]>(v, []).length > 0;

  const checks: boolean[] = [
    has(p.herbType), has(p.englishName), has(p.summary), has(p.modernEvidence),
    hasList(p.actions), hasList(p.dosageForms), hasList(p.routes),
    live(p.complaints).length > 0,
    // Each safety topic counts as covered once it's either documented or
    // explicitly recorded as "not documented" — both are real information.
    ...(["pregnancy", "lactation", "pediatric"] as const).map((t) => safetyCats.has(t) || unknown.has(t)),
    p.citations.length > 0,
  ];
  if (!isNutritional) checks.push(has(p.unaniName), has(p.urduName), has(p.mizaj), has(p.traditionalDescription));
  if (isHerb) checks.push(has(p.botanicalName), has(p.family), has(p.partsUsed));
  if (isCompound) checks.push(live(p.ingredients).length > 0);
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function computeMedicationCompleteness(p: FullProfile): number {
  const live = <T extends { verificationStatus: string }>(rows: T[]) => rows.filter((r) => r.verificationStatus !== "rejected");
  const safetyCats = new Set(live(p.safetyItems).map((s) => s.category));
  const unknown = new Set(parseJson<string[]>(p.unknownFields, []));
  const has = (v: string | null | undefined) => !!v && !!v.trim();
  const hasList = (v: string) => parseJson<unknown[]>(v, []).length > 0;
  const covered = (t: string, cat = t) => safetyCats.has(cat) || unknown.has(t);
  const isVitamin = (p.herbType || "").startsWith("Vitamin");

  const checks: boolean[] = [
    has(p.herbType), has(p.genericName), has(p.therapeuticClass), has(p.mechanism), has(p.summary), has(p.rxStatus),
    hasList(p.strengths), hasList(p.dosageForms), hasList(p.routes),
    live(p.ingredients).some((i) => i.role !== "excipient"),
    live(p.complaints).length > 0,
    safetyCats.has("contraindication") || safetyCats.has("warning"),
    safetyCats.has("adverse_effect"),
    ...["pregnancy", "lactation", "pediatric", "renal", "hepatic"].map((t) => covered(t)),
    covered("interactions", "interaction"),
    p.citations.length > 0,
  ];
  // ATC codes and pharmacological class are not meaningful for every vitamin/mineral preparation.
  if (!isVitamin) checks.push(has(p.atcCode), has(p.pharmacologicalClass));
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function refreshCompleteness(profileId: string, tx: Tx | typeof db = db) {
  const p = await loadFullProfile({ id: profileId }, tx);
  if (!p) return;
  await tx.supplementProfile.update({ where: { id: profileId }, data: { completeness: computeCompleteness(p) } });
}

// ---------------------------------------------------------------- snapshots

const PROVENANCE_KEYS = ["rationale", "evidenceType", "verificationStatus", "confidence", "provenance", "reviewedById", "reviewedAt", "reviewNote"] as const;
interface ProvSnapshot {
  rationale: string | null; evidenceType: string; verificationStatus: string; confidence: number | null;
  provenance: string; reviewedById: string | null; reviewedAt: Date | null; reviewNote: string | null;
}
const pickProv = (r: any): ProvSnapshot => Object.fromEntries(PROVENANCE_KEYS.map((k) => [k, r[k] ?? null])) as unknown as ProvSnapshot;

/** Everything needed to rebuild the profile exactly — field values, every relationship and its citations. */
function toSnapshot(p: FullProfile) {
  const fields = Object.fromEntries([...ALL_SCALAR_FIELDS, ...ALL_LIST_FIELDS, "cautions", "keyIngredients", "unmatchedUses", "unknownFields"].map((f) => [f, (p as any)[f]]));
  return {
    v: 1,
    status: p.status, enrichmentVersion: p.enrichmentVersion, enrichedAt: p.enrichedAt, fields,
    complaints: p.complaints.map((r) => ({ key: r.id, complaintId: r.complaintId, label: r.complaint.label, relationType: r.relationType, ...pickProv(r) })),
    allergies: p.allergies.map((r) => ({ key: r.id, allergyId: r.allergyId, relation: r.relation, label: r.allergy.label, ...pickProv(r) })),
    symptoms: p.symptoms.map((r) => ({ key: r.id, symptomId: r.symptomId, label: r.symptom.label, ...pickProv(r) })),
    ingredients: p.ingredients.map((r) => ({ key: r.id, name: r.name, ingredientTagId: r.ingredientTagId, role: r.role, proportion: r.proportion, ...pickProv(r) })),
    safetyItems: p.safetyItems.map((r) => ({ key: r.id, category: r.category, text: r.text, severity: r.severity, medicationTagId: r.medicationTagId, ...pickProv(r) })),
    fieldReviews: p.fieldReviews.map((r) => ({
      field: r.field, verificationStatus: r.verificationStatus, confidence: r.confidence, evidenceType: r.evidenceType,
      provenance: r.provenance, note: r.note, reviewedById: r.reviewedById, reviewedAt: r.reviewedAt,
    })),
    citations: p.citations.map((c) => ({ url: c.source.url, title: c.source.title, domain: c.source.domain, subjectType: c.subjectType, subjectKey: c.subjectKey, snippet: c.snippet })),
  };
}
export type ProfileSnapshot = ReturnType<typeof toSnapshot>;

/** Saves the profile's current state as a revision (call BEFORE changing it). */
export async function snapshotProfile(tx: Tx, profileId: string, reason: string, summary: string | null, actorId: string | null) {
  const p = await loadFullProfile({ id: profileId }, tx);
  if (!p) return;
  await tx.supplementProfileRevision.create({
    data: { profileId, reason, summary, actorId, snapshot: JSON.stringify(toSnapshot(p)) },
  });
}

export async function upsertSource(tx: Tx, url: string, title: string | null) {
  let domain = "";
  try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep empty */ }
  return tx.evidenceSource.upsert({
    where: { url },
    update: { lastSeenAt: new Date(), ...(title ? { title } : {}) },
    create: { url, title, domain: domain || title || url },
  });
}

/** Replaces the profile's fields, relationships and citations with a snapshot's. */
export async function restoreSnapshot(tx: Tx, profileId: string, snap: ProfileSnapshot) {
  const DATE_KEYS = new Set(["reviewedAt"]);
  const prov = (r: any) => Object.fromEntries(PROVENANCE_KEYS.map((k) => [k, DATE_KEYS.has(k) && r[k] ? new Date(r[k]) : r[k] ?? null])) as any;
  const keep = <T extends Record<string, any>>(r: T) => ({ ...prov(r), evidenceType: r.evidenceType ?? "traditional", verificationStatus: r.verificationStatus ?? "unverified", provenance: r.provenance ?? "legacy" });

  await tx.supplementProfile.update({
    where: { id: profileId },
    data: { ...(snap.fields as any), status: snap.status, enrichmentVersion: snap.enrichmentVersion, enrichedAt: snap.enrichedAt ? new Date(snap.enrichedAt) : null },
  });
  await Promise.all([
    tx.supplementComplaintLink.deleteMany({ where: { profileId } }),
    tx.supplementAllergyLink.deleteMany({ where: { profileId } }),
    tx.supplementSymptomLink.deleteMany({ where: { profileId } }),
    tx.supplementIngredient.deleteMany({ where: { profileId } }),
    tx.supplementSafetyItem.deleteMany({ where: { profileId } }),
    tx.supplementFieldReview.deleteMany({ where: { profileId } }),
    tx.supplementCitation.deleteMany({ where: { profileId } }),
  ]);

  // Old row id -> new row id, so relationship citations follow their rows.
  const keyMap = new Map<string, string>();
  // Catalog rows deleted since the snapshot are skipped rather than failing the restore.
  const [complaintIds, allergyIds, symptomIds, tagIds] = await Promise.all([
    tx.chiefComplaint.findMany({ where: { id: { in: snap.complaints.map((r) => r.complaintId) } }, select: { id: true } }),
    tx.allergyTag.findMany({ where: { id: { in: snap.allergies.map((r) => r.allergyId) } }, select: { id: true } }),
    tx.acuteSymptomTag.findMany({ where: { id: { in: snap.symptoms.map((r) => r.symptomId) } }, select: { id: true } }),
    tx.medicationTag.findMany({
      where: { id: { in: [...snap.ingredients.map((r) => r.ingredientTagId), ...snap.safetyItems.map((r) => r.medicationTagId)].filter((x): x is string => !!x) } },
      select: { id: true },
    }),
  ]);
  const exists = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
  const [cOk, aOk, sOk, tOk] = [exists(complaintIds), exists(allergyIds), exists(symptomIds), exists(tagIds)];

  for (const r of snap.complaints) if (cOk.has(r.complaintId)) keyMap.set(r.key, (await tx.supplementComplaintLink.create({ data: { profileId, complaintId: r.complaintId, relationType: r.relationType ?? "traditional_use", ...keep(r) } })).id);
  for (const r of snap.allergies) if (aOk.has(r.allergyId)) keyMap.set(r.key, (await tx.supplementAllergyLink.create({ data: { profileId, allergyId: r.allergyId, relation: r.relation, ...keep(r) } })).id);
  for (const r of snap.symptoms) if (sOk.has(r.symptomId)) keyMap.set(r.key, (await tx.supplementSymptomLink.create({ data: { profileId, symptomId: r.symptomId, ...keep(r) } })).id);
  for (const r of snap.ingredients) {
    keyMap.set(r.key, (await tx.supplementIngredient.create({
      data: { profileId, name: r.name, role: r.role, proportion: r.proportion, ingredientTagId: r.ingredientTagId && tOk.has(r.ingredientTagId) ? r.ingredientTagId : null, ...keep(r) },
    })).id);
  }
  for (const r of snap.safetyItems) {
    keyMap.set(r.key, (await tx.supplementSafetyItem.create({
      data: { profileId, category: r.category, text: r.text, severity: r.severity, medicationTagId: r.medicationTagId && tOk.has(r.medicationTagId) ? r.medicationTagId : null, ...keep(r) },
    })).id);
  }
  for (const r of snap.fieldReviews) {
    await tx.supplementFieldReview.create({
      data: { profileId, field: r.field, verificationStatus: r.verificationStatus, confidence: r.confidence, evidenceType: r.evidenceType, provenance: r.provenance, note: r.note, reviewedById: r.reviewedById, reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null },
    });
  }
  for (const c of snap.citations) {
    const subjectKey = c.subjectType === "field" ? c.subjectKey : keyMap.get(c.subjectKey);
    if (!subjectKey) continue;
    const source = await upsertSource(tx, c.url, c.title);
    await tx.supplementCitation.upsert({
      where: { profileId_sourceId_subjectType_subjectKey: { profileId, sourceId: source.id, subjectType: c.subjectType, subjectKey } },
      update: {},
      create: { profileId, sourceId: source.id, subjectType: c.subjectType, subjectKey, snippet: c.snippet },
    });
  }
  await refreshCompleteness(profileId, tx);
}

// ---------------------------------------------------------------- admin view

/** Shapes a full profile for the admin profile dialog. */
export function serializeProfile(p: FullProfile) {
  const sourceIndex = new Map<string, number>();
  const sources: { n: number; url: string; title: string | null; domain: string }[] = [];
  const refsFor = (subjectType: string, subjectKey: string) =>
    p.citations
      .filter((c) => c.subjectType === subjectType && c.subjectKey === subjectKey)
      .map((c) => {
        let n = sourceIndex.get(c.sourceId);
        if (!n) {
          n = sources.length + 1;
          sourceIndex.set(c.sourceId, n);
          sources.push({ n, url: c.source.url, title: c.source.title, domain: c.source.domain });
        }
        return { n, snippet: c.snippet };
      });
  const reviewOf = (field: string) => p.fieldReviews.find((r) => r.field === field);
  const relProv = (r: any) => ({
    id: r.id, rationale: r.rationale, evidenceType: r.evidenceType, verificationStatus: r.verificationStatus,
    confidence: r.confidence, provenance: r.provenance, reviewedAt: r.reviewedAt, reviewNote: r.reviewNote,
  });

  const field = (name: string, value: unknown) => {
    const rv = reviewOf(name);
    return {
      field: name, value,
      verificationStatus: rv?.verificationStatus ?? "unverified",
      confidence: rv?.confidence ?? null,
      provenance: rv?.provenance ?? (p.enrichmentVersion >= 2 ? "search" : "legacy"),
      note: rv?.note ?? null,
      refs: refsFor("field", name),
    };
  };

  const kind = p.tag.kind;
  const spec = fieldsFor(kind);
  const fields = [
    ...spec.scalar.map((f) => field(f, (p as any)[f] ?? null)),
    ...spec.list.map((f) => field(f, parseJson((p as any)[f], []))),
  ];

  return {
    kind,
    status: p.status, errorMessage: p.errorMessage, enrichedAt: p.enrichedAt,
    enrichmentVersion: p.enrichmentVersion, completeness: p.completeness,
    category: p.herbType, unknownFields: parseJson<string[]>(p.unknownFields, []),
    legacyCautions: p.enrichmentVersion < 2 ? parseJson<string[]>(p.cautions, []) : [],
    legacyIngredients: p.enrichmentVersion < 2 ? parseJson<string[]>(p.keyIngredients, []) : [],
    unmatchedUses: parseJson<string[]>(p.unmatchedUses, []),
    fields,
    complaints: p.complaints.map((r) => ({ ...relProv(r), label: r.complaint.label, relationType: r.relationType, targetActive: r.complaint.active, refs: refsFor("complaint", r.id) })),
    symptoms: p.symptoms.map((r) => ({ ...relProv(r), label: r.symptom.label, targetActive: r.symptom.active, refs: refsFor("symptom", r.id) })),
    allergies: p.allergies.map((r) => ({ ...relProv(r), label: r.allergy.label, relation: r.relation, targetActive: r.allergy.active, refs: refsFor("allergy", r.id) })),
    ingredients: p.ingredients.map((r) => ({ ...relProv(r), label: r.name, linkedTag: r.ingredientTag, role: r.role, proportion: r.proportion, refs: refsFor("ingredient", r.id) })),
    safety: p.safetyItems.map((r) => ({ ...relProv(r), label: r.text, category: r.category, severity: r.severity, medication: r.medication, refs: refsFor("safety", r.id) })),
    sources,
  };
}

// ---------------------------------------------------------------- report

/** Data-quality and enrichment report across every record of one kind. */
export async function buildSupplementReport(kind: ProfileKind = "supplement") {
  const tags = await db.medicationTag.findMany({
    where: { kind },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, active: true, profile: { include: RELATION_INCLUDE } },
  });

  const live = <T extends { verificationStatus: string }>(rows: T[]) => rows.filter((r) => r.verificationStatus !== "rejected");
  const pending = <T extends { verificationStatus: string }>(rows: T[]) => rows.filter((r) => r.verificationStatus === "unverified" || r.verificationStatus === "conflict");

  const botanical = new Map<string, string[]>();
  const synonyms = new Map<string, string[]>();
  const records = tags.map((t) => {
    const p = t.profile;
    // Same identity under two records: botanical name for herbs, generic name (+ salt) for medicines.
    const identity = kind === "medication" ? (p?.genericName ? [p.genericName, p.saltForm].filter(Boolean).join(" ") : null) : p?.botanicalName;
    if (identity) {
      const k = identity.trim().toLowerCase();
      botanical.set(k, [...(botanical.get(k) || []), t.label]);
    }
    for (const s of parseJson<string[]>(p?.synonyms, [])) {
      const k = s.trim().toLowerCase();
      if (k && k !== t.label.toLowerCase()) synonyms.set(k, [...new Set([...(synonyms.get(k) || []), t.label])]);
    }
    const conflicts = p ? p.fieldReviews.filter((r) => r.verificationStatus === "conflict").length : 0;
    const pendingSafety = p ? pending(p.safetyItems).length : 0;
    const staleLinks = p
      ? live(p.complaints).filter((r) => !r.complaint.active).length + live(p.allergies).filter((r) => !r.allergy.active).length + live(p.symptoms).filter((r) => !r.symptom.active).length
      : 0;
    return {
      tagId: t.id, label: t.label, active: t.active,
      status: p?.status ?? "none", errorMessage: p?.errorMessage ?? null,
      sourced: (p?.enrichmentVersion ?? 0) >= 2,
      category: p?.herbType ?? null,
      completeness: p?.completeness ?? 0,
      sources: p ? new Set(p.citations.map((c) => c.sourceId)).size : 0,
      complaintLinks: p ? live(p.complaints).length : 0,
      safetyItems: p ? live(p.safetyItems).length : 0,
      pendingSafety, conflicts, staleLinks,
      unsourcedClaims: p
        ? [...live(p.complaints).map((r) => ["complaint", r.id]), ...live(p.allergies).map((r) => ["allergy", r.id]), ...live(p.safetyItems).map((r) => ["safety", r.id])]
            .filter(([type, id]) => !p.citations.some((c) => c.subjectType === type && c.subjectKey === id)).length
        : 0,
      unknown: parseJson<string[]>(p?.unknownFields, []),
      enrichedAt: p?.enrichedAt ?? null,
    };
  });

  const profiles = tags.map((t) => t.profile).filter((p): p is FullProfile => !!p);
  const count = (fn: (p: FullProfile) => number) => profiles.reduce((n, p) => n + fn(p), 0);
  const sourcedRecords = records.filter((r) => r.sourced);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      substances: records.length,
      reviewed: sourcedRecords.length,
      notYetSourced: records.length - sourcedRecords.length,
      failed: records.filter((r) => r.status === "failed").length,
      complete: sourcedRecords.filter((r) => r.completeness >= 85).length,
      partial: sourcedRecords.filter((r) => r.completeness >= 50 && r.completeness < 85).length,
      insufficient: sourcedRecords.filter((r) => r.completeness < 50).length,
      withSources: records.filter((r) => r.sources > 0).length,
      withoutSources: records.filter((r) => r.sources === 0).length,
      pendingReviewRecords: records.filter((r) => r.pendingSafety > 0 || r.conflicts > 0).length,
      pendingSafetyItems: records.reduce((n, r) => n + r.pendingSafety, 0),
      conflicts: records.reduce((n, r) => n + r.conflicts, 0),
      verifiedClaims: count((p) =>
        [...p.complaints, ...p.allergies, ...p.symptoms, ...p.ingredients, ...p.safetyItems, ...p.fieldReviews].filter((r) => r.verificationStatus === "verified").length),
      unsourcedClaims: records.reduce((n, r) => n + r.unsourcedClaims, 0),
      staleLinks: records.reduce((n, r) => n + r.staleLinks, 0),
    },
    relationships: {
      complaints: count((p) => live(p.complaints).length),
      symptoms: count((p) => live(p.symptoms).length),
      allergyRelief: count((p) => live(p.allergies).filter((r) => r.relation === "relief").length),
      allergyCaution: count((p) => live(p.allergies).filter((r) => r.relation === "caution").length),
      safetyItems: count((p) => live(p.safetyItems).filter((r) => r.category !== "interaction").length),
      interactions: count((p) => live(p.safetyItems).filter((r) => r.category === "interaction").length),
      ingredients: count((p) => live(p.ingredients).length),
      ingredientsLinkedToRecords: count((p) => live(p.ingredients).filter((r) => r.ingredientTagId).length),
    },
    duplicates: {
      identityLabel: kind === "medication" ? "generic name" : "botanical name",
      identity: [...botanical.entries()].filter(([, v]) => v.length > 1).map(([name, items]) => ({ name, items })),
      synonyms: [...synonyms.entries()].filter(([, v]) => v.length > 1).map(([name, items]) => ({ name, items })),
    },
    records,
  };
}

// ---------------------------------------------------------------- compare

/** Flattens a snapshot into comparable "label -> value" rows for the History compare view. */
export function snapshotView(snap: ProfileSnapshot) {
  const show = (v: unknown) => {
    const parsed = typeof v === "string" && v.startsWith("[") ? parseJson<any[]>(v, []) : v;
    if (Array.isArray(parsed)) return parsed.map((x) => (typeof x === "string" ? x : [x.manufacturer, x.product].filter(Boolean).join(" — "))).join("; ");
    return parsed == null ? "" : String(parsed);
  };
  const fields: Record<string, string> = {};
  for (const f of [...ALL_SCALAR_FIELDS, ...ALL_LIST_FIELDS, "unknownFields"]) {
    const v = show((snap.fields as any)[f]);
    if (v) fields[f] = v;
  }
  const tag = (s: string) => (s === "unverified" ? "" : ` [${s}]`);
  return {
    enrichmentVersion: snap.enrichmentVersion,
    fields,
    relationships: {
      complaints: snap.complaints.map((r) => `${r.label}${r.relationType && r.relationType !== "traditional_use" ? ` (${r.relationType.replace(/_/g, " ")})` : ""}${tag(r.verificationStatus)}`),
      symptoms: snap.symptoms.map((r) => `${r.label}${tag(r.verificationStatus)}`),
      allergies: snap.allergies.map((r) => `${r.relation === "relief" ? "Eases" : "Caution"}: ${r.label}${tag(r.verificationStatus)}`),
      ingredients: snap.ingredients.map((r) => `${r.name}${tag(r.verificationStatus)}`),
      safety: snap.safetyItems.map((r) => `${r.category}: ${r.text}${tag(r.verificationStatus)}`),
    },
    sources: [...new Set(snap.citations.map((c) => c.url))].length,
  };
}

export async function currentSnapshot(profileId: string) {
  const p = await loadFullProfile({ id: profileId });
  return p ? toSnapshot(p) : null;
}
