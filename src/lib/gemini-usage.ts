import { db } from "@/lib/db";
import { DEFAULT_PRICING, costUsd, tokensFromUsage, type GeminiPricing, type UsageTokens } from "@/lib/gemini-pricing";

// Records every Gemini request (see gemini.ts → geminiRequest) and keeps the
// admin-editable prices. Stored as one PortalSetting row (gemini_usage/pricing)
// shown on its own Settings tab, not as plain setting fields.

const PRICING_CATEGORY = "gemini_usage";
const PRICING_KEY = "pricing";

let cached: { at: number; pricing: GeminiPricing } | null = null;

export async function loadPricing(): Promise<GeminiPricing> {
  if (cached && Date.now() - cached.at < 60_000) return cached.pricing;
  const row = await db.portalSetting.findUnique({ where: { category_key: { category: PRICING_CATEGORY, key: PRICING_KEY } } });
  let pricing = DEFAULT_PRICING;
  if (row?.value) {
    try { pricing = { ...DEFAULT_PRICING, ...JSON.parse(row.value) }; } catch { /* keep defaults */ }
  }
  cached = { at: Date.now(), pricing };
  return pricing;
}

export async function savePricing(pricing: GeminiPricing) {
  const value = JSON.stringify(pricing);
  await db.portalSetting.upsert({
    where: { category_key: { category: PRICING_CATEGORY, key: PRICING_KEY } },
    update: { value },
    create: { category: PRICING_CATEGORY, key: PRICING_KEY, value },
  });
  cached = null;
}

function monthStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export interface UsageRecord {
  feature: string;
  model: string;
  status: "ok" | "error" | "quota" | "timeout";
  httpStatus?: number | null;
  usageMetadata?: unknown;
  searchRequests?: number;
  durationMs: number;
  errorMessage?: string | null;
}

/** Saves one request. Never throws — usage logging must not break the feature that called Gemini. */
export async function recordGeminiUsage(r: UsageRecord) {
  try {
    const now = new Date();
    const pricing = await loadPricing();
    const tokens: UsageTokens = r.usageMetadata ? tokensFromUsage(r.usageMetadata) : { inputTokens: 0, cachedTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0 };
    const searches = r.searchRequests ?? 0;
    let billedSearches = 0;
    if (searches > 0) {
      const used = await db.geminiUsageLog.aggregate({ where: { createdAt: { gte: monthStart(now) } }, _sum: { searchRequests: true } });
      const before = used._sum.searchRequests ?? 0;
      billedSearches = Math.max(0, before + searches - Math.max(before, pricing.searchFreePerMonth));
    }
    await db.geminiUsageLog.create({
      data: {
        createdAt: now, feature: r.feature, model: r.model, status: r.status, httpStatus: r.httpStatus ?? null,
        ...tokens, searchRequests: searches, billedSearches,
        costUsd: costUsd(pricing, now, tokens, billedSearches),
        durationMs: Math.round(r.durationMs), errorMessage: r.errorMessage?.slice(0, 500) ?? null,
      },
    });
  } catch (err) {
    console.error("[gemini-usage] could not record:", err);
  }
}

/** Re-prices every logged request with the current price list (after prices were corrected). */
export async function recalculateCosts() {
  const pricing = await loadPricing();
  const rows = await db.geminiUsageLog.findMany({
    select: { id: true, createdAt: true, inputTokens: true, cachedTokens: true, outputTokens: true, thinkingTokens: true, totalTokens: true, searchRequests: true },
    orderBy: { createdAt: "asc" },
  });
  // Free search allowance is per calendar month — replay it in order.
  const searchesByMonth = new Map<string, number>();
  const updates = rows.map((r) => {
    const month = r.createdAt.toISOString().slice(0, 7);
    const before = searchesByMonth.get(month) ?? 0;
    searchesByMonth.set(month, before + r.searchRequests);
    const billed = Math.max(0, before + r.searchRequests - Math.max(before, pricing.searchFreePerMonth));
    return db.geminiUsageLog.update({ where: { id: r.id }, data: { billedSearches: billed, costUsd: costUsd(pricing, r.createdAt, r, billed) } });
  });
  for (let i = 0; i < updates.length; i += 500) await db.$transaction(updates.slice(i, i + 500));
  return rows.length;
}
