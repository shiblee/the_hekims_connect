import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { loadPricing, savePricing, recalculateCosts } from "@/lib/gemini-usage";
import { DEFAULT_PRICING, pricingError, type GeminiPricing } from "@/lib/gemini-pricing";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ pricing: await loadPricing(), defaults: DEFAULT_PRICING });
}

/** Save prices: { pricing, recalculate?: boolean } — recalculate re-prices every logged call. */
export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const p = body.pricing as GeminiPricing | undefined;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
  const pricing: GeminiPricing = {
    periods: Array.isArray(p?.periods)
      ? p!.periods.map((x) => ({ from: x?.from ? String(x.from) : null, input: num(x?.input), cachedInput: num(x?.cachedInput), output: num(x?.output) }))
      : [],
    searchFreePerMonth: num(p?.searchFreePerMonth),
    searchPer1000: num(p?.searchPer1000),
    usdToInr: num(p?.usdToInr),
    freeTier: p?.freeTier === true,
  };
  const error = pricingError(pricing);
  if (error) return NextResponse.json({ error }, { status: 400 });
  await savePricing(pricing);
  const recalculated = body.recalculate === true ? await recalculateCosts() : null;
  await logAdminActivity(session.admin.id, "gemini_pricing_updated", `Updated Gemini prices${recalculated !== null ? ` and re-priced ${recalculated} logged calls` : ""}`, getClientIp(req));
  return NextResponse.json({ pricing, recalculated });
}
