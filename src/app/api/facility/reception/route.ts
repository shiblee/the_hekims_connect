import { NextRequest, NextResponse } from "next/server";
import { netAmount } from "@/lib/payments";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/api-auth";
import { loadStaffAccess } from "@/lib/staff-permissions-server";

/**
 * Reception dashboard numbers, in the clinic's local days (`tz` = minutes east of UTC, from the browser).
 * Definitions — kept separate on purpose:
 *  - Visit: one row per visit at this clinic (a person can have several).
 *  - New patient: a person whose FIRST visit at this clinic falls in the period (counted once, ever).
 *  - Returning patient: a person visiting on a day after their first visit here.
 * Money is only included for people allowed to see payments; "mine" is the signed-in staff member's own.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth || auth.type !== "facility") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fid = auth.id;
  const tz = Math.max(-840, Math.min(840, Number(req.nextUrl.searchParams.get("tz")) || 0));
  const access = auth.staffId ? await loadStaffAccess(auth.staffId) : null;
  const can = (k: string) => !auth.staffId || !!access?.permissions.includes(k as never);

  // Local-day helpers: shift instants by the offset, cut at UTC midnight, shift back.
  const DAY = 86400_000;
  const dayStart = (t: number) => Math.floor((t + tz * 60_000) / DAY) * DAY - tz * 60_000;
  const now = Date.now();
  const today = dayStart(now);
  const dayKey = (t: number) => new Date(dayStart(t) + tz * 60_000).toISOString().slice(0, 10);
  const monthKey = (t: number) => new Date(t + tz * 60_000).toISOString().slice(0, 7);
  const since12m = (() => { const d = new Date(today + tz * 60_000); d.setUTCMonth(d.getUTCMonth() - 11, 1); return d.getTime() - tz * 60_000; })();

  const [firstVisits, visits, payments] = await Promise.all([
    db.visit.groupBy({ by: ["patientId"], where: { facilityId: fid }, _min: { visitDate: true } }),
    db.visit.findMany({
      where: { facilityId: fid, visitDate: { gte: new Date(Math.min(since12m, today - 29 * DAY)) } },
      select: { id: true, patientId: true, visitDate: true, status: true, registeredById: true, vitalSigns: { select: { id: true } }, referral: { select: { id: true } }, tashkheesDossier: { select: { status: true } } },
    }),
    db.payment.findMany({
      where: { visit: { facilityId: fid }, createdAt: { gte: new Date(today - 29 * DAY) }, status: { not: "cancelled" } },
      select: { amount: true, status: true, refundAmount: true, createdAt: true, recordedById: true, mode: true },
    }),
  ]);
  const first = new Map(firstVisits.map((f) => [f.patientId, f._min.visitDate!.getTime()]));
  const newIn = (from: number, to = now + DAY) => firstVisits.filter((f) => { const t = f._min.visitDate!.getTime(); return t >= from && t < to; }).length;
  const visitsIn = (from: number, to = now + DAY) => visits.filter((v) => v.visitDate.getTime() >= from && v.visitDate.getTime() < to);
  const todays = visitsIn(today);
  const returningToday = new Set(todays.filter((v) => dayStart(first.get(v.patientId) ?? 0) < today).map((v) => v.patientId)).size;
  const referred = (v: (typeof visits)[number]) => !!v.referral || v.status === "referred";

  // Net of refunds; cancelled payments are excluded above.
  const sum = (rows: typeof payments) => ({ amount: Math.round(rows.reduce((a, p) => a + netAmount(p), 0) * 100) / 100, count: rows.length });
  const payIn = (from: number) => payments.filter((p) => p.createdAt.getTime() >= from);

  // Trend: daily for 7 / 30 days, monthly for 12 months.
  const daily = (n: number) => Array.from({ length: n }, (_, i) => {
    const from = today - (n - 1 - i) * DAY, to = from + DAY;
    return { key: dayKey(from), newPatients: newIn(from, to), visits: visitsIn(from, to).length };
  });
  const months: { key: string; newPatients: number; visits: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today + tz * 60_000); d.setUTCMonth(d.getUTCMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    months.push({
      key,
      newPatients: firstVisits.filter((f) => monthKey(f._min.visitDate!.getTime()) === key).length,
      visits: visits.filter((v) => monthKey(v.visitDate.getTime()) === key).length,
    });
  }

  const mine = auth.staffId ? {
    visitsToday: todays.filter((v) => v.registeredById === auth.staffId).length,
    visits7: visitsIn(today - 6 * DAY).filter((v) => v.registeredById === auth.staffId).length,
    collectedToday: sum(payIn(today).filter((p) => p.recordedById === auth.staffId)),
    actionsToday: await db.facilityAuditEvent.count({ where: { facilityId: fid, actorId: auth.staffId, createdAt: { gte: new Date(today) }, outcome: "success" } }),
  } : null;

  return NextResponse.json({
    generatedAt: new Date(now).toISOString(),
    patients: {
      newToday: newIn(today), newYesterday: newIn(today - DAY, today),
      new7: newIn(today - 6 * DAY), new30: newIn(today - 29 * DAY), new12m: newIn(since12m),
      returningToday, totalEver: firstVisits.length,
    },
    visits: {
      today: todays.length, yesterday: visitsIn(today - DAY, today).length,
      waitingVitals: todays.filter((v) => !v.vitalSigns && !referred(v)).length,
      inAssessment: todays.filter((v) => v.vitalSigns && !referred(v) && v.tashkheesDossier?.status !== "finalized").length,
      completed: todays.filter((v) => v.tashkheesDossier?.status === "finalized").length,
      referred: todays.filter(referred).length,
    },
    money: can("finance.view") ? { today: sum(payIn(today)), last7: sum(payIn(today - 6 * DAY)), last30: sum(payIn(today - 29 * DAY)) } : null,
    trend: { d7: daily(7), d30: daily(30), m12: months },
    mine,
  });
}
