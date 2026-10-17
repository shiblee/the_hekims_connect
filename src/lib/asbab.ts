import { Wind, UtensilsCrossed, Footprints, Brain, Moon, Droplets, type LucideIcon } from "lucide-react";

// Shared Asbab-e-Sittah (six essential factors) definitions and the humoral
// drift calculation — used by the Stage 4 page (live) and the server (saved).

export const PILLAR_ICONS: Record<string, LucideIcon> = {
  hawa: Wind,
  makool: UtensilsCrossed,
  harkat_badani: Footprints,
  harkat_nafsani: Brain,
  naum: Moon,
  ihtibas: Droplets,
};
export const pillarIcon = (key: string): LucideIcon => PILLAR_ICONS[key] ?? Wind;

export const QUESTION_TYPES = [
  { value: "single_select", label: "Single choice" },
  { value: "multi_select", label: "Multiple choice" },
  { value: "numeric", label: "Number" },
  { value: "text", label: "Free text" },
] as const;

export const AKHLAT = [
  { key: "safra", label: "Safra", english: "Yellow bile", quality: "Hot & Dry", bar: "bg-amber-400", text: "text-amber-600 dark:text-amber-400" },
  { key: "dam", label: "Dam", english: "Blood", quality: "Hot & Moist", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  { key: "balgham", label: "Balgham", english: "Phlegm", quality: "Cold & Moist", bar: "bg-sky-400", text: "text-sky-600 dark:text-sky-400" },
  { key: "sauda", label: "Sauda", english: "Black bile", quality: "Cold & Dry", bar: "bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
] as const;
export type Humour = (typeof AKHLAT)[number]["key"];
export type HumourPoints = Record<Humour, number>;

export interface AsbabOptionCfg { id: string; label: string; description: string | null; safra: number; dam: number; balgham: number; sauda: number }
export interface AsbabQuestionCfg {
  id: string; label: string; labelLocal: string | null; helpText: string | null; type: string; required: boolean;
  weight: number; showIfQuestionId: string | null; showIfOption: string | null; version: number; options: AsbabOptionCfg[];
}
export interface AsbabPillarCfg { id: string; key: string; label: string; english: string; description: string | null; questions: AsbabQuestionCfg[] }

/** Answer value as held in the form: option labels for choice questions, a string otherwise. */
export type AsbabAnswer = string[] | string;

export const zeroPoints = (): HumourPoints => ({ safra: 0, dam: 0, balgham: 0, sauda: 0 });

/** Is a question currently shown — i.e. its "show only if" parent answer is selected? */
export function questionVisible(q: AsbabQuestionCfg, answers: Record<string, AsbabAnswer>): boolean {
  if (!q.showIfQuestionId || !q.showIfOption) return true;
  const parent = answers[q.showIfQuestionId];
  return Array.isArray(parent) ? parent.includes(q.showIfOption) : parent === q.showIfOption;
}

export const isAnswered = (a: AsbabAnswer | undefined) => (Array.isArray(a) ? a.length > 0 : !!a && String(a).trim() !== "");

/**
 * Weighted humoral drift: each selected option's Safra/Dam/Balgham/Sauda
 * points × its question's constitutional weight, summed overall and per
 * pillar, then expressed as percentages of the total.
 */
export function computeDrift(pillars: AsbabPillarCfg[], answers: Record<string, AsbabAnswer>) {
  const total = zeroPoints();
  const perPillar: Record<string, HumourPoints> = {};
  for (const p of pillars) {
    const pts = zeroPoints();
    for (const q of p.questions) {
      const a = answers[q.id];
      if (!Array.isArray(a) || !questionVisible(q, answers)) continue;
      for (const o of q.options) {
        if (!a.includes(o.label)) continue;
        for (const h of AKHLAT) pts[h.key] += (o[h.key] || 0) * (q.weight || 1);
      }
    }
    perPillar[p.key] = pts;
    for (const h of AKHLAT) total[h.key] += pts[h.key];
  }
  return { total, perPillar, percent: toPercent(total), dominant: dominantOf(total) };
}

export function toPercent(p: HumourPoints): HumourPoints {
  const sum = AKHLAT.reduce((n, h) => n + p[h.key], 0);
  const out = zeroPoints();
  if (sum > 0) for (const h of AKHLAT) out[h.key] = Math.round((p[h.key] / sum) * 100);
  return out;
}

export function dominantOf(p: HumourPoints): Humour | null {
  let best: Humour | null = null;
  for (const h of AKHLAT) if (p[h.key] > 0 && (best === null || p[h.key] > p[best])) best = h.key;
  return best;
}
