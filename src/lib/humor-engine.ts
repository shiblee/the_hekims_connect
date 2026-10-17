// Deterministic Humoral Matrix engine — Junior Hakeem Intake Protocol Phase 1.
// Every finding (a selected manifestation, an aggravating/relieving factor, a
// severity band, an onset pattern) carries an admin-configured point weight
// toward each of the four humors (HumorWeightRule). This sums those weights
// and normalizes to percentages, so a doctor can always see exactly why a
// percentage is what it is via the returned `breakdown`. Deliberately not an
// AI estimate — pure and deterministic so it runs identically for the live
// client-side preview and the server-side save-time authority, the same
// reason flagForAnswer/computeOverallFlag in screening-flags.ts are pure.

export type HumorKey = "safra" | "dam" | "sauda" | "balgham";

export interface HumorWeightRuleInput {
  sourceType: string;
  sourceValue: string;
  safraPoints: number;
  damPoints: number;
  saudaPoints: number;
  balghamPoints: number;
  active: boolean;
}

export interface ComplaintHumorInput {
  manifestations: string[];
  factors: string[];
  severityScore: number | null; // 0-10, converted to a band internally
  onsetPattern: string | null;
}

export interface HumorBreakdownEntry {
  source: string;
  safra: number;
  dam: number;
  sauda: number;
  balgham: number;
}

export interface HumorResult {
  safraPercent: number;
  damPercent: number;
  saudaPercent: number;
  balghamPercent: number;
  dominant: "Safra" | "Dam" | "Sauda" | "Balgham";
  breakdown: HumorBreakdownEntry[];
}

export function severityBandFor(score: number | null): "mild" | "moderate" | "severe" | null {
  if (score == null) return null;
  if (score <= 3) return "mild";
  if (score <= 6) return "moderate";
  return "severe";
}

const DOMINANT_LABEL: Record<HumorKey, HumorResult["dominant"]> = {
  safra: "Safra", dam: "Dam", sauda: "Sauda", balgham: "Balgham",
};

/**
 * Sums every matched HumorWeightRule across the given complaints' findings
 * and normalizes to percentages. Returns null (not a fake 25/25/25/25 split)
 * when nothing has scored yet, so the UI can show "not enough data" honestly.
 */
export function computeHumorBreakdown(rules: HumorWeightRuleInput[], inputs: ComplaintHumorInput[]): HumorResult | null {
  const totals = { safra: 0, dam: 0, sauda: 0, balgham: 0 };
  const breakdown: HumorBreakdownEntry[] = [];

  const ruleFor = (sourceType: string, sourceValue: string) =>
    rules.find((r) => r.active && r.sourceType === sourceType && r.sourceValue === sourceValue);

  const apply = (source: string, rule: HumorWeightRuleInput | undefined) => {
    if (!rule) return;
    if (!rule.safraPoints && !rule.damPoints && !rule.saudaPoints && !rule.balghamPoints) return;
    totals.safra += rule.safraPoints;
    totals.dam += rule.damPoints;
    totals.sauda += rule.saudaPoints;
    totals.balgham += rule.balghamPoints;
    breakdown.push({ source, safra: rule.safraPoints, dam: rule.damPoints, sauda: rule.saudaPoints, balgham: rule.balghamPoints });
  };

  for (const input of inputs) {
    for (const m of input.manifestations) apply(`Manifestation: ${m}`, ruleFor("manifestation", m));
    for (const f of input.factors) apply(`Factor: ${f}`, ruleFor("factor", f));
    const band = severityBandFor(input.severityScore);
    if (band) apply(`Severity: ${band}`, ruleFor("severity_band", band));
    if (input.onsetPattern) apply(`Onset: ${input.onsetPattern}`, ruleFor("onset_pattern", input.onsetPattern));
  }

  const sum = totals.safra + totals.dam + totals.sauda + totals.balgham;
  if (sum <= 0) return null;

  const pct = (n: number) => Math.round((n / sum) * 1000) / 10;
  const percents: Record<HumorKey, number> = { safra: pct(totals.safra), dam: pct(totals.dam), sauda: pct(totals.sauda), balgham: pct(totals.balgham) };
  const dominantKey = (Object.keys(percents) as HumorKey[]).reduce((a, b) => (percents[b] > percents[a] ? b : a));

  return {
    safraPercent: percents.safra,
    damPercent: percents.dam,
    saudaPercent: percents.sauda,
    balghamPercent: percents.balgham,
    dominant: DOMINANT_LABEL[dominantKey],
    breakdown,
  };
}
