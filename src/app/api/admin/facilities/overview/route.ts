import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { netAmount } from "@/lib/payments";

const DAY = 86_400_000;
const WEEKS = 8;

export type HealthBand = "thriving" | "steady" | "at_risk" | "dormant";

/**
 * Every facility with its activity figures and an engagement score, for the
 * admin Facilities page. Returned in full (the page filters, sorts and pages
 * in the browser), so every column — computed ones too — can be sorted.
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since60 = new Date(now - 60 * DAY);

  const [facilities, visits, payments] = await Promise.all([
    db.facility.findMany({
      select: {
        id: true, facilityName: true, email: true, phone: true, avatarColor: true, verified: true, active: true,
        lastLoginAt: true, createdAt: true, facilityType: true, city: true, state: true, hfrNumber: true,
        profileCompleted: true, profileCompletedAt: true, is24x7: true, emergencyServices: true, ambulanceAvailable: true,
        bedCapacity: true, dailyOpdCount: true, lockedUntil: true,
        subscriptions: { orderBy: { endDate: "desc" }, take: 1, select: { plan: true, status: true, startDate: true, endDate: true } },
        staff: { select: { active: true } },
      },
    }),
    db.visit.findMany({ select: { facilityId: true, patientId: true, createdAt: true } }),
    db.payment.findMany({ select: { amount: true, status: true, refundAmount: true, createdAt: true, visit: { select: { facilityId: true } } } }),
  ]);

  type Acc = { patients: Set<string>; visits: number; visits30: number; visitsPrev30: number; weekly: number[]; lastVisitAt: number; revenue: number; revenue30: number };
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) { a = { patients: new Set(), visits: 0, visits30: 0, visitsPrev30: 0, weekly: Array(WEEKS).fill(0), lastVisitAt: 0, revenue: 0, revenue30: 0 }; acc.set(id, a); }
    return a;
  };
  for (const v of visits) {
    const a = get(v.facilityId); const t = v.createdAt.getTime();
    a.patients.add(v.patientId); a.visits++;
    if (t >= since30.getTime()) a.visits30++; else if (t >= since60.getTime()) a.visitsPrev30++;
    const week = Math.floor((now - t) / (7 * DAY));
    if (week < WEEKS) a.weekly[WEEKS - 1 - week]++;
    a.lastVisitAt = Math.max(a.lastVisitAt, t);
  }
  for (const p of payments) {
    if (!p.visit) continue;
    const a = get(p.visit.facilityId); const n = netAmount(p);
    a.revenue += n; if (p.createdAt >= since30) a.revenue30 += n;
  }

  const rows = facilities.map((f) => {
    const a = acc.get(f.id) ?? get(f.id);
    const sub = f.subscriptions[0] ?? null;
    const subEnd = sub ? sub.endDate.getTime() : null;
    const daysLeft = subEnd !== null ? Math.ceil((subEnd - now) / DAY) : null;
    const plan = !sub ? "none" : daysLeft !== null && daysLeft < 0 ? "expired" : sub.plan === "FREE" ? "trial" : "premium";
    const lastLogin = f.lastLoginAt?.getTime() ?? null;
    const daysSinceLogin = lastLogin ? Math.floor((now - lastLogin) / DAY) : null;
    const lastActivity = Math.max(lastLogin ?? 0, a.lastVisitAt) || null;
    const daysSinceActivity = lastActivity ? Math.floor((now - lastActivity) / DAY) : null;
    const staffActive = f.staff.filter((s) => s.active).length;

    // Engagement score (0–100): recent use weighs most, then setup quality.
    const reasons: { text: string; good: boolean }[] = [];
    let score = 0;
    const recency = daysSinceActivity === null ? 0 : daysSinceActivity <= 3 ? 30 : daysSinceActivity <= 7 ? 24 : daysSinceActivity <= 14 ? 15 : daysSinceActivity <= 30 ? 8 : 0;
    score += recency;
    reasons.push(daysSinceActivity === null ? { text: "Never used yet", good: false } : { text: daysSinceActivity === 0 ? "Active today" : `Last active ${daysSinceActivity} day${daysSinceActivity === 1 ? "" : "s"} ago`, good: daysSinceActivity <= 7 });
    const vol = Math.min(30, Math.round((a.visits30 / 20) * 30));
    score += vol;
    reasons.push({ text: `${a.visits30} visit${a.visits30 === 1 ? "" : "s"} in 30 days`, good: a.visits30 >= 5 });
    if (f.profileCompleted) score += 15; reasons.push({ text: f.profileCompleted ? "Profile complete" : "Profile not completed", good: f.profileCompleted });
    if (f.verified) score += 10; reasons.push({ text: f.verified ? "Verified" : "Not verified", good: f.verified });
    if (a.revenue30 > 0) score += 10; reasons.push({ text: a.revenue30 > 0 ? "Recording payments" : "No payments recorded in 30 days", good: a.revenue30 > 0 });
    if (staffActive > 0) score += 5; reasons.push({ text: staffActive ? `${staffActive} active staff` : "No staff added", good: staffActive > 0 });
    if (!f.active) score = Math.min(score, 10);
    const health: HealthBand = score >= 75 ? "thriving" : score >= 50 ? "steady" : score >= 25 ? "at_risk" : "dormant";

    return {
      id: f.id, facilityName: f.facilityName, email: f.email, phone: f.phone, avatarColor: f.avatarColor,
      facilityType: f.facilityType, city: f.city, state: f.state, hfrNumber: f.hfrNumber,
      verified: f.verified, active: f.active, locked: !!f.lockedUntil && f.lockedUntil.getTime() > now,
      profileCompleted: f.profileCompleted, profileCompletedAt: f.profileCompletedAt,
      is24x7: f.is24x7, emergencyServices: f.emergencyServices, ambulanceAvailable: f.ambulanceAvailable,
      bedCapacity: f.bedCapacity, dailyOpdCount: f.dailyOpdCount,
      createdAt: f.createdAt, lastLoginAt: f.lastLoginAt, daysSinceLogin, daysSinceActivity,
      plan, planEnd: sub?.endDate ?? null, daysLeft,
      patients: a.patients.size, visits: a.visits, visits30: a.visits30, visitsPrev30: a.visitsPrev30, weekly: a.weekly,
      revenue: Math.round(a.revenue), revenue30: Math.round(a.revenue30),
      staff: f.staff.length, staffActive,
      score, health, reasons,
    };
  });

  return NextResponse.json({ facilities: rows, generatedAt: new Date(now).toISOString() });
}
