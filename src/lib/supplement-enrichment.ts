import { db } from "@/lib/db";
import { researchSupplementSourced, researchMedicationSourced, type GroundedResult } from "@/lib/gemini";
import { nameKeys } from "@/lib/catalog-names";
import {
  ALL_SCALAR_FIELDS, ALL_LIST_FIELDS, fieldsFor, parseJson,
  snapshotProfile, upsertSource, refreshCompleteness, type ProfileField, type ProfileKind,
} from "@/lib/supplement-profile-store";

// Search-backed enrichment of catalog records: Unani Supplements & Herbs
// (MedicationTag kind "supplement") and allopathic Medications (kind
// "medication") — same engine, kind-specific research prompt, fields and
// links. Each item gets one Gemini call with Google Search grounding;
// every fact comes back as its own line, and the grounding metadata says
// which web pages support which line — those become per-claim citations.
//
// Review rules (see the admin profile dialog):
//  - everything written here is "unverified" — nothing is ever auto-verified;
//  - a field or relationship an admin VERIFIED is never overwritten;
//  - one an admin REJECTED is kept as a tombstone and never re-added;
//  - a snapshot is saved before every change (compare + restore).

const NOT_CONFIGURED = "Hakeem Insight is not configured or did not respond — check the Gemini integration under Admin → Settings.";
const CONCURRENCY = 3;

// ---------------------------------------------------------------- parsing

const CONFIDENCE: Record<string, number> = { high: 0.9, medium: 0.6, low: 0.3 };
const EVIDENCE = new Set(["traditional", "clinical", "preclinical", "regulatory", "unspecified"]);
const RELATIONS = new Set(["approved_indication", "evidence_supported", "symptom_relief", "off_label", "not_recommended"]);
const SEVERITY = new Set(["high", "moderate", "low"]);
const ROLES = new Set(["principal", "supporting", "base", "vehicle", "unknown", "active", "excipient"]);
const SAFETY_CATEGORIES = new Set([
  "contraindication", "precaution", "pregnancy", "lactation", "pediatric", "adverse_effect", "toxicity",
  // allopathic medications
  "warning", "geriatric", "renal", "hepatic", "monitoring", "food_interaction",
]);
const FIELD_NAMES = new Set<string>(["category", ...ALL_SCALAR_FIELDS, ...ALL_LIST_FIELDS]);

interface Claim { line: string; statement: string; confidence: number | null; evidence: string }
interface ParsedResearch {
  fields: Map<string, { value: string } & Claim>;
  uses: ({ label: string; relation: string | null } & Claim)[];
  symptoms: ({ label: string } & Claim)[];
  allergyRelief: ({ label: string } & Claim)[];
  allergyCaution: ({ label: string } & Claim)[];
  ingredients: ({ name: string; role: string | null; proportion: string | null } & Claim)[];
  safety: ({ category: string; severity: string | null } & Claim)[];
  interactions: ({ label: string; severity: string | null } & Claim)[];
  brands: ({ manufacturer: string; product: string } & Claim)[];
  unknown: { topic: string; statement: string }[];
  conflicts: { topic: string; statement: string }[];
}

/**
 * Tolerant parser for the line format requested in researchSupplementSourced.
 * Enumerated tokens (confidence, evidence, severity, role) are recognised by
 * value rather than position, because the model occasionally drops one.
 */
