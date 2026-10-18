// Plain-language status for a vital-sign reading — what the tiles and the
// detail pop-up say about a value. "Normal" always means the admin-configured
// normal range (Admin → Settings → Vitals Validation), so these labels never
// contradict the review flags used elsewhere; the words outside that range
// are standard triage wording. Decision support only, never a diagnosis.

export type VitalTone = "ok" | "watch" | "alert" | "urgent" | "check";

export interface VitalStatus {
  tone: VitalTone;
  /** Short label for a pill, e.g. "Fever", "High", "Low oxygen". */
  label: string;
  /** One plain sentence explaining the reading. */
  detail: string;
}

export const TONE_STYLES: Record<VitalTone, { text: string; bg: string; border: string; dot: string; bar: string }> = {
  ok: { text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500", bar: "#10b981" },
  watch: { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/40", dot: "bg-amber-500", bar: "#f59e0b" },
  alert: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/40", dot: "bg-red-500", bar: "#ef4444" },
  urgent: { text: "text-red-700 dark:text-red-400", bg: "bg-red-500/15", border: "border-red-500/60", dot: "bg-red-600", bar: "#dc2626" },
  check: { text: "text-violet-700 dark:text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/40", dot: "bg-violet-500", bar: "#8b5cf6" },
};

/** The visible window of each range bar (wider than "normal" so out-of-range readings still land on it). */
export const GAUGE_SCALE: Record<string, [number, number]> = {
  pulse: [30, 160], bpSystolic: [70, 200], bpDiastolic: [40, 130], spo2: [70, 100], temperatureF: [94, 105], bmi: [15, 40],
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const rangeText = (r: [number, number], unit: string) => `${fmt(r[0])}–${fmt(r[1])} ${unit}`;

export function bpStatus(sys: number | null, dia: number | null, ranges: Record<string, [number, number]>): VitalStatus | null {
  if (sys == null && dia == null) return null;
  if (sys != null && dia != null && dia >= sys) {
    return { tone: "check", label: "Check reading", detail: `The lower number (diastolic ${dia}) can't be higher than the upper number (systolic ${sys}) — this is likely an entry mistake. Please re-check and correct it.` };
  }
  const [sLo, sHi] = ranges.bpSystolic; const [dLo, dHi] = ranges.bpDiastolic;
  const part = (name: string, v: number | null, lo: number, hi: number) =>
    v == null ? null : v < lo ? `${name} ${v} is below normal` : v > hi ? `${name} ${v} is above normal` : `${name} ${v} is normal`;
  const detail = [part("Systolic", sys, sLo, sHi), part("diastolic", dia, dLo, dHi)].filter(Boolean).join("; ")
    + ` (normal ${fmt(sLo)}–${fmt(sHi)} / ${fmt(dLo)}–${fmt(dHi)} mmHg).`;
  const high = (sys != null && sys > sHi) || (dia != null && dia > dHi);
  const low = (sys != null && sys < sLo) || (dia != null && dia < dLo);
  if ((sys != null && sys >= 180) || (dia != null && dia >= 120)) return { tone: "urgent", label: "Very high", detail: `${detail} This level needs a doctor's attention now.` };
  if (sys != null && sys < 80) return { tone: "urgent", label: "Very low", detail: `${detail} This level needs a doctor's attention now.` };
  if ((sys != null && sys >= 140) || (dia != null && dia >= 90)) return { tone: "alert", label: "High", detail };
  if (high && low) return { tone: "watch", label: "Uneven", detail };
  if (high) return { tone: "watch", label: "Raised", detail };
  if (low) return { tone: "watch", label: "Low", detail };
  return { tone: "ok", label: "Normal", detail };
}

export function pulseStatus(v: number | null, ranges: Record<string, [number, number]>): VitalStatus | null {
  if (v == null) return null;
  const r = ranges.pulse;
  const normal = `normal ${rangeText(r, "bpm")}`;
  if (v < 40) return { tone: "urgent", label: "Very slow", detail: `${v} bpm is much slower than ${normal} — needs a doctor's attention now.` };
  if (v > 130) return { tone: "urgent", label: "Very fast", detail: `${v} bpm is much faster than ${normal} — needs a doctor's attention now.` };
  if (v < r[0]) return { tone: "watch", label: "Slow", detail: `${v} bpm is slower than ${normal}.` };
  if (v > r[1]) return { tone: "alert", label: "Fast", detail: `${v} bpm is faster than ${normal}.` };
  return { tone: "ok", label: "Normal", detail: `${v} bpm is within the ${normal}.` };
}

export function spo2Status(v: number | null, ranges: Record<string, [number, number]>): VitalStatus | null {
  if (v == null) return null;
  const r = ranges.spo2;
  if (v <= 90) return { tone: "urgent", label: "Very low oxygen", detail: `Oxygen at ${v}% is well below normal (${rangeText(r, "%")}) — needs a doctor's attention now.` };
  if (v < r[0]) return { tone: "alert", label: "Low oxygen", detail: `Oxygen at ${v}% is below normal (${rangeText(r, "%")}).` };
  return { tone: "ok", label: "Normal", detail: `Oxygen at ${v}% is within the normal range (${rangeText(r, "%")}).` };
}

export function temperatureStatus(f: number | null, ranges: Record<string, [number, number]>): VitalStatus | null {
  if (f == null) return null;
  const r = ranges.temperatureF;
  const c = ((f - 32) * 5) / 9;
  const both = `${fmt(f)}°F (${c.toFixed(1)}°C)`;
  if (f < 95) return { tone: "urgent", label: "Very low", detail: `${both} is far below normal (${rangeText(r, "°F")}) — needs a doctor's attention now.` };
  if (f >= 104) return { tone: "urgent", label: "Very high fever", detail: `${both} is a very high fever — needs a doctor's attention now.` };
  if (f >= 103) return { tone: "alert", label: "High fever", detail: `${both} is a high fever (normal ${rangeText(r, "°F")}).` };
  if (f >= 100.4) return { tone: "alert", label: "Fever", detail: `${both} is a fever (normal ${rangeText(r, "°F")}).` };
  if (f > r[1]) return { tone: "watch", label: "Slightly raised", detail: `${both} is a little above normal (${rangeText(r, "°F")}), below fever level (100.4°F).` };
  if (f < r[0]) return { tone: "watch", label: "Low", detail: `${both} is a little below normal (${rangeText(r, "°F")}).` };
  return { tone: "ok", label: "Normal", detail: `${both} is within the normal range (${rangeText(r, "°F")}).` };
}

export function bmiStatus(bmi: number | null): VitalStatus | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return { tone: "watch", label: "Underweight", detail: `BMI ${bmi.toFixed(1)} is below the healthy range (18.5–24.9).` };
  if (bmi < 25) return { tone: "ok", label: "Healthy weight", detail: `BMI ${bmi.toFixed(1)} is within the healthy range (18.5–24.9).` };
  if (bmi < 30) return { tone: "watch", label: "Overweight", detail: `BMI ${bmi.toFixed(1)} is above the healthy range (18.5–24.9).` };
  return { tone: "alert", label: "Obese", detail: `BMI ${bmi.toFixed(1)} is in the obese range (30 or more).` };
}

/** Reference bands for the pop-up's "What's normal?" section. */
export function referenceBands(key: string, ranges: Record<string, [number, number]>): { label: string; range: string; tone: VitalTone }[] {
  switch (key) {
    case "bpSystolic": return [
      { label: "Low", range: `below ${fmt(ranges.bpSystolic[0])} / ${fmt(ranges.bpDiastolic[0])}`, tone: "watch" },
      { label: "Normal", range: `${fmt(ranges.bpSystolic[0])}–${fmt(ranges.bpSystolic[1])} / ${fmt(ranges.bpDiastolic[0])}–${fmt(ranges.bpDiastolic[1])}`, tone: "ok" },
      { label: "Raised", range: `above ${fmt(ranges.bpSystolic[1])} / ${fmt(ranges.bpDiastolic[1])}`, tone: "watch" },
      { label: "High", range: "140 / 90 or more", tone: "alert" },
      { label: "Very high — urgent", range: "180 / 120 or more", tone: "urgent" },
    ];
    case "pulse": return [
      { label: "Very slow — urgent", range: "below 40", tone: "urgent" },
      { label: "Slow", range: `40–${fmt(ranges.pulse[0] - 1)}`, tone: "watch" },
      { label: "Normal", range: `${fmt(ranges.pulse[0])}–${fmt(ranges.pulse[1])}`, tone: "ok" },
      { label: "Fast", range: `${fmt(ranges.pulse[1] + 1)}–130`, tone: "alert" },
      { label: "Very fast — urgent", range: "above 130", tone: "urgent" },
    ];
    case "spo2": return [
      { label: "Normal", range: `${fmt(ranges.spo2[0])}–${fmt(ranges.spo2[1])}%`, tone: "ok" },
      { label: "Low oxygen", range: `91–${fmt(ranges.spo2[0] - 1)}%`, tone: "alert" },
      { label: "Very low — urgent", range: "90% or less", tone: "urgent" },
    ];
    case "temperatureF": return [
      { label: "Low", range: `below ${fmt(ranges.temperatureF[0])}°F`, tone: "watch" },
      { label: "Normal", range: `${fmt(ranges.temperatureF[0])}–${fmt(ranges.temperatureF[1])}°F`, tone: "ok" },
      { label: "Slightly raised", range: `up to 100.3°F`, tone: "watch" },
      { label: "Fever", range: "100.4–102.9°F", tone: "alert" },
      { label: "High fever", range: "103°F or more", tone: "urgent" },
    ];
    case "bmi": case "heightCm": return [
      { label: "Underweight", range: "below 18.5", tone: "watch" },
      { label: "Healthy weight", range: "18.5–24.9", tone: "ok" },
      { label: "Overweight", range: "25–29.9", tone: "watch" },
      { label: "Obese", range: "30 or more", tone: "alert" },
    ];
    default: return [];
  }
}
