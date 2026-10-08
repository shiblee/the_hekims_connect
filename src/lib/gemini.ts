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