export function parseResearch(text: string): ParsedResearch {
  const out: ParsedResearch = {
    fields: new Map(), uses: [], symptoms: [], allergyRelief: [], allergyCaution: [],
    ingredients: [], safety: [], interactions: [], brands: [], unknown: [], conflicts: [],
  };
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[\s*\-•]+/, "").trim();
    const parts = line.split(" | ").map((x) => x.trim());
    if (parts.length < 3) continue;
    const type = parts[0].toUpperCase();
    const statement = parts[parts.length - 1];
    const middle = parts.slice(1, -1);
    const lower = middle.map((m) => m.toLowerCase());
    const confidence = lower.map((m) => CONFIDENCE[m]).find((v) => v !== undefined) ?? null;
    const evidence = lower.find((m) => EVIDENCE.has(m)) ?? "unspecified";
    const claim: Claim = { line, statement, confidence, evidence };
    const firstFree = (from: number) => middle.slice(from).find((m) => !CONFIDENCE[m.toLowerCase()] && !EVIDENCE.has(m.toLowerCase()) && !SEVERITY.has(m.toLowerCase()));

    switch (type) {
      case "FIELD": {
        const field = middle[0];
        const value = middle[1];
        if (FIELD_NAMES.has(field) && value && value !== "-") out.fields.set(field, { value, ...claim });
        break;
      }
      case "USED_FOR": if (middle[0]) out.uses.push({ label: middle[0], relation: lower.slice(1).find((m) => RELATIONS.has(m)) ?? null, ...claim }); break;
      case "SYMPTOM": if (middle[0]) out.symptoms.push({ label: middle[0], ...claim }); break;
      case "ALLERGY_RELIEF": if (middle[0]) out.allergyRelief.push({ label: middle[0], ...claim }); break;
      case "ALLERGY_CAUTION": if (middle[0]) out.allergyCaution.push({ label: middle[0], ...claim }); break;
      case "INGREDIENT": {
        if (!middle[0]) break;
        const role = lower.slice(1).find((m) => ROLES.has(m)) ?? null;
        const proportion = middle.slice(1).find((m) => !ROLES.has(m.toLowerCase()) && !CONFIDENCE[m.toLowerCase()] && m !== "-") ?? null;
        out.ingredients.push({ name: middle[0], role, proportion, ...claim });
        break;
      }
      case "SAFETY": {
        const category = lower[0];
        if (!SAFETY_CATEGORIES.has(category)) break;
        out.safety.push({ category, severity: lower.slice(1).find((m) => SEVERITY.has(m)) ?? null, ...claim });
        break;
      }
      case "INTERACTION": if (middle[0]) out.interactions.push({ label: middle[0], severity: lower.slice(1).find((m) => SEVERITY.has(m)) ?? null, ...claim }); break;
      case "BRAND": {
        const product = firstFree(1);
        if (middle[0]) out.brands.push({ manufacturer: middle[0], product: product ?? "", ...claim });
        break;
      }
      case "UNKNOWN": if (middle[0]) out.unknown.push({ topic: middle[0], statement }); break;
      case "CONFLICT": if (middle[0]) out.conflicts.push({ topic: middle[0], statement }); break;
    }
  }
  return out;
}

const norm = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim().replace(/[.。]$/, "").toLowerCase();

/** Grounding chunk indices whose supported segment belongs to this line. */
function chunksForLine(line: string, research: GroundedResult): number[] {
  const l = norm(line);
  const hits = new Set<number>();
  for (const s of research.supports) {
    const seg = norm(s.text);
    if (seg.length < 12) continue;
    if (l.includes(seg) || seg.includes(l)) s.chunkIndices.forEach((i) => hits.add(i));
  }
  return [...hits];
}

/**
 * Grounding links are temporary Google redirects — resolve each to the real
 * page URL. A few at a time with one retry: firing dozens at once (3 items in
 * parallel x ~30 links) gets rate-limited and silently loses every source.
 */
async function resolveChunkUrls(research: GroundedResult): Promise<(string | null)[]> {
  const resolveOne = async (uri: string) => {
    if (!uri) return null;
    if (!uri.includes("grounding-api-redirect")) return uri;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(uri, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10000) });
        const loc = res.headers.get("location");
        if (loc && /^https?:\/\//.test(loc)) return loc;
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, 800));
    }
    return null;
  };
  const out: (string | null)[] = new Array(research.chunks.length).fill(null);
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < research.chunks.length) {
      const i = next++;
      out[i] = await resolveOne(research.chunks[i].uri);
    }
  }));
  return out;
}

// ---------------------------------------------------------------- saving

function aliasIndex(rows: { id: string; label: string }[]) {
  const index = new Map<string, string>();
  for (const r of rows) for (const k of nameKeys(r.label)) if (!index.has(k)) index.set(k, r.id);
  return index;
}
const lookup = (index: Map<string, string>, label: string) => {
  for (const k of nameKeys(label)) { const id = index.get(k); if (id) return id; }
  return null;
};

interface Catalogs {
  complaints: { id: string; label: string }[];
  allergies: { id: string; label: string }[];
  symptoms: { id: string; label: string }[];
  medications: { id: string; label: string }[];
  supplements: { id: string; label: string }[];
}

