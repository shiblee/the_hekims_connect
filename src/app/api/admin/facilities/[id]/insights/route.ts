import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { netAmount, paymentState } from "@/lib/payments";
import { scoreFacility } from "@/lib/facility-health";

const DAY = 86_400_000;
const WEEKS = 12;

/** Activity, engagement and setup figures for one clinic (admin facility detail → Overview). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;

  const f = await db.facility.findUnique({
    where: { id },
    select: {
      active: true, verified: true, profileCompleted: true, lastLoginAt: true, hfrNumber: true, addressLine1: true, city: true,
      is24x7: true, specializations: true, services: true, lockedUntil: true, failedLoginAttempts: true,
      operatingHours: { select: { isOpen: true } },
      _count: { select: { appointments: true, prescriptions: true, mizajAssessments: true, fees: true } },
    },
  });
  if (!f) return NextResponse.json({ error: "Facility not found" }, { status: 404 });

  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const [visits, payments, staff, events, logins, upcoming] = await Promise.all([
    db.visit.findMany({ where: { facilityId: id }, select: { patientId: true, createdAt: true } }),
    db.payment.findMany({ where: { visit: { facilityId: id } }, select: { amount: true, status: true, refundAmount: true, mode: true, createdAt: true } }),
    db.staff.findMany({ where: { facilityId: id }, orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, role: true, designation: true, employeeType: true, active: true, lastLoginAt: true, createdAt: true } }),
    db.facilityAuditEvent.findMany({ where: { facilityId: id }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, actorType: true, actorName: true, action: true, summary: true, outcome: true, createdAt: true } }),
    db.loginEvent.findMany({ where: { facilityId: id }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, displayName: true, status: true, browser: true, os: true, device: true, ip: true, staffId: true, createdAt: true } }),
    db.appointment.count({ where: { facilityId: id, date: { gte: today }, status: { notIn: ["cancelled", "completed"] } } }),
  ]);

  const patients = new Set<string>();
  const weekly = Array(WEEKS).fill(0) as number[];
  let visits30 = 0, visitsPrev30 = 0, lastVisitAt = 0, firstVisitAt = 0;
  for (const v of visits) {
    const t = v.createdAt.getTime();
    patients.add(v.patientId);
    if (now - t <= 30 * DAY) visits30++; else if (now - t <= 60 * DAY) visitsPrev30++;
    const w = Math.floor((now - t) / (7 * DAY));
    if (w < WEEKS) weekly[WEEKS - 1 - w]++;
    lastVisitAt = Math.max(lastVisitAt, t);
    firstVisitAt = firstVisitAt ? Math.min(firstVisitAt, t) : t;
  }
  const newPatients30 = (() => {
    const first = new Map<string, number>();
    for (const v of visits) { const t = v.createdAt.getTime(); const p = first.get(v.patientId); if (p === undefined || t < p) first.set(v.patientId, t); }
    return [...first.values()].filter((t) => now - t <= 30 * DAY).length;
  })();

  let revenue = 0, revenue30 = 0, revenuePrev30 = 0, refunds = 0, paidCount = 0;
  const byMode = new Map<string, number>();
  for (const p of payments) {
    const n = netAmount(p); const t = p.createdAt.getTime();
    revenue += n;
    if (now - t <= 30 * DAY) revenue30 += n; else if (now - t <= 60 * DAY) revenuePrev30 += n;
    if (paymentState(p.status) !== "cancelled") { paidCount++; byMode.set(p.mode, (byMode.get(p.mode) ?? 0) + n); }
    refunds += p.refundAmount ?? 0;
  }

  const lastLogin = f.lastLoginAt?.getTime() ?? 0;
  const lastActivity = Math.max(lastLogin, lastVisitAt) || null;
  const daysSinceActivity = lastActivity ? Math.floor((now - lastActivity) / DAY) : null;
  const staffActive = staff.filter((s) => s.active).length;
  const { score, health, reasons } = scoreFacility({ active: f.active, verified: f.verified, profileCompleted: f.profileCompleted, daysSinceActivity, visits30, revenue30, staffActive });

  const listLen = (json: string | null) => { try { const v = JSON.parse(json || "[]"); return Array.isArray(v) ? v.length : 0; } catch { return 0; } };
  const checklist = [
    { key: "profile", label: "Profile setup completed", done: f.profileCompleted },
    { key: "verified", label: "Account verified", done: f.verified },
    { key: "hfr", label: "HFR number added", done: !!f.hfrNumber },
    { key: "address", label: "Address added", done: !!(f.addressLine1 && f.city) },
    { key: "hours", label: "Opening hours set", done: f.is24x7 || f.operatingHours.some((h) => h.isOpen) },
    { key: "services", label: "Specializations & services listed", done: listLen(f.specializations) > 0 && listLen(f.services) > 0 },
    { key: "fees", label: "Fee list set up", done: f._count.fees > 0 },
    { key: "staff", label: "Staff added", done: staff.length > 0 },
    { key: "visit", label: "First patient visit recorded", done: visits.length > 0 },
    { key: "payment", label: "First payment recorded", done: paidCount > 0 },
  ];

  return NextResponse.json({
    metrics: {
      patients: patients.size, newPatients30, visits: visits.length, visits30, visitsPrev30, weekly,
      revenue: Math.round(revenue), revenue30: Math.round(revenue30), revenuePrev30: Math.round(revenuePrev30), refunds: Math.round(refunds), payments: paidCount,
      byMode: [...byMode.entries()].map(([mode, amount]) => ({ mode, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount),
      appointments: f._count.appointments, upcoming, prescriptions: f._count.prescriptions, assessments: f._count.mizajAssessments,
      firstVisitAt: firstVisitAt ? new Date(firstVisitAt).toISOString() : null,
      lastActivityAt: lastActivity ? new Date(lastActivity).toISOString() : null, daysSinceActivity,
    },
    score, health, reasons, checklist,
    locked: !!f.lockedUntil && f.lockedUntil.getTime() > now, failedLoginAttempts: f.failedLoginAttempts,
    staff, events, logins,
  });
}
