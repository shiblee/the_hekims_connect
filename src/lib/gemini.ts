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

/** Short clinical-language summary of an L1 Screening, for the doctor to triage quickly. Server-side only. */
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

Write a structured triage brief in plain text (no markdown) with exactly these labeled sections, each 1-3 sentences:
Presenting Picture: summarize the complaint(s) and what the pattern of answers suggests.
Danger Signs: call out every flagged answer explicitly and why it is clinically significant — if none are flagged, say so plainly.
Unani Perspective: relate the presentation to relevant Unani principles where genuinely applicable — e.g. which temperament axis (Hararat/Burudat, Rutoobat/Yuboosat) or Akhlat (Dam, Balgham, Safra, Sauda) the pattern points toward, and how it aligns or conflicts with the patient's recorded Mizaj if known. Only draw this connection when the symptoms actually support it — do not force a classical label onto a presentation that doesn't fit one, and state uncertainty plainly when it exists.
Priority for the Doctor: the single most important thing to verify or examine first.

Stay factual and concise. Never state or imply a definitive diagnosis, and never recommend a specific treatment or formulation.`;

  return callGemini(prompt);
}
