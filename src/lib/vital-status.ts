// Plain-language status for a vital-sign reading — what the tiles and the
// detail pop-up say about a value. "Normal" always means the admin-configured
// normal range (Admin → Settings → Vitals Validation), so these labels never
// contradict the review flags used elsewhere; the words outside that range
// are standard triage wording. Decision support only, never a diagnosis.

import { VITAL_STATUS } from "@/lib/i18n/app-strings/clinic-vitals";

export type VitalTone = "ok" | "watch" | "alert" | "urgent" | "check";

/** Translator for the words below (pass `useTranslations("clinic.vital_status")`); defaults to English. */
export type VitalT = (key: string, values?: Record<string, string | number>) => string;
const EN = Object.fromEntries(VITAL_STATUS.map((s) => [s.key.slice("clinic.vital_status.".length), s.en]));
const english: VitalT = (key, values) => (EN[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(values?.[k] ?? ""));

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

export function bpStatus(sys: number | null, dia: number | null, ranges: Record<string, [number, number]>, t: VitalT = english): VitalStatus | null {
  if (sys == null && dia == null) return null;
  if (sys != null && dia != null && dia >= sys) {
    return { tone: "check", label: t("check"), detail: t("bp_check", { dia, sys }) };
  }
  const [sLo, sHi] = ranges.bpSystolic; const [dLo, dHi] = ranges.bpDiastolic;
  const part = (name: "sys" | "dia", v: number | null, lo: number, hi: number) =>
    v == null ? null : t(`${name}_${v < lo ? "below" : v > hi ? "above" : "normal"}`, { v });
  const detail = t("bp_detail", { parts: [part("sys", sys, sLo, sHi), part("dia", dia, dLo, dHi)].filter(Boolean).join("; "), range: `${fmt(sLo)}–${fmt(sHi)} / ${fmt(dLo)}–${fmt(dHi)}` });
  const high = (sys != null && sys > sHi) || (dia != null && dia > dHi);
  const low = (sys != null && sys < sLo) || (dia != null && dia < dLo);
  if ((sys != null && sys >= 180) || (dia != null && dia >= 120)) return { tone: "urgent", label: t("very_high"), detail: `${detail} ${t("urgent_now")}` };
  if (sys != null && sys < 80) return { tone: "urgent", label: t("very_low"), detail: `${detail} ${t("urgent_now")}` };
  if ((sys != null && sys >= 140) || (dia != null && dia >= 90)) return { tone: "alert", label: t("high"), detail };
  if (high && low) return { tone: "watch", label: t("uneven"), detail };
  if (high) return { tone: "watch", label: t("raised"), detail };
  if (low) return { tone: "watch", label: t("low"), detail };
  return { tone: "ok", label: t("normal"), detail };
}

export function pulseStatus(v: number | null, ranges: Record<string, [number, number]>, t: VitalT = english): VitalStatus | null {
  if (v == null) return null;
  const r = ranges.pulse;
  const range = rangeText(r, "bpm");
  if (v < 40) return { tone: "urgent", label: t("very_slow"), detail: t("pulse_very_slow", { v, range }) };
  if (v > 130) return { tone: "urgent", label: t("very_fast"), detail: t("pulse_very_fast", { v, range }) };
  if (v < r[0]) return { tone: "watch", label: t("slow"), detail: t("pulse_slow", { v, range }) };
  if (v > r[1]) return { tone: "alert", label: t("fast"), detail: t("pulse_fast", { v, range }) };
  return { tone: "ok", label: t("normal"), detail: t("pulse_normal", { v, range }) };
}

export function spo2Status(v: number | null, ranges: Record<string, [number, number]>, t: VitalT = english): VitalStatus | null {
  if (v == null) return null;
  const r = ranges.spo2;
  const range = rangeText(r, "%");
  if (v <= 90) return { tone: "urgent", label: t("very_low_oxygen"), detail: t("spo2_very_low", { v, range }) };
  if (v < r[0]) return { tone: "alert", label: t("low_oxygen"), detail: t("spo2_low", { v, range }) };
  return { tone: "ok", label: t("normal"), detail: t("spo2_normal", { v, range }) };
}

export function temperatureStatus(f: number | null, ranges: Record<string, [number, number]>, t: VitalT = english): VitalStatus | null {
  if (f == null) return null;
  const r = ranges.temperatureF;
  const c = ((f - 32) * 5) / 9;
  const both = `${fmt(f)}°F (${c.toFixed(1)}°C)`;
  const range = rangeText(r, "°F");
  if (f < 95) return { tone: "urgent", label: t("very_low"), detail: t("temp_very_low", { v: both, range }) };
  if (f >= 104) return { tone: "urgent", label: t("very_high_fever"), detail: t("temp_very_high", { v: both }) };
  if (f >= 103) return { tone: "alert", label: t("high_fever"), detail: t("temp_high", { v: both, range }) };
  if (f >= 100.4) return { tone: "alert", label: t("fever"), detail: t("temp_fever", { v: both, range }) };
  if (f > r[1]) return { tone: "watch", label: t("slightly_raised"), detail: t("temp_slight", { v: both, range }) };
  if (f < r[0]) return { tone: "watch", label: t("low"), detail: t("temp_low", { v: both, range }) };
  return { tone: "ok", label: t("normal"), detail: t("temp_normal", { v: both, range }) };
}

export function bmiStatus(bmi: number | null, t: VitalT = english): VitalStatus | null {
  if (bmi == null) return null;
  const v = bmi.toFixed(1);
  if (bmi < 18.5) return { tone: "watch", label: t("underweight"), detail: t("bmi_under", { v }) };
  if (bmi < 25) return { tone: "ok", label: t("healthy"), detail: t("bmi_healthy", { v }) };
  if (bmi < 30) return { tone: "watch", label: t("overweight"), detail: t("bmi_over", { v }) };
  return { tone: "alert", label: t("obese"), detail: t("bmi_obese", { v }) };
}

/** Reference bands for the pop-up's "What's normal?" section. */
export function referenceBands(key: string, ranges: Record<string, [number, number]>, t: VitalT = english): { label: string; range: string; tone: VitalTone }[] {
  switch (key) {
    case "bpSystolic": return [
      { label: t("low"), range: t("below", { v: `${fmt(ranges.bpSystolic[0])} / ${fmt(ranges.bpDiastolic[0])}` }), tone: "watch" },
      { label: t("normal"), range: `${fmt(ranges.bpSystolic[0])}–${fmt(ranges.bpSystolic[1])} / ${fmt(ranges.bpDiastolic[0])}–${fmt(ranges.bpDiastolic[1])}`, tone: "ok" },
      { label: t("raised"), range: t("above", { v: `${fmt(ranges.bpSystolic[1])} / ${fmt(ranges.bpDiastolic[1])}` }), tone: "watch" },
      { label: t("high"), range: t("or_more", { v: "140 / 90" }), tone: "alert" },
      { label: t("very_high_urgent"), range: t("or_more", { v: "180 / 120" }), tone: "urgent" },
    ];
    case "pulse": return [
      { label: t("very_slow_urgent"), range: t("below", { v: 40 }), tone: "urgent" },
      { label: t("slow"), range: `40–${fmt(ranges.pulse[0] - 1)}`, tone: "watch" },
      { label: t("normal"), range: `${fmt(ranges.pulse[0])}–${fmt(ranges.pulse[1])}`, tone: "ok" },
      { label: t("fast"), range: `${fmt(ranges.pulse[1] + 1)}–130`, tone: "alert" },
      { label: t("very_fast_urgent"), range: t("above", { v: 130 }), tone: "urgent" },
    ];
    case "spo2": return [
      { label: t("normal"), range: `${fmt(ranges.spo2[0])}–${fmt(ranges.spo2[1])}%`, tone: "ok" },
      { label: t("low_oxygen"), range: `91–${fmt(ranges.spo2[0] - 1)}%`, tone: "alert" },
      { label: t("very_low_urgent"), range: t("or_less", { v: "90%" }), tone: "urgent" },
    ];
    case "temperatureF": return [
      { label: t("low"), range: t("below", { v: `${fmt(ranges.temperatureF[0])}°F` }), tone: "watch" },
      { label: t("normal"), range: `${fmt(ranges.temperatureF[0])}–${fmt(ranges.temperatureF[1])}°F`, tone: "ok" },
      { label: t("slightly_raised"), range: t("up_to", { v: "100.3°F" }), tone: "watch" },
      { label: t("fever"), range: "100.4–102.9°F", tone: "alert" },
      { label: t("high_fever"), range: t("or_more", { v: "103°F" }), tone: "urgent" },
    ];
    case "bmi": case "heightCm": return [
      { label: t("underweight"), range: t("below", { v: 18.5 }), tone: "watch" },
      { label: t("healthy"), range: "18.5–24.9", tone: "ok" },
      { label: t("overweight"), range: "25–29.9", tone: "watch" },
      { label: t("obese"), range: t("or_more", { v: 30 }), tone: "alert" },
    ];
    default: return [];
  }
}
