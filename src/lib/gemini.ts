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

/** Short, scoped clinical-language summary of a patient's recent vitals trend. Server-side only. */
export async function generateVitalsInsight(
  patientContext: { name: string; gender: string | null; ageLabel: string },
  visits: VitalsInsightVisit[]
): Promise<string | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;

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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!res.ok) {
    console.error("Gemini insight error:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text.trim() : null;
}
