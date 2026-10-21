import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { netAmount, paymentState } from "@/lib/payments";
import { scoreFacility, type HealthBand } from "@/lib/facility-health";
import { buildInsights, forecastNext, platformHealth } from "@/lib/admin-insights";

const DAY = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const parseArr = (s: string | null | undefined): string[] => { try { const v = JSON.parse(s || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; } };

/**
 * Everything the admin home dashboard shows, for one period (?days=7|30|90|365) against the
 * period before it: headline figures with trends, time series, the clinical journey, clinics,
 * patients, payments, safety, catalogue and content health, system status and ranked insights.
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const days = [7, 30, 90, 365].includes(Number(req.nextUrl.searchParams.get("days"))) ? Number(req.nextUrl.searchParams.get("days")) : 30;
  const now = Date.now();
  const since = new Date(now - days * DAY);
  const prevSince = new Date(now - 2 * days * DAY);
  const inNow = (d: Date) => d >= since;
  const inPrev = (d: Date) => d >= prevSince && d < since;

  const [
    facilities, visitsAll, patients, payments, appointments, referrals, amaDeclines, screenings, dossiers,
    staffActive, logins, notifications, cdsDecisions, safetyAcks, reports, integrations, emailConfig,
    medTags, profiles, safetyItems, amraz, usoolDrafts, langs, keyCount, values, prescriptions, intakes,
  ] = await Promise.all([
    db.facility.findMany({
      select: {
        id: true, facilityName: true, avatarColor: true, active: true, verified: true, profileCompleted: true, lastLoginAt: true, createdAt: true, city: true, state: true,
        subscriptions: { orderBy: { endDate: "desc" }, take: 1, select: { plan: true, status: true, endDate: true } },
        staff: { select: { active: true } },
      },
    }),
    db.visit.findMany({ select: { id: true, facilityId: true, patientId: true, createdAt: true } }),
    db.patient.findMany({ select: { id: true, gender: true, dob: true, state: true, city: true, createdAt: true, active: true } }),
    db.payment.findMany({ where: { createdAt: { gte: prevSince } }, select: { amount: true, status: true, refundAmount: true, mode: true, createdAt: true, visit: { select: { facilityId: true } } } }),
    db.appointment.findMany({ where: { createdAt: { gte: prevSince } }, select: { status: true, createdAt: true } }),
    db.referral.findMany({ where: { createdAt: { gte: prevSince } }, select: { urgency: true, referredTo: true, createdAt: true } }),
    db.amaDecline.count({ where: { createdAt: { gte: since } } }),
    db.redFlagScreening.findMany({ where: { createdAt: { gte: since } }, select: { outcome: true } }),
    db.tashkheesDossier.findMany({ where: { createdAt: { gte: prevSince } }, select: { visitId: true, status: true, suMizajQuality: true, createdAt: true, finalizedAt: true } }),
    db.staff.count({ where: { active: true } }),
    db.loginEvent.findMany({ where: { createdAt: { gte: prevSince } }, select: { status: true, createdAt: true, facilityId: true, staffId: true, patientId: true } }),
    db.notificationLog.findMany({ where: { createdAt: { gte: since } }, select: { status: true } }),
    db.cdsDecision.findMany({ where: { createdAt: { gte: since } }, select: { action: true } }),
    db.safetyAcknowledgement.count({ where: { createdAt: { gte: since } } }),
    db.patientReport.findMany({ where: { createdAt: { gte: since } }, select: { resultFlag: true, reviewedAt: true } }),
    db.integrationConfig.findMany({ select: { provider: true, active: true, keyEnc: true } }),
    db.emailConfig.findFirst({ select: { active: true, provider: true } }),
    db.medicationTag.groupBy({ by: ["kind"], where: { active: true }, _count: true }),
    db.supplementProfile.findMany({ select: { completeness: true, status: true } }),
    db.supplementSafetyItem.groupBy({ by: ["verificationStatus"], _count: true }),
    db.marzEntry.groupBy({ by: ["reviewStatus"], where: { active: true }, _count: true }),
    db.tashkheesOption.count({ where: { list: "usool", reviewStatus: "draft" } }),
    db.language.findMany({ where: { enabled: true }, select: { code: true, englishName: true, isDefault: true }, orderBy: { sortOrder: "asc" } }),
    db.translationKey.count(),
    db.translationValue.groupBy({ by: ["languageCode"], _count: true }),
    db.prescription.count({ where: { createdAt: { gte: since } } }),
    db.visitIntake.findMany({ where: { createdAt: { gte: prevSince } }, select: { chiefComplaints: true, createdAt: true } }),
  ]);

  // ---------------------------------------------------------------- series
  const weekly = days > 90;
  const buckets = weekly ? Math.ceil(days / 7) : days;
  const step = weekly ? 7 * DAY : DAY;
  const bucketOf = (d: Date) => buckets - 1 - Math.floor((now - d.getTime()) / step);
  const labels = Array.from({ length: buckets }, (_, i) => new Date(now - (buckets - 1 - i) * step).toISOString().slice(0, 10));
  const sVisits = Array(buckets).fill(0), sPatients = Array(buckets).fill(0), sRevenue = Array(buckets).fill(0);

  const visitsNow = visitsAll.filter((v) => inNow(v.createdAt));
  const visitsPrevN = visitsAll.filter((v) => inPrev(v.createdAt)).length;
  for (const v of visitsNow) { const b = bucketOf(v.createdAt); if (b >= 0) sVisits[b]++; }
  const patientsNow = patients.filter((p) => inNow(p.createdAt));
  for (const p of patientsNow) { const b = bucketOf(p.createdAt); if (b >= 0) sPatients[b]++; }
  let revNow = 0, revPrev = 0, pendingCount = 0, pendingAmount = 0; // pending* = refunds in the period
  const byMode = new Map<string, number>(), byStatus = new Map<string, number>();
  for (const p of payments) {
    const n = netAmount(p);
    const st = paymentState(p.status);
    if (inNow(p.createdAt)) {
      revNow += n; const b = bucketOf(p.createdAt); if (b >= 0) sRevenue[b] += n;
      byMode.set(p.mode || "Other", (byMode.get(p.mode || "Other") ?? 0) + n);
      byStatus.set(st, (byStatus.get(st) ?? 0) + 1);
      if (st === "refunded" || st === "partially_refunded") { pendingCount++; pendingAmount += p.refundAmount ?? 0; }
    } else revPrev += n;
  }

  // ---------------------------------------------------------------- clinics
  const visitAgg = new Map<string, { visits: number; visitsPrev: number; patients: Set<string>; last: number; revenue: number }>();
  const ag = (id: string) => { let a = visitAgg.get(id); if (!a) { a = { visits: 0, visitsPrev: 0, patients: new Set(), last: 0, revenue: 0 }; visitAgg.set(id, a); } return a; };
  for (const v of visitsAll) {
    const a = ag(v.facilityId);
    a.last = Math.max(a.last, v.createdAt.getTime());
    if (inNow(v.createdAt)) { a.visits++; a.patients.add(v.patientId); } else if (inPrev(v.createdAt)) a.visitsPrev++;
  }
  for (const p of payments) if (p.visit && inNow(p.createdAt)) ag(p.visit.facilityId).revenue += netAmount(p);
  const last30 = new Map<string, { v: number; r: number }>();
  for (const v of visitsAll) if (v.createdAt.getTime() >= now - 30 * DAY) { const x = last30.get(v.facilityId) ?? { v: 0, r: 0 }; x.v++; last30.set(v.facilityId, x); }
  for (const p of payments) if (p.visit && p.createdAt.getTime() >= now - 30 * DAY) { const x = last30.get(p.visit.facilityId) ?? { v: 0, r: 0 }; x.r += netAmount(p); last30.set(p.visit.facilityId, x); }

  const bands: Record<HealthBand, number> = { thriving: 0, steady: 0, at_risk: 0, dormant: 0 };
  let expiringSoon = 0, expired = 0;
  const plans = { premium: 0, trial: 0, expired: 0, none: 0 };
  const clinicRows = facilities.map((f) => {
    const a = visitAgg.get(f.id);
    const lastActivity = Math.max(f.lastLoginAt?.getTime() ?? 0, a?.last ?? 0) || null;
    const daysSinceActivity = lastActivity ? Math.floor((now - lastActivity) / DAY) : null;
    const l30 = last30.get(f.id) ?? { v: 0, r: 0 };
    const { score, health } = scoreFacility({ active: f.active, verified: f.verified, profileCompleted: f.profileCompleted, daysSinceActivity, visits30: l30.v, revenue30: l30.r, staffActive: f.staff.filter((s) => s.active).length });
    bands[health]++;
    const sub = f.subscriptions[0];
    const daysLeft = sub ? Math.ceil((sub.endDate.getTime() - now) / DAY) : null;
    const plan = !sub ? "none" : daysLeft !== null && daysLeft < 0 ? "expired" : sub.plan === "FREE" ? "trial" : "premium";
    plans[plan as keyof typeof plans]++;
    if (plan === "expired" && f.active) expired++;
    if (daysLeft !== null && daysLeft >= 0 && daysLeft <= 14) expiringSoon++;
    return {
      id: f.id, name: f.facilityName, avatarColor: f.avatarColor, city: f.city, state: f.state, active: f.active, verified: f.verified,
      visits: a?.visits ?? 0, visitsPrev: a?.visitsPrev ?? 0, patients: a?.patients.size ?? 0, revenue: Math.round(a?.revenue ?? 0),
      score, health, plan, daysLeft, lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
    };
  }).sort((x, y) => y.visits - x.visits || y.score - x.score);

  // ---------------------------------------------------------------- clinical journey (visits in the period)
  const ids = visitsNow.map((v) => v.id);
  const chunk = <T,>(arr: T[], n = 500) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const countIn = async (fn: (part: string[]) => Promise<{ visitId: string }[]>) => {
    const set = new Set<string>();
    for (const part of chunk(ids)) (await fn(part)).forEach((r) => set.add(r.visitId));
    return set.size;
  };
  const [nVitals, nIntake, nScreen, nAsbab] = ids.length ? await Promise.all([
    countIn((part) => db.vitalSigns.findMany({ where: { visitId: { in: part } }, select: { visitId: true } })),
    countIn((part) => db.visitIntake.findMany({ where: { visitId: { in: part } }, select: { visitId: true } })),
    countIn((part) => db.redFlagScreening.findMany({ where: { visitId: { in: part } }, select: { visitId: true } })),
    countIn((part) => db.asbabAssessment.findMany({ where: { visitId: { in: part } }, select: { visitId: true } })),
  ]) : [0, 0, 0, 0];
  const idSet = new Set(ids);
  const dossNow = dossiers.filter((d) => idSet.has(d.visitId));
  const funnel = [
    { key: "registered", label: "Registered", count: ids.length },
    { key: "vitals", label: "Vitals & triage", count: nVitals },
    { key: "complaints", label: "Complaints", count: nIntake },
    { key: "screened", label: "Warning-sign screen", count: nScreen },
    { key: "asbab", label: "Asbab-e-Sittah", count: nAsbab },
    { key: "dossier", label: "Tashkhees started", count: dossNow.length },
    { key: "finalised", label: "Dossier finalised", count: dossNow.filter((d) => d.status === "finalized").length },
  ];

  // ---------------------------------------------------------------- patients
  const ageBands = [["0–12", 0, 12], ["13–19", 13, 19], ["20–34", 20, 34], ["35–49", 35, 49], ["50–64", 50, 64], ["65+", 65, 200]] as const;
  const ages = Object.fromEntries(ageBands.map(([l]) => [l, 0])) as Record<string, number>;
  let ageUnknown = 0;
  const gender = new Map<string, number>(), stateMap = new Map<string, number>();
  for (const p of patients) {
    const g = (p.gender || "Not recorded").replace(/^\w/, (c) => c.toUpperCase());
    gender.set(g, (gender.get(g) ?? 0) + 1);
    const yr = p.dob ? Number(p.dob.slice(0, 4)) : NaN;
    if (Number.isFinite(yr) && yr > 1900) {
      const age = new Date().getFullYear() - yr;
      const band = ageBands.find(([, lo, hi]) => age >= lo && age <= hi);
      if (band) ages[band[0]]++; else ageUnknown++;
    } else ageUnknown++;
    if (p.state) stateMap.set(p.state, (stateMap.get(p.state) ?? 0) + 1);
  }
  const returning = (() => {
    const per = new Map<string, number>();
    for (const v of visitsAll) per.set(v.patientId, (per.get(v.patientId) ?? 0) + 1);
    let r = 0; per.forEach((n) => { if (n > 1) r++; });
    return { returning: r, withVisits: per.size };
  })();

  // ---------------------------------------------------------------- complaints & temperament
  const cNow = new Map<string, number>(), cPrev = new Map<string, number>();
  for (const it of intakes) for (const c of parseArr(it.chiefComplaints)) { const m = inNow(it.createdAt) ? cNow : cPrev; m.set(c, (m.get(c) ?? 0) + 1); }
  const topComplaints = [...cNow.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => ({ label, now: n, prev: cPrev.get(label) ?? 0 }));
  const complaintsRising = [...cNow.entries()].map(([label, n]) => ({ label, now: n, prev: cPrev.get(label) ?? 0 }))
    .filter((x) => x.now >= 3 && x.now >= 1.5 * Math.max(1, x.prev)).sort((a, b) => b.now - b.prev - (a.now - a.prev));
  const mizaj = new Map<string, number>();
  for (const d of dossiers) if (inNow(d.createdAt) && d.suMizajQuality) mizaj.set(d.suMizajQuality, (mizaj.get(d.suMizajQuality) ?? 0) + 1);

  // ---------------------------------------------------------------- busiest hours (period)
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const v of visitsNow) { const d = new Date(v.createdAt.getTime() + 5.5 * 3600_000); heat[d.getUTCDay()][d.getUTCHours()]++; }
  let busiest: { day: string; hour: number } | null = null, best = 0;
  heat.forEach((row, d) => row.forEach((n, h) => { if (n > best) { best = n; busiest = { day: WEEKDAYS[d], hour: h }; } }));

  // ---------------------------------------------------------------- safety
  const refNow = referrals.filter((r) => inNow(r.createdAt));
  const urgency = new Map<string, number>();
  for (const r of refNow) urgency.set(r.urgency || "unspecified", (urgency.get(r.urgency || "unspecified") ?? 0) + 1);
  const outcomes = new Map<string, number>();
  for (const s of screenings) outcomes.set(s.outcome, (outcomes.get(s.outcome) ?? 0) + 1);
  const cds = new Map<string, number>();
  for (const c of cdsDecisions) cds.set(c.action, (cds.get(c.action) ?? 0) + 1);

  // ---------------------------------------------------------------- catalogue & content
  const enriched = profiles.filter((p) => p.status === "enriched");
  const avgCompleteness = enriched.length ? Math.round(enriched.reduce((a, p) => a + p.completeness, 0) / enriched.length) : 0;
  const safetyBy = Object.fromEntries(safetyItems.map((s) => [s.verificationStatus, s._count])) as Record<string, number>;
  const amrazBy = Object.fromEntries(amraz.map((a) => [a.reviewStatus, a._count])) as Record<string, number>;
  const valBy = Object.fromEntries(values.map((v) => [v.languageCode, v._count])) as Record<string, number>;
  const translations = langs.map((l) => ({ code: l.code, language: l.englishName, coverage: l.isDefault || !keyCount ? 100 : Math.min(100, Math.round(((valBy[l.code] ?? 0) / keyCount) * 100)) }));
  const kinds = Object.fromEntries(medTags.map((m) => [m.kind, m._count])) as Record<string, number>;

  // ---------------------------------------------------------------- system
  const loginNow = logins.filter((l) => inNow(l.createdAt));
  const failedNow = loginNow.filter((l) => l.status !== "success").length;
  const failedPrev = logins.filter((l) => inPrev(l.createdAt) && l.status !== "success").length;
  const actor = (l: (typeof logins)[number]) => (l.staffId ? "staff" : l.facilityId ? "clinic" : l.patientId ? "patient" : "other");
  const loginsBy = { clinic: 0, staff: 0, patient: 0, other: 0 };
  for (const l of loginNow) if (l.status === "success") loginsBy[actor(l)]++;
  const notifFailed = notifications.filter((n) => n.status !== "sent").length;
  const ai = integrations.map((i) => ({ provider: i.provider, on: i.active && !!i.keyEnc, hasKey: !!i.keyEnc }));
  const aiOn = ai.some((x) => x.on);

  const insights = buildInsights({
    days,
    visits: { now: visitsNow.length, prev: visitsPrevN },
    patientsNew: { now: patientsNow.length, prev: patients.filter((p) => inPrev(p.createdAt)).length },
    revenue: { now: revNow, prev: revPrev },
    referrals: { now: refNow.length, prev: referrals.length - refNow.length },
    amaDeclines,
    dailyVisits: weekly ? sVisits : sVisits.slice(-Math.min(days, 60)),
    clinics: { total: facilities.length, dormant: bands.dormant, atRisk: bands.at_risk, inactiveNames: clinicRows.filter((c) => c.health === "dormant" || c.health === "at_risk").map((c) => c.name) },
    subscriptions: { expiringSoon, expired },
    funnel,
    refunds: { count: pendingCount, amount: pendingAmount },
    failedLogins: { now: failedNow, prev: failedPrev },
    notificationFailures: notifFailed,
    catalogue: { amrazUnverified: (amrazBy.draft ?? 0), safetyUnverified: (safetyBy.unverified ?? 0) + (safetyBy.conflict ?? 0), usoolDrafts, avgCompleteness },
    translations,
    complaintsRising,
    busiest,
    aiOn,
  });
  const completion = funnel[0].count ? funnel.at(-1)!.count / funnel[0].count : 0;
  const health = platformHealth({ clinicsTotal: facilities.length, clinicsHealthy: bands.thriving + bands.steady, completion, catalogueCompleteness: avgCompleteness, criticalCount: insights.filter((i) => i.severity === "critical").length });

  return NextResponse.json({
    days, generatedAt: new Date().toISOString(),
    health,
    kpis: {
      clinics: { total: facilities.length, active: facilities.filter((f) => f.active).length, new: facilities.filter((f) => inNow(f.createdAt)).length, healthy: bands.thriving + bands.steady },
      staff: staffActive,
      patients: { total: patients.length, new: patientsNow.length, prev: patients.filter((p) => inPrev(p.createdAt)).length },
      visits: { now: visitsNow.length, prev: visitsPrevN, forecast: forecastNext(weekly ? sVisits : sVisits.slice(-Math.min(days, 60))) },
      revenue: { now: Math.round(revNow), prev: Math.round(revPrev) },
      appointments: { now: appointments.filter((a) => inNow(a.createdAt)).length, prev: appointments.filter((a) => inPrev(a.createdAt)).length },
      finalised: { now: dossiers.filter((d) => d.finalizedAt && d.finalizedAt >= since).length, prev: dossiers.filter((d) => d.finalizedAt && d.finalizedAt >= prevSince && d.finalizedAt < since).length },
      referrals: { now: refNow.length, prev: referrals.length - refNow.length },
      prescriptions,
    },
    series: { weekly, labels, visits: sVisits, patients: sPatients, revenue: sRevenue.map((x) => Math.round(x)) },
    funnel,
    clinics: { bands, plans, expiringSoon, rows: clinicRows.slice(0, 50) },
    patients: {
      gender: [...gender.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
      ages: Object.entries(ages).map(([label, n]) => ({ label, n })), ageUnknown,
      states: [...stateMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, n]) => ({ label, n })),
      returning,
    },
    complaints: topComplaints,
    mizaj: [...mizaj.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, n })),
    heat,
    payments: {
      byMode: [...byMode.entries()].map(([label, amount]) => ({ label, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount),
      byStatus: [...byStatus.entries()].map(([label, n]) => ({ label, n })),
      refunds: { count: pendingCount, amount: Math.round(pendingAmount) },
    },
    safety: {
      screenings: [...outcomes.entries()].map(([label, n]) => ({ label, n })),
      referralsByUrgency: [...urgency.entries()].map(([label, n]) => ({ label, n })),
      amaDeclines, acknowledgements: safetyAcks,
      cds: [...cds.entries()].map(([label, n]) => ({ label, n })),
      reports: { total: reports.length, abnormal: reports.filter((r) => r.resultFlag === "abnormal" || r.resultFlag === "critical").length, unreviewed: reports.filter((r) => !r.reviewedAt).length },
    },
    catalogue: {
      unani: kinds.supplement ?? 0, allopathic: kinds.medication ?? 0, avgCompleteness,
      safety: { verified: safetyBy.verified ?? 0, unverified: (safetyBy.unverified ?? 0) + (safetyBy.conflict ?? 0), total: Object.values(safetyBy).reduce((a, b) => a + b, 0) },
      amraz: { approved: amrazBy.approved ?? 0, draft: amrazBy.draft ?? 0 },
      usoolDrafts,
    },
    translations, translationKeys: keyCount,
    system: {
      ai, aiOn,
      email: emailConfig ? { configured: true, active: emailConfig.active, provider: emailConfig.provider } : { configured: false, active: false, provider: null },
      notifications: { sent: notifications.length - notifFailed, failed: notifFailed },
      logins: { ...loginsBy, failed: failedNow },
    },
    insights,
  });
}