async function loadCatalogs(): Promise<Catalogs> {
  const [complaints, allergies, symptoms, medications, supplements] = await Promise.all([
    db.chiefComplaint.findMany({ where: { active: true }, select: { id: true, label: true } }),
    db.allergyTag.findMany({ where: { active: true }, select: { id: true, label: true } }),
    db.acuteSymptomTag.findMany({ where: { active: true }, select: { id: true, label: true } }),
    db.medicationTag.findMany({ where: { kind: "medication", active: true }, select: { id: true, label: true } }),
    db.medicationTag.findMany({ where: { kind: "supplement" }, select: { id: true, label: true } }),
  ]);
  return { complaints, allergies, symptoms, medications, supplements };
}

const LOCKED = new Set(["verified", "rejected"]);

async function saveResearch(tagId: string, kind: ProfileKind, research: GroundedResult, catalogs: Catalogs) {
  const spec = fieldsFor(kind);
  const kindFields = new Set<string>(["category", ...spec.scalar, ...spec.list]);
  const parsed = parseResearch(research.text);
  if (parsed.fields.size === 0 && parsed.uses.length === 0) {
    throw new Error("The search returned no usable facts for this item — it will be retried.");
  }
  const urls = await resolveChunkUrls(research);
  // Never save a "search-backed" profile with no sources — fail and retry instead.
  if (!urls.some(Boolean)) {
    throw new Error(`No source pages could be resolved (${research.chunks.length} returned by the search) — will retry.`);
  }
  const sourcedLines = research.text.split("\n").filter((line) => chunksForLine(line, research).some((i) => urls[i]));
  if (!sourcedLines.length) {
    throw new Error("None of the researched facts could be matched to a source — will retry.");
  }
  const sourcesFor = (line: string) =>
    chunksForLine(line, research).map((i) => ({ url: urls[i], title: research.chunks[i]?.title ?? null })).filter((s): s is { url: string; title: string | null } => !!s.url);

  const idx = {
    complaints: aliasIndex(catalogs.complaints), allergies: aliasIndex(catalogs.allergies), symptoms: aliasIndex(catalogs.symptoms),
    medications: aliasIndex(catalogs.medications.filter((m) => m.id !== tagId)),
    // Ingredients link to records of the same kind: herbs inside a Unani
    // formulation, single-ingredient medicines inside a combination product.
    ingredients: aliasIndex((kind === "medication" ? catalogs.medications : catalogs.supplements).filter((s) => s.id !== tagId)),
  };

  await db.$transaction(async (tx) => {
    let profile = await tx.supplementProfile.findUnique({ where: { tagId } });
    if (!profile) profile = await tx.supplementProfile.create({ data: { tagId } });
    const profileId = profile.id;
    await snapshotProfile(tx, profileId, "enrichment", "Before search-backed enrichment", null);

    // ---- fields
    const reviews = await tx.supplementFieldReview.findMany({ where: { profileId } });
    const fieldLocked = (f: string) => LOCKED.has(reviews.find((r) => r.field === f)?.verificationStatus ?? "");
    const data: Record<string, any> = {};
    const fieldClaims: { field: ProfileField; claim: Claim }[] = [];
    const setField = (field: ProfileField, value: string | null, claim: Claim | null) => {
      if (fieldLocked(field)) return;
      data[field] = value;
      if (claim) fieldClaims.push({ field, claim });
    };

    for (const [name, f] of parsed.fields) {
      if (!kindFields.has(name)) continue;
      if (name === "category") {
        const cats = spec.categories;
        const cat = cats.find((c) => c.toLowerCase() === f.value.toLowerCase()) ?? cats.find((c) => c.toLowerCase().startsWith(f.value.toLowerCase().split(" ")[0]));
        if (cat) setField("herbType", cat, f);
      } else if (spec.list.includes(name)) {
        if (name === "brands") continue; // brands come from BRAND lines
        setField(name as ProfileField, JSON.stringify(f.value.split(";").map((x) => x.trim()).filter(Boolean)), f);
      } else {
        setField(name as ProfileField, f.value, f);
      }
    }
    if (parsed.brands.length) {
      setField("brands", JSON.stringify(parsed.brands.map((b) => ({ manufacturer: b.manufacturer, product: b.product }))), {
        line: parsed.brands.map((b) => b.line).join("\n"), statement: "", evidence: "unspecified",
        confidence: Math.min(...parsed.brands.map((b) => b.confidence ?? 0.6)),
      });
    }

    // Topics the search found NOT documented: clear an unsourced old value so
    // it can't masquerade as fact, and record it as "Not documented".
    const unknownFields = new Set<string>();
    for (const u of parsed.unknown) {
      const topic = u.topic === "category" ? "herbType" : u.topic;
      unknownFields.add(topic);
      if (spec.scalar.includes(topic) && !(topic in data)) setField(topic as ProfileField, null, null);
      if (spec.list.includes(topic) && !(topic in data)) setField(topic as ProfileField, "[]", null);
    }

    const unmatchedUses: string[] = [];
    await tx.supplementProfile.update({
      where: { id: profileId },
      data: { ...data, unknownFields: JSON.stringify([...unknownFields]), status: "enriched", errorMessage: null, enrichedAt: new Date(), enrichmentVersion: 2 },
    });

    // Field review rows + citations (unlocked fields only).
    for (const field of new Set([...fieldClaims.map((c) => c.field), ...Object.keys(data)])) {
      const claim = fieldClaims.find((c) => c.field === field)?.claim;
      const conflict = parsed.conflicts.find((c) => c.topic === field || (c.topic === "category" && field === "herbType"));
      await tx.supplementFieldReview.upsert({
        where: { profileId_field: { profileId, field } },
        update: { verificationStatus: conflict ? "conflict" : "unverified", confidence: claim?.confidence ?? null, evidenceType: claim?.evidence ?? null, provenance: "search", note: conflict?.statement ?? null, reviewedById: null, reviewedAt: null },
        create: { profileId, field, verificationStatus: conflict ? "conflict" : "unverified", confidence: claim?.confidence ?? null, evidenceType: claim?.evidence ?? null, provenance: "search", note: conflict?.statement ?? null },
      });
      await tx.supplementCitation.deleteMany({ where: { profileId, subjectType: "field", subjectKey: field } });
      if (claim) for (const line of claim.line.split("\n")) await cite(tx, profileId, "field", field, sourcesFor(line), claim.statement || line);
    }
    // A conflict on a field the search left unchanged still needs review.
    for (const c of parsed.conflicts) {
      const field = c.topic === "category" ? "herbType" : c.topic;
      if (field in data || fieldLocked(field) || !kindFields.has(c.topic)) continue;
      await tx.supplementFieldReview.upsert({
        where: { profileId_field: { profileId, field } },
        update: { verificationStatus: "conflict", note: c.statement, provenance: "search" },
        create: { profileId, field, verificationStatus: "conflict", note: c.statement, provenance: "search" },
      });
    }

    const prov = (c: Claim) => ({
      rationale: c.statement, evidenceType: c.evidence, confidence: c.confidence,
      provenance: "search", verificationStatus: "unverified",
    });

    // ---- relationships: replace everything not locked by a review.
    // complaints
    const oldComplaints = await tx.supplementComplaintLink.findMany({ where: { profileId } });
    await dropUnlocked(tx, profileId, "complaint", oldComplaints, (ids) => tx.supplementComplaintLink.deleteMany({ where: { id: { in: ids } } }));
    const lockedComplaints = new Set(oldComplaints.filter((r) => LOCKED.has(r.verificationStatus)).map((r) => r.complaintId));
    for (const u of parsed.uses) {
      const complaintId = lookup(idx.complaints, u.label);
      if (!complaintId) { unmatchedUses.push(u.label); continue; }
      if (lockedComplaints.has(complaintId)) continue;
      lockedComplaints.add(complaintId);
      const relationType = kind === "medication" ? u.relation ?? "evidence_supported" : "traditional_use";
      const row = await tx.supplementComplaintLink.create({ data: { profileId, complaintId, relationType, ...prov(u) } });
      await cite(tx, profileId, "complaint", row.id, sourcesFor(u.line), u.statement);
    }

    // symptoms
    const oldSymptoms = await tx.supplementSymptomLink.findMany({ where: { profileId } });
    await dropUnlocked(tx, profileId, "symptom", oldSymptoms, (ids) => tx.supplementSymptomLink.deleteMany({ where: { id: { in: ids } } }));
    const lockedSymptoms = new Set(oldSymptoms.filter((r) => LOCKED.has(r.verificationStatus)).map((r) => r.symptomId));
    for (const s of parsed.symptoms) {
      const symptomId = lookup(idx.symptoms, s.label);
      if (!symptomId) { unmatchedUses.push(s.label); continue; }
      if (lockedSymptoms.has(symptomId)) continue;
      lockedSymptoms.add(symptomId);
      const row = await tx.supplementSymptomLink.create({ data: { profileId, symptomId, ...prov(s) } });
      await cite(tx, profileId, "symptom", row.id, sourcesFor(s.line), s.statement);
    }

    // allergies — unmatched cautions become allergy_warning safety items so
    // a safety signal is never dropped just because the allergen isn't listed.
    const oldAllergies = await tx.supplementAllergyLink.findMany({ where: { profileId } });
    await dropUnlocked(tx, profileId, "allergy", oldAllergies, (ids) => tx.supplementAllergyLink.deleteMany({ where: { id: { in: ids } } }));
    const lockedAllergies = new Set(oldAllergies.filter((r) => LOCKED.has(r.verificationStatus)).map((r) => `${r.allergyId}|${r.relation}`));
    const extraSafety: { category: string; severity: string | null; claim: Claim; text: string; medicationTagId?: string | null }[] = [];
    for (const [list, relation] of [[parsed.allergyRelief, "relief"], [parsed.allergyCaution, "caution"]] as const) {
      for (const a of list) {
        const allergyId = lookup(idx.allergies, a.label);
        if (!allergyId) {
          if (relation === "caution") extraSafety.push({ category: "allergy_warning", severity: "moderate", claim: a, text: a.statement ? `${a.label}: ${a.statement}` : `Contains or may cross-react with: ${a.label}` });
          continue;
        }
        if (lockedAllergies.has(`${allergyId}|${relation}`)) continue;
        lockedAllergies.add(`${allergyId}|${relation}`);
        const row = await tx.supplementAllergyLink.create({ data: { profileId, allergyId, relation, ...prov(a) } });
        await cite(tx, profileId, "allergy", row.id, sourcesFor(a.line), a.statement);
      }
    }

    // ingredients
    const oldIngredients = await tx.supplementIngredient.findMany({ where: { profileId } });
    await dropUnlocked(tx, profileId, "ingredient", oldIngredients, (ids) => tx.supplementIngredient.deleteMany({ where: { id: { in: ids } } }));
    const lockedIngredients = new Set(oldIngredients.filter((r) => LOCKED.has(r.verificationStatus)).map((r) => r.name.toLowerCase()));
    for (const ing of parsed.ingredients) {
      if (lockedIngredients.has(ing.name.toLowerCase())) continue;
      lockedIngredients.add(ing.name.toLowerCase());
      const row = await tx.supplementIngredient.create({
        data: { profileId, name: ing.name, role: ing.role, proportion: ing.proportion, ingredientTagId: lookup(idx.ingredients, ing.name), ...prov(ing) },
      });
      await cite(tx, profileId, "ingredient", row.id, sourcesFor(ing.line), ing.statement);
    }

    // safety + interactions
    const oldSafety = await tx.supplementSafetyItem.findMany({ where: { profileId } });
    await dropUnlocked(tx, profileId, "safety", oldSafety, (ids) => tx.supplementSafetyItem.deleteMany({ where: { id: { in: ids } } }));
    const lockedSafety = new Set(oldSafety.filter((r) => LOCKED.has(r.verificationStatus)).map((r) => `${r.category}|${norm(r.text)}`));
    const safetyRows = [
      ...parsed.safety.map((s) => ({ category: s.category, severity: s.severity, claim: s as Claim, text: s.statement, medicationTagId: null as string | null })),
      ...parsed.interactions.map((i) => ({ category: "interaction", severity: i.severity, claim: i as Claim, text: i.statement, medicationTagId: lookup(idx.medications, i.label) })),
      ...extraSafety.map((e) => ({ ...e, medicationTagId: null })),
    ];
    for (const s of safetyRows) {
      const key = `${s.category}|${norm(s.text)}`;
      if (!s.text || lockedSafety.has(key)) continue;
      lockedSafety.add(key);
      const row = await tx.supplementSafetyItem.create({
        data: { profileId, category: s.category, text: s.text, severity: s.severity, medicationTagId: s.medicationTagId, ...prov(s.claim) },
      });
      await cite(tx, profileId, "safety", row.id, sourcesFor(s.claim.line), s.claim.statement);
    }

    // Legacy free-text columns are superseded by the structured rows above.
    await tx.supplementProfile.update({
      where: { id: profileId },
      data: { unmatchedUses: JSON.stringify([...new Set(unmatchedUses)]), cautions: "[]", keyIngredients: "[]" },
    });
    await refreshCompleteness(profileId, tx);
  // SQLite allows one writer at a time — let parallel slots wait their turn.
  }, { timeout: 60000, maxWait: 30000 });
}

