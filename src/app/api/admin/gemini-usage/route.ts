import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { geminiStatus, GEMINI_MODEL } from "@/lib/gemini";
import { loadPricing } from "@/lib/gemini-usage";
import { GEMINI_FEATURES } from "@/lib/gemini-pricing";

const DAY = 86_400_000;

/**
 * Gemini usage dashboard data. ?days=7|30|90|all (default 30), ?tz=<minutes
 * east of UTC> so "today" and the daily bars follow the admin's own clock.
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const tz = Math.max(-840, Math.min(840, parseInt(sp.get("tz") || "0", 10) || 0)) * 60_000;
  const daysParam = sp.get("days") || "30";
  const now = Date.now();
  // Midnight today on the admin's clock, as a UTC instant.
  const todayStart = Math.floor((now + tz) / DAY) * DAY - tz;
  const local = new Date(now + tz);
  const monthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - tz;

  const first = await db.geminiUsageLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const days = daysParam === "all"
    ? Math.max(1, Math.ceil((todayStart + DAY - (first?.createdAt.getTime() ?? todayStart)) / DAY))
    : Math.min(366, Math.max(1, parseInt(daysParam, 10) || 30));
  const from = todayStart - (days - 1) * DAY;

  const agg = (gte: number) => db.geminiUsageLog.aggregate({
    where: { createdAt: { gte: new Date(gte) } },
    _count: { _all: true },
    _sum: { costUsd: true, totalTokens: true },
  });
  const utcMonth = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);
  const [status, pricing, allTime, today, month, searchMonth, rows] = await Promise.all([
    geminiStatus(),
    loadPricing(),
    agg(0),
    agg(todayStart),
    agg(monthStart),
    db.geminiUsageLog.aggregate({ where: { createdAt: { gte: new Date(utcMonth) } }, _sum: { searchRequests: true, billedSearches: true } }),
    db.geminiUsageLog.findMany({
      where: { createdAt: { gte: new Date(from) } },
      select: { createdAt: true, feature: true, status: true, inputTokens: true, cachedTokens: true, outputTokens: true, thinkingTokens: true, totalTokens: true, costUsd: true, durationMs: true, searchRequests: true },
    }),
  ]);

  const daily = Array.from({ length: days }, (_, i) => ({ date: new Date(from + i * DAY + tz).toISOString().slice(0, 10), calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }));
  const range = { calls: 0, ok: 0, failed: 0, quota: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0, searchRequests: 0, costUsd: 0, durationMs: 0 };
  const features = new Map<string, { feature: string; calls: number; failed: number; inputTokens: number; outputTokens: number; costUsd: number; durationMs: number; last: number }>();

  for (const r of rows) {
    const t = r.createdAt.getTime();
    const failed = r.status !== "ok";
    range.calls++;
    if (failed) range.failed++; else range.ok++;
    if (r.status === "quota") range.quota++;
    range.inputTokens += r.inputTokens + r.cachedTokens;
    range.cachedTokens += r.cachedTokens;
    range.outputTokens += r.outputTokens;
    range.thinkingTokens += r.thinkingTokens;
    range.totalTokens += r.totalTokens;
    range.searchRequests += r.searchRequests;
    range.costUsd += r.costUsd;
    range.durationMs += r.durationMs;

    const d = daily[Math.floor((t - from) / DAY)];
    if (d) {
      d.calls++; if (failed) d.failed++;
      d.inputTokens += r.inputTokens + r.cachedTokens;
      d.outputTokens += r.outputTokens + r.thinkingTokens;
      d.costUsd += r.costUsd;
    }

    const f = features.get(r.feature) ?? { feature: r.feature, calls: 0, failed: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0, last: 0 };
    f.calls++; if (failed) f.failed++;
    f.inputTokens += r.inputTokens + r.cachedTokens;
    f.outputTokens += r.outputTokens + r.thinkingTokens;
    f.costUsd += r.costUsd;
    f.durationMs += r.durationMs;
    f.last = Math.max(f.last, t);
    features.set(r.feature, f);
  }

  const tot = (a: Awaited<ReturnType<typeof agg>>) => ({ calls: a._count._all, costUsd: a._sum.costUsd ?? 0, totalTokens: a._sum.totalTokens ?? 0 });
  return NextResponse.json({
    status, model: GEMINI_MODEL, pricing,
    trackingSince: first?.createdAt ?? null,
    allTime: tot(allTime), today: tot(today), month: tot(month),
    searchMonth: { used: searchMonth._sum.searchRequests ?? 0, billed: searchMonth._sum.billedSearches ?? 0, free: pricing.searchFreePerMonth },
    range: { days, from: new Date(from), ...range, avgMs: range.calls ? Math.round(range.durationMs / range.calls) : 0 },
    daily,
    features: [...features.values()]
      .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls)
      .map((f) => ({ ...f, label: GEMINI_FEATURES[f.feature]?.label ?? f.feature, area: GEMINI_FEATURES[f.feature]?.area ?? "Other", avgMs: Math.round(f.durationMs / f.calls), last: new Date(f.last) })),
  });
}
