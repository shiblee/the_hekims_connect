// Gemini usage → money. Pure rules (no database) shared by the usage logger,
// the Settings → Gemini Usage dashboard and the tests.
//
// Prices are admin-editable (Settings → Gemini Usage → Prices) because Google
// changes them; the defaults below are Google's published paid-tier prices for
// Gemini 3.8 Flash (ai.google.dev/gemini-api/docs/pricing, updated 2026-10-22),
// including the increase already announced for 1 January 2027.

export interface PricePeriod {
  /** First day (YYYY-MM-DD, UTC) these prices apply; null = from the start. */
  from: string | null;
  /** USD per 1 million tokens. */
  input: number;
  cachedInput: number;
  /** Output price also covers the model's "thinking" tokens. */
  output: number;
}

export interface GeminiPricing {
  periods: PricePeriod[];
  /** Google Search grounding: free requests per calendar month, then USD per 1,000 requests. */
  searchFreePerMonth: number;
  searchPer1000: number;
  /** For showing costs in rupees as well. */
  usdToInr: number;
  /** A free-tier key is never billed — every cost shows as 0. */
  freeTier: boolean;
}

export const DEFAULT_PRICING: GeminiPricing = {
  periods: [
    { from: null, input: 0.75, cachedInput: 0.075, output: 3.75 },
    { from: "2027-01-01", input: 1.5, cachedInput: 0.15, output: 7.5 },
  ],
  searchFreePerMonth: 5000,
  searchPer1000: 14,
  usdToInr: 88,
  freeTier: false,
};

/** The price period in force on a date (latest `from` not after it). */
export function priceAt(pricing: GeminiPricing, at: Date): PricePeriod {
  const day = at.toISOString().slice(0, 10);
  const sorted = [...pricing.periods].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
  let current = sorted[0] ?? DEFAULT_PRICING.periods[0];
  for (const p of sorted) if (!p.from || p.from <= day) current = p;
  return current;
}

export interface UsageTokens {
  /** Billed input tokens excluding the cached part (prompt + search results fed back in). */
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
}

/** Reads Gemini's `usageMetadata` (missing fields count as 0). */
export function tokensFromUsage(meta: any): UsageTokens {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const prompt = n(meta?.promptTokenCount) + n(meta?.toolUsePromptTokenCount);
  const cached = n(meta?.cachedContentTokenCount);
  const output = n(meta?.candidatesTokenCount);
  const thinking = n(meta?.thoughtsTokenCount);
  return {
    inputTokens: Math.max(0, prompt - cached),
    cachedTokens: cached,
    outputTokens: output,
    thinkingTokens: thinking,
    totalTokens: n(meta?.totalTokenCount) || prompt + output + thinking,
  };
}

/**
 * USD cost of one request. `billedSearches` = Google Search requests in this
 * call that fall beyond the month's free allowance.
 */
export function costUsd(pricing: GeminiPricing, at: Date, t: UsageTokens, billedSearches = 0): number {
  if (pricing.freeTier) return 0;
  const p = priceAt(pricing, at);
  const tokens = (t.inputTokens * p.input + t.cachedTokens * p.cachedInput + (t.outputTokens + t.thinkingTokens) * p.output) / 1_000_000;
  return tokens + (billedSearches * pricing.searchPer1000) / 1000;
}

/** Validates an edited price list; returns an error sentence or null. */
export function pricingError(p: GeminiPricing): string | null {
  if (!p.periods.length) return "Add at least one price period.";
  const froms = new Set<string>();
  for (const x of p.periods) {
    if (x.from !== null && !/^\d{4}-\d{2}-\d{2}$/.test(x.from)) return "Each 'from' date must be a date (YYYY-MM-DD) or empty.";
    if (froms.has(x.from ?? "")) return "Two price periods start on the same date.";
    froms.add(x.from ?? "");
    for (const v of [x.input, x.cachedInput, x.output]) if (!(typeof v === "number" && v >= 0 && v < 1000)) return "Prices must be numbers between 0 and 1000 (USD per 1 million tokens).";
  }
  if (!p.periods.some((x) => x.from === null)) return "One price period must have no start date (it covers everything before the others).";
  if (!(p.searchFreePerMonth >= 0) || !(p.searchPer1000 >= 0)) return "Search grounding values must be 0 or more.";
  if (!(p.usdToInr > 0)) return "The USD → INR rate must be more than 0.";
  return null;
}

/** What each feature's usage is called on the dashboard. */
export const GEMINI_FEATURES: Record<string, { label: string; area: string }> = {
  book_translation: { label: "Book translation (Urdu → English)", area: "Books" },
  report_reading: { label: "Reading uploaded reports", area: "Clinic" },
  vitals_insight: { label: "Vitals insight", area: "Clinic" },
  screening_summary: { label: "Screening summary", area: "Clinic" },
  clinical_routing: { label: "Clinical routing", area: "Clinic" },
  humoral_clues: { label: "Humoral clues", area: "Clinic" },
  dalail_ranking: { label: "Dala'il question ordering", area: "Clinic" },
  tashkhees_ranking: { label: "Tashkhees organ ordering", area: "Clinic" },
  usool_ranking: { label: "Usool-e-Ilaj ordering", area: "Clinic" },
  ghiza_ranking: { label: "Diet (Ghiza) ordering", area: "Clinic" },
  cds_ranking: { label: "Medicines decision support", area: "Clinic" },
  complaint_assistant: { label: "Unani Complaint Assistant", area: "Catalog" },
  allergy_assistant: { label: "Unani Allergy Assistant", area: "Catalog" },
  supplement_assistant: { label: "Unani Medicine Assistant", area: "Catalog" },
  medication_assistant: { label: "Allopathic Medicine Assistant", area: "Catalog" },
  supplement_research: { label: "Supplement research (Google Search)", area: "Catalog" },
  medication_research: { label: "Medication research (Google Search)", area: "Catalog" },
  ui_translation: { label: "App text translation", area: "Languages" },
  key_test: { label: "Key test (Settings)", area: "Settings" },
};

export type GeminiFeature = keyof typeof GEMINI_FEATURES;