async function dropUnlocked(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  profileId: string,
  subjectType: string,
  rows: { id: string; verificationStatus: string }[],
  remove: (ids: string[]) => Promise<unknown>,
) {
  const ids = rows.filter((r) => !LOCKED.has(r.verificationStatus)).map((r) => r.id);
  if (!ids.length) return;
  await tx.supplementCitation.deleteMany({ where: { profileId, subjectType, subjectKey: { in: ids } } });
  await remove(ids);
}

async function cite(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  profileId: string, subjectType: string, subjectKey: string,
  sources: { url: string; title: string | null }[], snippet: string,
) {
  for (const s of sources) {
    const source = await upsertSource(tx, s.url, s.title);
    await tx.supplementCitation.upsert({
      where: { profileId_sourceId_subjectType_subjectKey: { profileId, sourceId: source.id, subjectType, subjectKey } },
      update: { snippet },
      create: { profileId, sourceId: source.id, subjectType, subjectKey, snippet },
    });
  }
}

async function markFailed(tagId: string, message: string) {
  const existing = await db.supplementProfile.findUnique({ where: { tagId }, select: { status: true } });
  // A failed refresh must not downgrade a usable profile — keep its data.
  if (existing?.status === "enriched") {
    await db.supplementProfile.update({ where: { tagId }, data: { errorMessage: message } });
    return;
  }
  await db.supplementProfile.upsert({
    where: { tagId },
    update: { status: "failed", errorMessage: message },
    create: { tagId, status: "failed", errorMessage: message },
  });
}

