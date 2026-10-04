// Early Warning Score — implements the standard, publicly documented NEWS2
// (National Early Warning Score 2, Royal College of Physicians) point table,
// scale 1. This is decision-support only, not a diagnosis, and is NOT a
// reproduction of any specific hospital's own (proprietary, unpublished) MEWS
// algorithm — it's the public clinical standard the reference material itself
// cites. Pure function: no I/O, safe to call from both client and server.

export interface EwsInput {
  respiratoryRate?: number | null;
  spo2?: number | null;
  onOxygen?: boolean;
  bpSystolic?: number | null;
  pulse?: number | null;
  consciousnessLevel?: string | null; // AVPU: "Alert (A)" / "Verbal (V)" / "Pain (P)" / "Unresponsive (U)"
  temperatureC?: number | null;
}

export type EwsBand = "low" | "low-medium" | "medium" | "high";

export interface EwsResult {
  total: number;
  band: EwsBand;
  label: string;
  advice: string;
  parametersScored: number;
}

function scoreRespiratoryRate(v: number): number {
  if (v <= 8) return 3;
  if (v <= 11) return 1;
  if (v <= 20) return 0;
  if (v <= 24) return 2;
  return 3;
}

function scoreSpo2(v: number): number {
  if (v <= 91) return 3;
  if (v <= 93) return 2;
  if (v <= 95) return 1;
  return 0;
}

function scoreBpSystolic(v: number): number {
  if (v <= 90) return 3;
  if (v <= 100) return 2;
  if (v <= 110) return 1;
  if (v <= 219) return 0;
  return 3;
}

function scorePulse(v: number): number {
  if (v <= 40) return 3;
  if (v <= 50) return 1;
  if (v <= 90) return 0;
  if (v <= 110) return 1;
  if (v <= 130) return 2;
  return 3;
}

function scoreConsciousness(level: string | null | undefined): number {
  if (!level) return 0;
  return level.startsWith("Alert") ? 0 : 3;
}

function scoreTemperature(v: number): number {
  if (v <= 35.0) return 3;
  if (v <= 36.0) return 1;
  if (v <= 38.0) return 0;
  if (v <= 39.0) return 1;
  return 2;
}

export function calculateEWS(input: EwsInput): EwsResult | null {
  let total = 0;
  let maxParam = 0;
  let parametersScored = 0;

  const add = (score: number) => {
    total += score;
    maxParam = Math.max(maxParam, score);
    parametersScored += 1;
  };

  if (input.respiratoryRate != null) add(scoreRespiratoryRate(input.respiratoryRate));
  if (input.spo2 != null) add(scoreSpo2(input.spo2));
  if (input.onOxygen != null) add(input.onOxygen ? 2 : 0);
  if (input.bpSystolic != null) add(scoreBpSystolic(input.bpSystolic));
  if (input.pulse != null) add(scorePulse(input.pulse));
  if (input.consciousnessLevel) add(scoreConsciousness(input.consciousnessLevel));
  if (input.temperatureC != null) add(scoreTemperature(input.temperatureC));

  if (parametersScored === 0) return null;

  let band: EwsBand;
  let label: string;
  let advice: string;

  if (total >= 7) {
    band = "high";
    label = "High risk";
    advice = "Emergency clinical assessment recommended.";
  } else if (total >= 5) {
    band = "medium";
    label = "Medium risk";
    advice = "Urgent clinical review recommended.";
  } else if (maxParam >= 3) {
    band = "low-medium";
    label = "Low–medium risk";
    advice = "A single reading is significantly abnormal — prompt review recommended.";
  } else if (total >= 1) {
    band = "low";
    label = "Low risk";
    advice = "Routine monitoring; increase frequency if any reading worsens.";
  } else {
    band = "low";
    label = "Low risk";
    advice = "All scored readings within the normal range.";
  }

  return { total, band, label, advice, parametersScored };
}
