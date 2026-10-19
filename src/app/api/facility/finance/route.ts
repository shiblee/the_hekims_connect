import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { netAmount, paymentState } from "@/lib/payments";

/**
 * Clinic finances ("Clinic finances" permission, checked in src/proxy.ts). Clinic-local days (`tz`).
 * Collected = amounts received (excluding cancelled); Refunded = money returned; Net = collected − refunded.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tz = Math.max(-840, Math.min(840, Number(req.nextUrl.searchParams.get("tz")) || 0));
  const DAY = 86400_000;
  const today = Math.floor((Date.now() + tz * 60_000) / DAY) * DAY - tz * 60_000;
  const since12m = (() => { const d = new Date(today + tz * 60_000); d.setUTCMonth(d.getUTCMonth() - 11, 1); return d.getTime() - tz * 60_000; })();

  const rows = await db.payment.findMany({
    where: { visit: { facilityId: auth.id }, createdAt: { gte: new Date(since12m) } },
    select: { amount: true, status: true, refundAmount: true, mode: true, createdAt: true, recordedById: true, recordedBy: { select: { name: true } } },
  });
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const period = (from: number) => {
    const ps = rows.filter((p) => p.createdAt.getTime() >= from);
    const live = ps.filter((p) => paymentState(p.status) !== "cancelled");
    const collected = r2(live.reduce((a, p) => a + p.amount, 0));
    const refunded = r2(live.reduce((a, p) => a + (p.refundAmount ?? 0), 0));
    return { collected, refunded, net: r2(collected - refunded), count: live.length, cancelled: ps.length - live.length };
  };
  const last30 = rows.filter((p) => p.createdAt.getTime() >= today - 29 * DAY);
  const group = (key: (p: (typeof rows)[number]) => string) => {
    const m = new Map<string, { net: number; count: number }>();
    for (const p of last30) { if (paymentState(p.status) === "cancelled") continue; const k = key(p); const v = m.get(k) ?? { net: 0, count: 0 }; v.net = r2(v.net + netAmount(p)); v.count++; m.set(k, v); }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.net - a.net);
  };
  const daily = Array.from({ length: 30 }, (_, i) => {
    const from = today - (29 - i) * DAY, to = from + DAY;
    return { key: new Date(from + tz * 60_000).toISOString().slice(0, 10), net: r2(rows.filter((p) => p.createdAt.getTime() >= from && p.createdAt.getTime() < to).reduce((a, p) => a + netAmount(p), 0)) };
  });
  return NextResponse.json({
    today: period(today), last7: period(today - 6 * DAY), last30: period(today - 29 * DAY), last12m: period(since12m),
    byMode: group((p) => p.mode || "Other"), byCollector: group((p) => p.recordedBy?.name ?? "Clinic owner"), daily,
  });
}