/** Researches and saves one item. Throws on failure (callers record it). */
async function enrichOne(tagId: string, catalogs: Catalogs) {
  const tag = await db.medicationTag.findUnique({ where: { id: tagId }, include: { profile: true } });
  if (!tag || (tag.kind !== "supplement" && tag.kind !== "medication")) throw new Error("Record not found");
  const kind = tag.kind as ProfileKind;
  const p = tag.profile;
  const enriched = p && p.status === "enriched";
  const currentSummary = !enriched ? null : kind === "medication"
    ? [p.herbType, p.genericName && `generic ${p.genericName}`, p.therapeuticClass, p.summary].filter(Boolean).join("; ")
    : [p.herbType, p.unaniName && `Unani name ${p.unaniName}`, p.botanicalName && `botanical name ${p.botanicalName}`, p.mizaj && `Mizaj ${p.mizaj}`, p.summary].filter(Boolean).join("; ");

  const common = {
    label: tag.label, currentSummary: currentSummary || null,
    complaintCatalog: catalogs.complaints.map((c) => c.label),
    allergyCatalog: catalogs.allergies.map((a) => a.label),
    symptomCatalog: catalogs.symptoms.map((s) => s.label),
    medicationCatalog: catalogs.medications.filter((m) => m.id !== tagId).map((m) => m.label),
  };
  const research1 = () => kind === "medication"
    ? researchMedicationSourced(common)
    : researchSupplementSourced({ ...common, supplementCatalog: catalogs.supplements.filter((s) => s.id !== tagId).map((s) => s.label) });
  let research = await research1();
  // The model occasionally answers without searching — that answer has no
  // sources, so ask once more before giving up on this item.
  if (research && (!research.chunks.length || !research.supports.length)) research = await research1();
  if (!research) throw new Error(NOT_CONFIGURED);
  if (!research.chunks.length || !research.supports.length) throw new Error("The search returned no sources for this item — it will be retried.");
  await saveResearch(tagId, kind, research, catalogs);
}

