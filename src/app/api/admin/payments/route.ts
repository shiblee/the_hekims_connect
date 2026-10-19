import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { netAmount, paymentState } from "@/lib/payments";

/**
 * Super Admin — payments across all clinics, for reconciliation. Dates are the admin's local
 * days (`tz` minutes east of UTC; the server runs in UTC). Totals are net: cancelled payments
 * count for nothing and refunds are subtracted. Filters: from, to (YYYY-MM-DD), facilityId, staffId, mode, status.
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const tz = Math.max(-840, Math.min(840, Number(sp.get("tz")) || 0));
  const todayYmd = new Date(Date.now() + tz * 60_000).toISOString().slice(0, 10);
  const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayYmd);
  const from = ymd(sp.get("from")), to = ymd(sp.get("to"));
  const startOf = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - tz * 60_000);

  const where: Record<string, unknown> = { createdAt: { gte: startOf(from), lt: new Date(startOf(to).getTime() + 86400_000) } };
  if (sp.get("mode")) where.mode = sp.get("mode");
  if (sp.get("facilityId")) where.visit = { facilityId: sp.get("facilityId") };
  if (sp.get("staffId")) where.recordedById = sp.get("staffId");
  const status = sp.get("status");
  if (status === "paid") where.status = { in: ["paid", "Paid"] };
  else if (status) where.status = status;

  const rows = await db.payment.findMany({
    where, orderBy: { createdAt: "desc" },
    select: {
      id: true, paymentCode: true, amount: true, mode: true, status: true, createdAt: true, feeName: true, overrideReason: true,
      refundAmount: true, refundReason: true, cancelReason: true, referenceNumber: true,
      visit: { select: { id: true, visitCode: true, facility: { select: { id: true, facilityName: true } }, patient: { select: { id: true, name: true, patientCode: true } } } },
      recordedBy: { select: { id: true, name: true, staffCode: true } },
    },
  });

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const live = rows.filter((p) => paymentState(p.status) !== "cancelled");
  const bucket = <K extends string>(key: (p: (typeof rows)[number]) => K, label: (p: (typeof rows)[number]) => string) => {
    const m = new Map<K, { key: K; name: string; net: number; received: number; refunded: number; count: number; cancelled: number }>();
    for (const p of rows) {
      const k = key(p);
      const e = m.get(k) ?? { key: k, name: label(p), net: 0, received: 0, refunded: 0, count: 0, cancelled: 0 };
      if (paymentState(p.status) === "cancelled") e.cancelled++;
      else { e.count++; e.received = r2(e.received + p.amount); e.refunded = r2(e.refunded + (p.refundAmount ?? 0)); e.net = r2(e.net + netAmount(p)); }
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.net - a.net);
  };
  const received = r2(live.reduce((a, p) => a + p.amount, 0));
  const refunded = r2(live.reduce((a, p) => a + (p.refundAmount ?? 0), 0));

  return NextResponse.json({
    from, to,
    payments: rows.map((p) => ({ ...p, state: paymentState(p.status), net: netAmount(p) })),
    summary: {
      net: r2(received - refunded), received, refunded, count: live.length, cancelled: rows.length - live.length,
      byMode: bucket((p) => p.mode, (p) => p.mode),
      byFacility: bucket((p) => p.visit.facility.id, (p) => p.visit.facility.facilityName),
      // A payment with no staff member was taken by that clinic's owner account.
      byStaff: bucket((p) => p.recordedBy?.id ?? `owner:${p.visit.facility.id}`, (p) => (p.recordedBy ? `${p.recordedBy.name} (${p.recordedBy.staffCode})` : `Owner — ${p.visit.facility.facilityName}`)),
    },
  });
}
