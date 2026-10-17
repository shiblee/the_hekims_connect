import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/secret-crypto";

const MODEL = "gemini-3.8-flash";

export async function getGeminiApiKey(): Promise<string | null> {
  const row = await db.integrationConfig.findUnique({ where: { provider: "gemini" } });
  if (!row || !row.active || !row.keyEnc) return null;
  return decryptSecret(row.keyEnc);
}

export interface VitalsInsightVisit {
  visitDate: Date | string;
  heartRate?: number | null;
  pulse?: number | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  spo2?: number | null;
  temperatureF?: number | null;
  respiratoryRate?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
}

/** Shared Gemini call — server-side only, returns null (and logs) on any failure or missing key. */
async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!res.ok) {
    console.error("Gemini call error:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text.trim() : null;
}

/** Short, scoped clinical-language summary of a patient's recent vitals trend. Server-side only. */
export async function generateVitalsInsight(
  patientContext: { name: string; gender: string | null; ageLabel: string },
  visits: VitalsInsightVisit[]
): Promise<string | null> {
  const rows = visits
    .map((v) => {
      const date = new Date(v.visitDate).toISOString().slice(0, 10);
      const parts = [
        v.heartRate != null ? `Heart Rate ${v.heartRate} bpm` : null,
        v.pulse != null ? `Pulse ${v.pulse} bpm` : null,
        v.bpSystolic != null || v.bpDiastolic != null ? `BP ${v.bpSystolic ?? "—"}/${v.bpDiastolic ?? "—"} mmHg` : null,
        v.spo2 != null ? `SpO2 ${v.spo2}%` : null,
        v.temperatureF != null ? `Temp ${v.temperatureF}°F` : null,
        v.respiratoryRate != null ? `RR ${v.respiratoryRate}/min` : null,
        v.heightCm != null ? `Height ${v.heightCm}cm` : null,
        v.weightKg != null ? `Weight ${v.weightKg}kg` : null,
      ].filter(Boolean);
      return `${date}: ${parts.join(", ") || "no readings"}`;
    })
    .join("\n");

  const prompt = `You are a clinical assistant helping a doctor quickly review a patient's recorded vitals. This is decision support only — never state or imply a diagnosis.

Patient: ${patientContext.name}, ${patientContext.gender || "gender not recorded"}, ${patientContext.ageLabel}.

Recent vitals readings (most recent first):
${rows}

In 2-4 short sentences, summarize the overall trend and flag anything outside a normal adult range. Be factual and concise, plain text, no markdown, no diagnosis, no treatment recommendations — just observations a doctor should double-check.`;

  return callGemini(prompt);
}

export interface ScreeningAnswerSummary {
  questionLabel: string;
  value: string;
  flagTriggered: string | null;
}

export interface ScreeningInsight {
  headline: string;
  findings: { text: string; severity: "red" | "yellow" | "green" | "neutral" }[];
  unani: string;
  priority: string;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function isValidScreeningInsight(v: any): v is ScreeningInsight {
  return (
    v && typeof v.headline === "string" &&
    Array.isArray(v.findings) &&
    v.findings.every((f: any) => f && typeof f.text === "string" && ["red", "yellow", "green", "neutral"].includes(f.severity)) &&
    typeof v.unani === "string" &&
    typeof v.priority === "string"
  );
}

/**
 * Short clinical insight for an L1 Screening, for the doctor to triage at a
 * glance. Server-side only. Returns a JSON-encoded ScreeningInsight when the
 * model follows the structured format (the common case) — the caller stores
 * whatever string comes back as-is; a scannable chip/headline UI is only
 * possible when it's valid JSON, so the raw model text is returned as a
 * plain-paragraph fallback on any parse/validation failure rather than
 * failing the whole request.
 */
export async function generateScreeningSummary(
  patientContext: { name: string; gender: string | null; ageLabel: string; mizaj?: string | null },
  chiefComplaints: string[],
  answers: ScreeningAnswerSummary[],
  overallFlag: string | null
): Promise<string | null> {
  const answerLines = answers
    .map((a) => `${a.questionLabel}: ${a.value}${a.flagTriggered ? ` [${a.flagTriggered.toUpperCase()} FLAG]` : ""}`)
    .join("\n");

  const prompt = `You are a senior Unani clinical assistant helping a Hakim (Unani physician) quickly triage a patient's Level-1 screening, taken by front-desk/support staff before the doctor sees the patient. This is decision support only — never state or imply a diagnosis.

Patient: ${patientContext.name}, ${patientContext.gender || "gender not recorded"}, ${patientContext.ageLabel}${patientContext.mizaj ? `, previously assessed Mizaj: ${patientContext.mizaj}` : ""}.
Chief complaint(s): ${chiefComplaints.join(", ") || "none recorded"}.
Overall triage flag computed from the answers: ${overallFlag ? overallFlag.toUpperCase() : "none"}.

Screening answers (flagged ones are the danger signs to prioritize):
${answerLines || "No answers recorded."}

Respond with ONLY a single valid JSON object — no markdown code fences, no commentary before or after — matching exactly this shape:
{
  "headline": "one punchy sentence, max ~18 words, capturing the overall clinical picture and urgency",
  "findings": [{ "text": "a short 3-8 word finding phrase, no trailing period, not a full sentence", "severity": "red" | "yellow" | "green" | "neutral" }],
  "unani": "one short sentence, max ~25 words, relating the presentation to relevant Unani principles (temperament axis or Akhlat) ONLY where genuinely applicable — empty string if nothing genuinely fits, never force a connection",
  "priority": "one short sentence, max ~20 words: the single most important thing the doctor should verify or examine first"
}

Rules for findings: include 3 to 6, ordered by clinical importance (most important first). Every flagged answer must appear as its own finding with "severity" matching its flag exactly (red stays red, yellow stays yellow). Include at most one "green" or "neutral" finding summarizing what is reassuring or unremarkable, if relevant. Each finding's "text" must be scannable in under a second.

Never state or imply a definitive diagnosis, and never recommend a specific treatment or formulation.`;

  const raw = await callGemini(prompt);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    if (isValidScreeningInsight(parsed)) return JSON.stringify(parsed);
  } catch {
    // Fall through — return the raw text so the UI's plain-paragraph fallback still works.
  }
  return raw;
}

export interface ClinicalRoutingInput {
  vitals: { pulse?: number | null; bpSystolic?: number | null; bpDiastolic?: number | null; spo2?: number | null; temperatureF?: number | null } | null;
  redFlagOutcome: "cleared" | "referred" | "continued_ama" | null;
  redFlagPositiveFindings: string[];
  chiefComplaints: { label: string; severityScore: number | null; onsetValue: number | null; onsetUnit: string | null }[];
  acuteSymptoms: string[];
}

export interface ClinicalRouting {
  priorityLevel: string;
  triageStream: string;
  justification: string;
}

function isValidClinicalRouting(v: any): v is ClinicalRouting {
  return v && typeof v.priorityLevel === "string" && typeof v.triageStream === "string" && typeof v.justification === "string";
}

/**
 * Suggests a triage priority/routing label for a doctor to confirm — not a
 * diagnosis, not a treatment decision. Server-side only, ephemeral (never
 * persisted; the caller re-requests on demand).
 */
export async function generateClinicalRouting(
  patientContext: { name: string; gender: string | null; ageLabel: string },
  input: ClinicalRoutingInput
): Promise<ClinicalRouting | null> {
  const vitalsLine = input.vitals
    ? [
        input.vitals.pulse != null ? `Pulse ${input.vitals.pulse} bpm` : null,
        input.vitals.bpSystolic != null || input.vitals.bpDiastolic != null ? `BP ${input.vitals.bpSystolic ?? "—"}/${input.vitals.bpDiastolic ?? "—"}` : null,
        input.vitals.spo2 != null ? `SpO2 ${input.vitals.spo2}%` : null,
        input.vitals.temperatureF != null ? `Temp ${input.vitals.temperatureF}°F` : null,
      ].filter(Boolean).join(", ") || "no readings"
    : "not recorded";

  const complaintsLine = input.chiefComplaints
    .map((c) => `${c.label}${c.severityScore != null ? ` (severity ${c.severityScore}/10)` : ""}${c.onsetValue != null ? `, onset ${c.onsetValue} ${c.onsetUnit || ""}` : ""}`)
    .join("; ") || "none recorded";

  const prompt = `You are a clinical assistant helping route a patient to the right level of care at a Unani clinic, for a doctor to confirm — this is decision support only, never a diagnosis.

Patient: ${patientContext.name}, ${patientContext.gender || "gender not recorded"}, ${patientContext.ageLabel}.
Current vitals: ${vitalsLine}.
Acute red-flag safety screen: ${input.redFlagOutcome === "cleared" ? "cleared, no positive findings" : input.redFlagOutcome === "referred" ? "already referred out" : input.redFlagOutcome === "continued_ama" ? "positive findings, patient continuing against medical advice" : "not yet completed"}${input.redFlagPositiveFindings.length ? ` (positive: ${input.redFlagPositiveFindings.join(", ")})` : ""}.
Chief complaints: ${complaintsLine}.
Accompanying acute symptoms: ${input.acuteSymptoms.join(", ") || "none recorded"}.

Respond with ONLY a single valid JSON object — no markdown code fences, no commentary — matching exactly this shape:
{
  "priorityLevel": "a short label, e.g. 'Priority Level 2: Standard Ambulatory Intake'",
  "triageStream": "a short label for which stream/track this patient should follow next, grounded only in the data above",
  "justification": "1-2 short sentences explaining the pick using only the data given — never invent findings not listed above"
}

Never state or imply a diagnosis, and never recommend a specific treatment.`;

  const raw = await callGemini(prompt);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    if (isValidClinicalRouting(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

export interface HumoralCluesInput {
  safraPercent: number;
  damPercent: number;
  saudaPercent: number;
  balghamPercent: number;
  dominant: string;
  breakdown: { source: string; safra: number; dam: number; sauda: number; balgham: number }[];
}

/**
 * Plain-language explanation of why the deterministic humor-weight engine
 * (src/lib/humor-engine.ts) landed on its computed dominant humor — Gemini
 * narrates, it never picks the number or invents a classical-text citation.
 * Server-side only, ephemeral.
 */
export async function generateHumoralClues(
  patientContext: { name: string; gender: string | null; ageLabel: string },
  input: HumoralCluesInput
): Promise<string | null> {
  const breakdownLines = input.breakdown.map((b) => `${b.source}: Safra +${b.safra}, Dam +${b.dam}, Sauda +${b.sauda}, Balgham +${b.balgham}`).join("\n");

  const prompt = `You are a Unani clinical assistant. A deterministic rule engine has already computed this patient's humoral breakdown from their recorded findings — your only job is to explain it in plain language for a doctor, grounded strictly in the data given below.

Patient: ${patientContext.name}, ${patientContext.gender || "gender not recorded"}, ${patientContext.ageLabel}.
Computed breakdown: Safra ${input.safraPercent}%, Dam ${input.damPercent}%, Sauda ${input.saudaPercent}%, Balgham ${input.balghamPercent}%. Dominant: ${input.dominant}.
Contributing findings:
${breakdownLines || "none"}

Write ONE short paragraph (2-3 sentences, plain text, no markdown) explaining why the findings point toward ${input.dominant} being dominant. Reference only the findings listed above — never invent a finding, a classical text, an author, or a quotation. Do not state or imply a diagnosis. Respond with the paragraph only, no preamble.`;

  return callGemini(prompt);
}

export interface ChiefComplaintSuggestionAi {
  label: string;
  labelLocal: string | null;
  category: string;
  rationale: string;
}

function isValidChiefComplaintSuggestions(v: any): v is ChiefComplaintSuggestionAi[] {
  return (
    Array.isArray(v) &&
    v.every((s) =>
      s && typeof s.label === "string" && s.label.trim() &&
      (s.labelLocal === null || typeof s.labelLocal === "string") &&
      typeof s.category === "string" && s.category.trim() &&
      typeof s.rationale === "string"
    )
  );
}

/**
 * Suggests new entries for the Chief Complaint catalog — never edits
 * existing ones, never auto-publishes (the caller stages these as pending
 * ChiefComplaintSuggestion rows for an admin to approve/reject). Server-side
 * only, called by the scheduled/manual discovery bot in src/lib/chief-complaint-bot.ts.
 */
export async function generateChiefComplaintSuggestions(
  existing: { label: string; category: string }[]
): Promise<ChiefComplaintSuggestionAi[] | null> {
  const existingLines = existing.map((c) => `- ${c.label} [${c.category}]`).join("\n");

  const prompt = `You are helping expand the Chief Complaint catalog of a clinical intake system built entirely around Unani (Yunani Tibb / Greco-Arabic) medicine practice. Doctors and reception staff pick from this catalog to record why a patient is visiting, so every entry must be a genuine, commonly-seen presenting complaint relevant to Unani clinical practice.

Here is the full current catalog (label [category]), so you don't suggest a duplicate and so you match its existing style:
${existingLines || "(empty)"}

Suggest 3 to 5 NEW chief complaints not already in the list above. For each one:
- "label": in the exact style already used above — an English term, followed by the classical Unani/Arabic-Persian-Urdu term in parentheses, e.g. "Vertigo (Dawar)". Only include the parenthetical classical term if you are genuinely confident it is correct, standard, textbook Unani terminology — if you are not confident, omit the parentheses entirely and give just the plain English label rather than guessing or inventing a term. Never fabricate a classical term.
- "labelLocal": a Hindi translation of the plain-English meaning (not a transliteration of the Arabic/Urdu term), or null if you're not confident of an accurate translation.
- "category": reuse one of the existing category names above if the complaint genuinely fits there; only propose a new category name (following the same plain English style as the existing ones, e.g. "Respiratory") if it truly doesn't belong in any existing one.
- "rationale": one short sentence (for the admin reviewing this, not shown to doctors) on why this is a genuine, commonly-seen Unani-relevant presenting complaint.

Respond with ONLY a single valid JSON array — no markdown code fences, no commentary before or after — matching exactly this shape:
[{ "label": "...", "labelLocal": "..." | null, "category": "...", "rationale": "..." }]

Never invent a classical term, a source, or a citation. If you cannot think of genuinely new, non-duplicate, Unani-relevant complaints, return an empty array [].`;

  const raw = await callGemini(prompt);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    if (isValidChiefComplaintSuggestions(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

export interface AllergySuggestionAi {
  label: string;
  allergenType: string;
  rationale: string;
}

function isValidAllergySuggestions(v: any): v is AllergySuggestionAi[] {
  return (
    Array.isArray(v) &&
    v.every((s) =>
      s && typeof s.label === "string" && s.label.trim() &&
      typeof s.allergenType === "string" &&
      typeof s.rationale === "string"
    )
  );
}

/**
 * Suggests new entries for the allergy list used on patient registration —
 * additive only, never edits existing tags. Server-side only, called by the
 * scheduled/manual Unani Allergy Assistant in src/lib/allergy-assistant.ts.
 */
export async function generateAllergySuggestions(existing: string[]): Promise<AllergySuggestionAi[] | null> {
  const existingLines = existing.map((l) => `- ${l}`).join("\n");

  const prompt = `You are helping expand the allergy list of a patient-intake system built entirely around Unani (Yunani Tibb / Greco-Arabic) medicine practice. Front-desk staff pick from this list to record a patient's known allergies and sensitivities before a Hakim treats them, so every entry must be a real, recognisable allergen or sensitivity that matters in a Unani clinic — especially Unani single drugs (Mufradat), herbs, oils, foods and dietary items used in Unani regimens (Ilaj-bil-Ghiza, Ilaj-bil-Dawa, Ilaj-bil-Tadbeer), plus common food, environmental and contact allergens a Unani clinic would routinely ask about.

Here is the full current list, so you don't suggest a duplicate (including the same substance under a different name) and so you match its style:
${existingLines || "(empty)"}

Suggest 3 to 5 NEW allergens not already in the list above. For each one:
- "label": in the exact style already used above — the common English name, followed by the classical Unani/Arabic-Persian-Urdu name in parentheses when there is a well-established one, e.g. "Black Seed (Kalonji)". Only include the parenthetical name if you are genuinely confident it is the correct, standard name — otherwise give just the plain English name. Never invent a name.
- "allergenType": one of "Herbal / Mufradat", "Food", "Oil / Topical", "Environmental", "Animal / Insect", "Other".
- "rationale": one short sentence (for the admin's log) on why this is a genuine, recognised allergen or sensitivity relevant to Unani practice.

Respond with ONLY a single valid JSON array — no markdown code fences, no commentary before or after — matching exactly this shape:
[{ "label": "...", "allergenType": "...", "rationale": "..." }]

Only suggest substances with a genuine, documented potential to cause allergic or hypersensitivity reactions — never a disease, symptom or drug class. Never invent a classical name, a source or a citation. If you cannot think of genuinely new, non-duplicate, relevant allergens, return an empty array [].`;

  const raw = await callGemini(prompt);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    if (isValidAllergySuggestions(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

export interface SupplementSuggestionAi {
  label: string;
  herbType: string;
  rationale: string;
}

function isValidSupplementSuggestions(v: any): v is SupplementSuggestionAi[] {
  return (
    Array.isArray(v) &&
    v.every((s) =>
      s && typeof s.label === "string" && s.label.trim() &&
      typeof s.herbType === "string" &&
      typeof s.rationale === "string"
    )
  );
}

/**
 * Suggests new entries for the "Supplement / Herb" list used on patient
 * registration (Active Routine Medications / Herbs) — additive only, never
 * edits existing tags. Server-side only, called by the scheduled/manual
 * Unani Supplement & Herb Assistant in src/lib/supplement-assistant.ts.
 */
export async function generateSupplementSuggestions(existing: string[]): Promise<SupplementSuggestionAi[] | null> {
  const existingLines = existing.map((l) => `- ${l}`).join("\n");

  const prompt = `You are helping expand the "Supplement / Herb" list of a patient-intake system built entirely around Unani (Yunani Tibb / Greco-Arabic) medicine practice. Front-desk staff pick from this list to record which herbs, herbal supplements and Unani preparations a patient already takes routinely, so the Hakim knows before prescribing. Every entry must be a real, widely used item in Unani practice — prioritise:
1. Unani single drugs (Advia Mufrada / Mufradat) commonly taken as herbs or supplements, e.g. "Licorice (Asl-us-Sus)", "Borage (Gaozaban)".
2. Well-known classical Unani compound formulations (Murakkabat) patients take routinely — Khamira, Majoon, Jawarish, Itrifal, Sharbat, Arq, Habb, Laooq, Safoof, Roghan, etc. — written by their standard classical name, e.g. "Khamira Gaozaban", "Itrifal Kishneezi".

Here is the full current list, so you don't suggest a duplicate (including the same item under a different name) and so you match its style:
${existingLines || "(empty)"}

Suggest 3 to 5 NEW items not already in the list above. For each one:
- "label": for a single herb, the common English name followed by the Unani name in parentheses, e.g. "Fennel (Badiyan)"; for a compound formulation, its standard classical name, e.g. "Majoon Falasifa". Only use a Unani name you are genuinely confident is correct and standard — never invent one, and never invent a formulation.
- "herbType": one of "Single Herb (Mufrad)", "Compound Formulation (Murakkab)", "Mineral / Animal Origin", "Oil / Roghan", "Other".
- "rationale": one short sentence (for the admin's log) on what it is and why it is commonly taken in Unani practice.

Respond with ONLY a single valid JSON array — no markdown code fences, no commentary before or after — matching exactly this shape:
[{ "label": "...", "herbType": "...", "rationale": "..." }]

Only suggest genuine herbs, herbal supplements or classical Unani preparations — never a modern prescription drug, a disease or a symptom. Never invent a name, a formulation, a source or a citation. If you cannot think of genuinely new, non-duplicate items, return an empty array [].`;

  const raw = await callGemini(prompt);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    if (isValidSupplementSuggestions(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

export interface GroundedChunk { uri: string; title: string | null }
export interface GroundedSupport { text: string; chunkIndices: number[] }
export interface GroundedResult { text: string; chunks: GroundedChunk[]; supports: GroundedSupport[] }

/**
 * Gemini call with Google Search grounding: the model searches the web and
 * returns, alongside its text, the pages it used (groundingChunks) and which
 * sentence of its answer each page supports (groundingSupports). That mapping
 * is what lets callers attach real sources to individual claims instead of
 * asking the model to "cite" (which invites fabricated references).
 * Returns null on any failure or missing key. Server-side only.
 */
async function callGeminiGrounded(prompt: string): Promise<GroundedResult | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
    }
  );
  if (!res.ok) {
    console.error("Gemini grounded call error:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const json = await res.json();
  const candidate = json?.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p: any) => (typeof p?.text === "string" ? p.text : "")).join("");
  if (!text.trim()) return null;
  const gm = candidate?.groundingMetadata || {};
  return {
    text,
    chunks: (gm.groundingChunks || []).map((c: any) => ({ uri: String(c?.web?.uri || ""), title: c?.web?.title ? String(c.web.title) : null })),
    supports: (gm.groundingSupports || [])
      .filter((s: any) => s?.segment?.text)
      .map((s: any) => ({ text: String(s.segment.text), chunkIndices: Array.isArray(s.groundingChunkIndices) ? s.groundingChunkIndices : [] })),
  };
}

export interface SupplementResearchInput {
  label: string;
  /** What the record holds today — so the search can confirm or correct it. */
  currentSummary: string | null;
  complaintCatalog: string[];
  allergyCatalog: string[];
  symptomCatalog: string[];
  medicationCatalog: string[];
  supplementCatalog: string[];
}

/**
 * Search-backed research for one Supplement / Herb record. Output is a strict
 * line format (one fact per line, each with a plain-language statement) so
 * grounding supports can be matched back to individual facts; parsing lives
 * in src/lib/supplement-enrichment.ts. Never asks for dosage.
 */
export async function researchSupplementSourced(input: SupplementResearchInput): Promise<GroundedResult | null> {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n") || "(empty)";
  const prompt = `You are a Unani (Yunani Tibb / Greco-Arabic) materia medica researcher building a reference record for a Unani clinic's database. Use Google Search to research the substance below in reliable sources — AYUSH / Unani pharmacopoeia and formulary material (e.g. Unani Pharmacopoeia of India, National Formulary of Unani Medicine), classical Unani materia medica, peer-reviewed literature, botanical/taxonomic databases and drug-safety references. This is reference information for qualified Hakims, never a prescription.

SUBSTANCE: ${input.label}
${input.currentSummary ? `The record currently says (unverified — confirm or correct it, do not just repeat it): ${input.currentSummary}` : ""}

Write ONLY lines in the formats below, one fact per line, no markdown, no headings, no numbering. Every line ends with a STATEMENT: one complete plain-language sentence stating the fact as your sources state it. Fields are separated by " | ".

FIELD | <field> | <value> | <confidence> | <statement>
  <field> is one of: category, unaniName, englishName, urduName, hindiName, arabicName, botanicalName, family, partsUsed, mizaj, synonyms, actions, dosageForms, routes, preparation, summary, traditionalDescription, modernEvidence
  - category: exactly one of "Single Herb (Mufrad)", "Compound Formulation (Murakkab)", "Mineral (Ma'dani)", "Animal-derived (Haiwani)", "Oil (Roghan)", "Nutritional Supplement"
  - Names: write urduName in Urdu script, hindiName in Devanagari, arabicName in Arabic script.
  - botanicalName, family, partsUsed: plant-based single herbs only.
  - mizaj: classical temperament with degree where documented, e.g. "Hot 2° / Dry 2°".
  - synonyms, actions, dosageForms, routes: a semicolon-separated list. actions = Unani pharmacological actions (Afaal), e.g. "Muqawwi-e-Qalb (cardiac tonic); Mufarreh (exhilarant)".
  - summary: 1-2 sentences on what it is. traditionalDescription: 2-4 sentences of its classical Unani description and role. modernEvidence: 1-3 sentences on what modern studies have actually found, saying plainly if evidence is limited or only preclinical. Never present a traditional claim as scientifically proven.
USED_FOR | <exact label from COMPLAINTS> | <evidence> | <confidence> | <statement>
SYMPTOM | <exact label from SYMPTOMS> | <evidence> | <confidence> | <statement>
ALLERGY_RELIEF | <exact label from ALLERGIES> | <evidence> | <confidence> | <statement>   (traditionally used to ease reactions to that allergen)
ALLERGY_CAUTION | <exact label from ALLERGIES> | <evidence> | <confidence> | <statement>   (it contains, or may cross-react with, that allergen)
INGREDIENT | <ingredient name, preferring the exact label from SUPPLEMENTS when it is one> | <role> | <proportion or -> | <confidence> | <statement>   (compound formulations only; role = principal, supporting, base, vehicle or unknown; proportion only if documented)
SAFETY | <category> | <severity> | <evidence> | <confidence> | <statement>   (category = contraindication, precaution, pregnancy, lactation, pediatric, adverse_effect or toxicity; severity = high, moderate or low)
INTERACTION | <exact label from MEDICATIONS> | <severity> | <evidence> | <confidence> | <statement>
BRAND | <manufacturer> | <product name> | <confidence> | <statement>
UNKNOWN | <topic> | <statement>   (topic = a FIELD name, or pregnancy, lactation, pediatric, interactions, allergy — use it when your sources do not document that topic)
CONFLICT | <field or topic> | <statement describing the conflicting claims and who makes each>

<evidence> is one of: traditional, clinical, preclinical, regulatory, unspecified. <confidence> is high, medium or low.

Rules:
- Only state what your sources support. If you cannot find something, write an UNKNOWN line — never guess. Missing allergy or safety information is NOT evidence of safety; say UNKNOWN.
- Always cover pregnancy, lactation and pediatric use — with a SAFETY line if documented, otherwise an UNKNOWN line.
- Use list labels EXACTLY as written. Skip a relationship rather than force a weak match; never link because names merely look similar.
- BRAND only for real manufacturer/product pairs your sources show exist (e.g. Hamdard, Rex, Dehlvi, Qarshi, Hakeem Hashmi).
- Never invent names, botanical identities, sources, studies or interactions. Never give any dosage or quantity to take.

COMPLAINTS:
${list(input.complaintCatalog)}

SYMPTOMS:
${list(input.symptomCatalog)}

ALLERGIES:
${list(input.allergyCatalog)}

MEDICATIONS (allopathic):
${list(input.medicationCatalog)}

SUPPLEMENTS (other records in this database):
${list(input.supplementCatalog)}`;

  return callGeminiGrounded(prompt);
}

export interface MedicationResearchInput {
  label: string;
  currentSummary: string | null;
  complaintCatalog: string[];
  allergyCatalog: string[];
  symptomCatalog: string[];
  /** Other allopathic medication records — for ingredient and drug-drug interaction links only. */
  medicationCatalog: string[];
}

/**
 * Search-backed research for one allopathic medication record — same line
 * format and grounding approach as researchSupplementSourced, but restricted
 * to allopathic references (product labels, regulators, drug references). It
 * never links to Unani/herbal records. Strengths/formulations are product
 * facts and are captured; dosing instructions are never asked for.
 */
export async function researchMedicationSourced(input: MedicationResearchInput): Promise<GroundedResult | null> {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n") || "(empty)";
  const prompt = `You are a clinical pharmacology researcher building a reference record for an allopathic (modern / conventional) medicine in a clinic database in India. Use Google Search to research it in reliable sources — official prescribing information and product labels (DailyMed / FDA, EMA SmPC, CDSCO), Indian Pharmacopoeia / National Formulary of India, WHO ATC/DDD index, BNF, recognised drug references and peer-reviewed literature. This is reference information for qualified clinicians to check, never a prescription. Do not use herbal, Unani or Ayurvedic sources.

MEDICINE: ${input.label}
${input.currentSummary ? `The record currently says (unverified — confirm or correct it): ${input.currentSummary}` : ""}

Write ONLY lines in the formats below, one fact per line, no markdown, no headings, no numbering. Every line ends with a STATEMENT: one complete plain-language sentence stating the fact as your sources state it. Fields are separated by " | ".

FIELD | <field> | <value> | <confidence> | <statement>
  <field> is one of: category, genericName, saltForm, therapeuticClass, pharmacologicalClass, mechanism, atcCode, rxStatus, productStatus, synonyms, strengths, dosageForms, routes, summary
  - category: exactly one of "Single-ingredient medicine", "Fixed-dose combination", "Biologic / Insulin", "Vitamin / Mineral preparation"
  - genericName: the INN. saltForm: the salt or chemical form if the product uses one (e.g. "Hydrochloride"), else omit the line.
  - atcCode: WHO ATC code(s), comma-separated. rxStatus: its prescription status in India (e.g. "Prescription only — Schedule H", "OTC"). productStatus: active, discontinued or unknown.
  - synonyms, strengths, dosageForms, routes: a semicolon-separated list. strengths = strengths/formulations that exist on the market, e.g. "500 mg tablet; 850 mg tablet; 1000 mg extended-release tablet". Never write a dose to take, a frequency or a regimen.
  - mechanism: 1-2 sentences. summary: 1-2 sentences on what it is and what it is used for.
USED_FOR | <exact label from COMPLAINTS> | <relation> | <evidence> | <confidence> | <statement>
  <relation> is one of: approved_indication (a labelled indication), evidence_supported (guideline/evidence-backed but not labelled), symptom_relief (relieves the symptom without treating the cause), off_label, not_recommended (established as unsuitable or contraindicated for it). Link only where your sources support it — never because the drug is merely mentioned alongside the complaint.
SYMPTOM | <exact label from SYMPTOMS> | <evidence> | <confidence> | <statement>
ALLERGY_RELIEF | <exact label from ALLERGIES> | <evidence> | <confidence> | <statement>   (it is used to treat allergic reactions to that allergen, e.g. an antihistamine and Pollen)
ALLERGY_CAUTION | <allergen or drug class> | <evidence> | <confidence> | <statement>   (documented hypersensitivity or cross-reactivity, e.g. "Penicillins", "Sulfonamides", or an excipient such as "Lactose". Use the exact ALLERGIES label when one fits; otherwise name the allergen plainly. Say when cross-reactivity is uncertain — never claim a whole class reacts unless sources establish it.)
INGREDIENT | <ingredient name, including the salt> | <role> | <strength per unit or -> | <confidence> | <statement>   (role = active or excipient; list every ACTIVE ingredient — each one separately for combinations; list an excipient only if it is clinically relevant, e.g. a known allergen)
SAFETY | <category> | <severity> | <evidence> | <confidence> | <statement>
  <category> is one of: contraindication, warning (incl. boxed warnings), precaution, pregnancy, lactation, pediatric, geriatric, renal, hepatic, monitoring, adverse_effect, toxicity, food_interaction. <severity> = high, moderate or low. For renal/hepatic, say whether dose adjustment or avoidance is needed — without numbers.
INTERACTION | <exact label from MEDICATIONS> | <severity> | <evidence> | <confidence> | <statement>   (clinically significant drug-drug interactions only)
BRAND | <manufacturer> | <brand name> | <confidence> | <statement>   (brands marketed in India, then major international ones)
UNKNOWN | <topic> | <statement>   (topic = a FIELD name, or pregnancy, lactation, pediatric, renal, hepatic, interactions, allergy — when your sources do not document it)
CONFLICT | <field or topic> | <statement describing the conflicting claims and who makes each>

<evidence> is one of: regulatory (product label / regulator), clinical, preclinical, unspecified. <confidence> is high, medium or low.

Rules:
- Only state what your sources support. If you cannot find something, write an UNKNOWN line — never guess. Missing safety or interaction information is NOT evidence of safety.
- Always cover pregnancy, lactation, pediatric, renal and hepatic use — with a SAFETY line if documented, otherwise an UNKNOWN line.
- Keep contraindications, warnings, precautions, adverse effects and interactions as separate lines.
- Use list labels EXACTLY as written; skip a relationship rather than force a weak match.
- Never invent brands, codes, strengths, sources or studies. Never give a dose to take, a frequency or a treatment regimen.

COMPLAINTS:
${list(input.complaintCatalog)}

SYMPTOMS:
${list(input.symptomCatalog)}

ALLERGIES:
${list(input.allergyCatalog)}

MEDICATIONS (other allopathic records in this database):
${list(input.medicationCatalog)}`;

  return callGeminiGrounded(prompt);
}

export interface MedicationSuggestionAi {
  label: string;
  drugClass: string;
  rationale: string;
}

/**
 * Suggests new entries for the allopathic "Medication" list used on patient
 * registration (Active Routine Medications) — additive only, never edits
 * existing tags. This records what a patient already takes so the Hakim can
 * account for it; it is not prescribing. Server-side only, called by the
 * scheduled/manual Allopathic Medication Assistant in src/lib/medication-assistant.ts.
 */
export async function generateMedicationSuggestions(existing: string[]): Promise<MedicationSuggestionAi[] | null> {
  const prompt = `You are helping expand the allopathic (modern / conventional) "Medication" list of a patient-intake system at a Unani clinic in India. Front-desk staff pick from this list to record which allopathic medicines a patient is ALREADY taking, so the Hakim can account for them — e.g. avoid interactions with Unani herbs — before treating. This is a record of current medicines, not a prescription.

Prioritise medicines that patients in India and South Asia most commonly take on an ongoing or frequent basis — for diabetes, hypertension, heart disease, cholesterol, thyroid, asthma/COPD, acid-peptic disease, pain and arthritis, epilepsy, depression/anxiety, anticoagulation, contraception/hormones, vitamins prescribed as medicines, common antibiotics and antihistamines.

Here is the full current list, so you don't suggest a duplicate (including the same drug under a different name) and so you match its style:
${existing.map((l) => `- ${l}`).join("\n") || "(empty)"}

Suggest 3 to 5 NEW medicines not already in the list above. For each one:
- "label": the generic (INN) name, matching the style above, e.g. "Telmisartan", "Glimepiride". Add a short qualifier only when it identifies a distinct, commonly recorded product, e.g. "Budesonide Inhaler", "Insulin Glargine". Never use a brand name as the label.
- "drugClass": its therapeutic class, e.g. "Antihypertensive", "Antidiabetic", "Statin (Lipid-lowering)", "Anticoagulant", "Antiplatelet", "Thyroid", "Proton Pump Inhibitor", "Bronchodilator", "Antiepileptic", "Antidepressant", "Analgesic / NSAID", "Antihistamine", "Antibiotic", "Hormonal", "Other".
- "rationale": one short sentence (for the admin's log) on what it's used for and why it's commonly taken.

Respond with ONLY a single valid JSON array — no markdown code fences, no commentary before or after — matching exactly this shape:
[{ "label": "...", "drugClass": "...", "rationale": "..." }]

Only suggest real, approved allopathic medicines — never a Unani/Ayurvedic/herbal product (those belong on a separate list), a disease or a symptom. Never invent a drug. If you cannot think of genuinely new, non-duplicate medicines, return an empty array [].`;

  const raw = await callGemini(prompt);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(stripCodeFence(raw));
    if (Array.isArray(parsed)) {
      return parsed
        .filter((s: any) => s && typeof s.label === "string" && s.label.trim())
        .map((s: any) => ({
          label: s.label.trim(),
          drugClass: typeof s.drugClass === "string" ? s.drugClass.trim() : "",
          rationale: typeof s.rationale === "string" ? s.rationale.trim() : "",
        }));
    }
  } catch {
    // fall through
  }
  return null;
}