// ---------------------------------------------------------------- jobs

// One in-process worker processes every job, CONCURRENCY items at a time.
// "single" and "new" jobs (an admin waiting on one item, freshly added items)
// are picked before long "pilot"/"batch" runs so they never queue behind them.
const PRIORITY: Record<string, number> = { single: 0, new: 1, pilot: 2, batch: 3 };
const inFlight = new Set<string>(); // `${jobId}:${tagId}`
let workerActive = 0;
let lock: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = lock.then(fn, fn);
  lock = next.catch(() => {});
  return next;
};

async function claimNext(): Promise<{ jobId: string; tagId: string } | null> {
  return serial(async () => {
    const jobs = await db.supplementEnrichmentJob.findMany({ where: { status: "running" }, orderBy: { createdAt: "asc" } });
    jobs.sort((a, b) => (PRIORITY[a.mode] ?? 9) - (PRIORITY[b.mode] ?? 9));
    for (const job of jobs) {
      const done = new Set([...parseJson<string[]>(job.processedIds, []), ...parseJson<{ tagId: string }[]>(job.failedItems, []).map((f) => f.tagId)]);
      const next = parseJson<string[]>(job.tagIds, []).find((id) => !done.has(id) && !inFlight.has(`${job.id}:${id}`));
      if (next) {
        inFlight.add(`${job.id}:${next}`);
        return { jobId: job.id, tagId: next };
      }
      if (![...inFlight].some((k) => k.startsWith(`${job.id}:`))) {
        await db.supplementEnrichmentJob.update({ where: { id: job.id }, data: { status: "completed", finishedAt: new Date() } });
      }
    }
    return null;
  });
}

async function recordResult(jobId: string, tagId: string, error: string | null) {
  await serial(async () => {
    const job = await db.supplementEnrichmentJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    if (error) {
      const label = (await db.medicationTag.findUnique({ where: { id: tagId }, select: { label: true } }))?.label ?? tagId;
      const failed = parseJson<{ tagId: string; label: string; error: string }[]>(job.failedItems, []).filter((f) => f.tagId !== tagId);
      await db.supplementEnrichmentJob.update({ where: { id: jobId }, data: { failedItems: JSON.stringify([...failed, { tagId, label, error }]) } });
    } else {
      const processed = parseJson<string[]>(job.processedIds, []);
      await db.supplementEnrichmentJob.update({ where: { id: jobId }, data: { processedIds: JSON.stringify([...new Set([...processed, tagId])]) } });
    }
  });
  inFlight.delete(`${jobId}:${tagId}`);
}

async function workerLoop() {
  workerActive++;
  try {
    let catalogs = await loadCatalogs();
    let loadedAt = Date.now();
    for (;;) {
      const next = await claimNext();
      if (!next) break;
      if (Date.now() - loadedAt > 10 * 60_000) { catalogs = await loadCatalogs(); loadedAt = Date.now(); }
      let error: string | null = null;
      try {
        await enrichOne(next.tagId, catalogs);
      } catch (err: any) {
        error = String(err?.message || err).slice(0, 500);
        await markFailed(next.tagId, error).catch(() => {});
      }
      await recordResult(next.jobId, next.tagId, error);
    }
  } catch (err) {
    console.error("[supplement-enrichment] worker stopped:", err);
  } finally {
    workerActive--;
  }
}

/** Starts worker slots up to CONCURRENCY; safe to call any time. */
export function kickEnrichmentWorker() {
  while (workerActive < CONCURRENCY) void workerLoop();
}

export type EnrichmentJobMode = "pilot" | "batch" | "single" | "new";

export async function createEnrichmentJob(mode: EnrichmentJobMode, tagIds: string[], createdById: string | null, kind: ProfileKind = "supplement") {
  const ids = [...new Set(tagIds)];
  if (!ids.length) return null;
  const job = await db.supplementEnrichmentJob.create({
    data: { kind, mode, status: "running", tagIds: JSON.stringify(ids), createdById },
  });
  kickEnrichmentWorker();
  return job;
}

export async function setJobStatus(jobId: string, status: "running" | "paused" | "cancelled") {
  const job = await db.supplementEnrichmentJob.findUnique({ where: { id: jobId } });
  if (!job || job.status === "completed" || job.status === "cancelled") return null;
  const updated = await db.supplementEnrichmentJob.update({
    where: { id: jobId },
    data: { status, ...(status === "cancelled" ? { finishedAt: new Date() } : {}) },
  });
  if (status === "running") kickEnrichmentWorker();
  return updated;
}

/** Resumes jobs left "running" by a server restart (called from instrumentation). */
export async function resumeEnrichmentJobs() {
  const running = await db.supplementEnrichmentJob.count({ where: { status: "running" } });
  if (running) kickEnrichmentWorker();
}

export function serializeJob(j: { id: string; mode: string; status: string; tagIds: string; processedIds: string; failedItems: string; createdAt: Date; finishedAt: Date | null }) {
  const total = parseJson<string[]>(j.tagIds, []).length;
  const processed = parseJson<string[]>(j.processedIds, []).length;
  const failedItems = parseJson<{ tagId: string; label: string; error: string }[]>(j.failedItems, []);
  return {
    id: j.id, mode: j.mode, status: j.status, total, processed, failed: failedItems.length, failedItems,
    inFlight: [...inFlight].filter((k) => k.startsWith(`${j.id}:`)).length,
    createdAt: j.createdAt, finishedAt: j.finishedAt,
  };
}

// ---------------------------------------------------------------- entry points

/** Queues search-backed profiles for newly added items (assistant or admin). */
export async function enrichSupplementTags(tagIds: string[], kind: ProfileKind = "supplement") {
  return createEnrichmentJob("new", tagIds, null, kind);
}

/** Queues items with no profile yet (or whose last attempt failed) that aren't already queued. */
export async function enrichPendingSupplements(limit: number, kind: ProfileKind = "supplement") {
  const queued = await queuedTagIds();
  const pending = await db.medicationTag.findMany({
    where: { kind, id: { notIn: [...queued] }, OR: [{ profile: null }, { profile: { status: { in: ["pending", "failed"] } } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  return createEnrichmentJob("new", pending.map((t) => t.id), null, kind);
}

async function queuedTagIds(kind?: ProfileKind) {
  const jobs = await db.supplementEnrichmentJob.findMany({ where: { status: { in: ["running", "paused"] }, ...(kind ? { kind } : {}) } });
  const ids = new Set<string>();
  for (const j of jobs) {
    const done = new Set([...parseJson<string[]>(j.processedIds, []), ...parseJson<{ tagId: string }[]>(j.failedItems, []).map((f) => f.tagId)]);
    for (const id of parseJson<string[]>(j.tagIds, [])) if (!done.has(id)) ids.add(id);
  }
  return ids;
}

/**
 * Pilot sample — up to 8 not-yet-sourced items spread across categories
 * (2 single herbs, 2 compounds, oil, mineral/animal, nutritional, +1), so the
 * Unani team can review every kind of record before the full run.
 */
export async function pickPilotItems(kind: ProfileKind = "supplement") {
  const tags = await db.medicationTag.findMany({
    where: { kind, active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, profile: { select: { herbType: true, enrichmentVersion: true } } },
  });
  const fresh = tags.filter((t) => (t.profile?.enrichmentVersion ?? 1) < 2);
  if (kind === "medication") {
    // Spread across the shapes a medicine record can take: an oral single
    // ingredient, a combination, a biologic, an inhaler, a narrow-therapeutic-
    // index drug, an antibiotic, an NSAID and an antiepileptic.
    const wanted = [/^Metformin$/i, /-/, /^Insulin/i, /Inhaler/i, /^Warfarin$/i, /^Azithromycin$|cillin|^Cef/i, /^Ibuprofen$|^Diclofenac$/i, /^Carbamazepine$|^Phenytoin$/i];
    const picks: typeof fresh = [];
    for (const re of wanted) {
      const t = fresh.find((x) => re.test(x.label) && !picks.includes(x));
      if (t) picks.push(t);
    }
    for (const t of fresh) if (picks.length < 8 && !picks.includes(t)) picks.push(t);
    return picks.slice(0, 8);
  }
  const of = (re: RegExp) => fresh.filter((t) => re.test(t.profile?.herbType || ""));
  const picks = [
    ...of(/^Single Herb/).slice(0, 2), ...of(/^Compound/).slice(0, 2), ...of(/Oil|Roghan/).slice(0, 1),
    ...of(/Mineral|Animal/).slice(0, 1), ...of(/^Other$|Nutritional/).slice(0, 1),
  ];
  for (const t of fresh) if (picks.length < 8 && !picks.includes(t)) picks.push(t);
  return picks.slice(0, 8);
}

export async function getEnrichmentStatus(kind: ProfileKind = "supplement") {
  const [total, sourced, failed, jobs, queued, pilots] = await Promise.all([
    db.medicationTag.count({ where: { kind } }),
    db.supplementProfile.count({ where: { enrichmentVersion: { gte: 2 }, tag: { kind } } }),
    db.supplementProfile.count({ where: { status: "failed", tag: { kind } } }),
    db.supplementEnrichmentJob.findMany({ where: { kind }, orderBy: { createdAt: "desc" }, take: 10 }),
    queuedTagIds(kind),
    db.supplementEnrichmentJob.count({ where: { kind, mode: "pilot", status: "completed" } }),
  ]);
  const pilotDone = pilots > 0;
  return { total, sourced, notYetSourced: total - sourced, failed, queued: queued.size, pilotDone, jobs: jobs.map(serializeJob) };
}
