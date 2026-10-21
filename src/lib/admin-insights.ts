// Admin dashboard "Hakeem Insight" — turns the platform's figures into a short, ranked list of
// things worth the admin's attention: what changed, what is at risk and what to do next.
// Pure rules and statistics on the server (no AI service is called), so it costs nothing to run
// and every insight can be traced to the numbers shown beside it.

export type InsightSeverity = "critical" | "warning" | "positive" | "info";
export interface Insight { id: string; severity: InsightSeverity; title: string; detail: string; href?: string; action?: string; weight: number }

export interface InsightInput {
  days: number;
  visits: { now: number; prev: number };
  patientsNew: { now: number; prev: number };
  revenue: { now: number; prev: number };
  referrals: { now: number; prev: number };
  amaDeclines: number;
  dailyVisits: number[];
  clinics: { total: number; dormant: number; atRisk: number; inactiveNames: string[] };
  subscriptions: { expiringSoon: number; expired: number };
  funnel: { key: string; label: string; count: number }[];
  refunds: { count: number; amount: number };
  failedLogins: { now: number; prev: number };
  notificationFailures: number;
  catalogue: { amrazUnverified: number; safetyUnverified: number; usoolDrafts: number; avgCompleteness: number };
  translations: { language: string; coverage: number }[];
  complaintsRising: { label: string; now: number; prev: number }[];
  busiest: { day: string; hour: number } | null;
  aiOn: boolean;
}

const pct = (now: number, prev: number) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : null);
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const hour12 = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;

/** Least-squares slope of a series (per step). */
export function slope(series: number[]): number {
  const n = series.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2, my = series.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  series.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return den ? num / den : 0;
}

/**
 * Projection for the next period of the same length: this period's total plus half the fitted
 * trend (damped — a short series overreacts), kept between half and one-and-a-half times today's total.
 */
export function forecastNext(series: number[]): number {
  const n = series.length;
  if (!n) return 0;
  const total = series.reduce((a, b) => a + b, 0);
  const projected = total + slope(series) * n * n * 0.5;
  return Math.round(Math.min(total * 1.5 || projected, Math.max(total * 0.5, projected, 0)));
}

export function buildInsights(m: InsightInput): Insight[] {
  const out: Insight[] = [];
  const add = (i: Insight) => out.push(i);
  const period = `the last ${m.days} days`;

  // ---- Growth
  const v = pct(m.visits.now, m.visits.prev);
  if (v !== null && m.visits.prev >= 5 && Math.abs(v) >= 15) {
    add(v > 0
      ? { id: "visits-up", severity: "positive", title: `Visits up ${v}%`, detail: `${m.visits.now} visits in ${period} against ${m.visits.prev} before.`, href: "/admin/facilities", action: "See clinics", weight: 60 }
      : { id: "visits-down", severity: "warning", title: `Visits down ${Math.abs(v)}%`, detail: `${m.visits.now} visits in ${period} against ${m.visits.prev} before — check which clinics slowed down.`, href: "/admin/facilities", action: "See clinics", weight: 80 });
  }
  const r = pct(m.revenue.now, m.revenue.prev);
  if (r !== null && m.revenue.prev > 0 && Math.abs(r) >= 15) {
    add(r > 0
      ? { id: "rev-up", severity: "positive", title: `Collections up ${r}%`, detail: `${inr(m.revenue.now)} collected in ${period} (${inr(m.revenue.prev)} before).`, href: "/admin/payments", action: "Payments", weight: 55 }
      : { id: "rev-down", severity: "warning", title: `Collections down ${Math.abs(r)}%`, detail: `${inr(m.revenue.now)} collected in ${period} against ${inr(m.revenue.prev)} before.`, href: "/admin/payments", action: "Payments", weight: 75 });
  }
  const p = pct(m.patientsNew.now, m.patientsNew.prev);
  if (p !== null && m.patientsNew.prev >= 3 && p >= 25) add({ id: "patients-up", severity: "positive", title: `New patients up ${p}%`, detail: `${m.patientsNew.now} new patients registered in ${period}.`, href: "/admin/patients", action: "Patients", weight: 45 });

  // ---- Forecast
  if (m.dailyVisits.length >= 7 && m.dailyVisits.some((x) => x > 0)) {
    const next = forecastNext(m.dailyVisits);
    const s = slope(m.dailyVisits);
    add({ id: "forecast", severity: "info", title: `About ${next} visits expected next ${m.days} days`, detail: `Projected from the daily trend (${s >= 0 ? "rising" : "falling"} by ${Math.abs(s).toFixed(2)} visits a day).`, weight: 30 });
  }

  // ---- Clinics
  if (m.clinics.dormant + m.clinics.atRisk > 0) {
    const names = m.clinics.inactiveNames.slice(0, 3).join(", ");
    add({ id: "clinics-risk", severity: m.clinics.dormant > 0 ? "warning" : "info", title: `${m.clinics.dormant + m.clinics.atRisk} clinic${m.clinics.dormant + m.clinics.atRisk === 1 ? "" : "s"} losing engagement`,
      detail: `${m.clinics.dormant} dormant, ${m.clinics.atRisk} at risk${names ? ` — e.g. ${names}` : ""}. A call or a training session usually brings them back.`, href: "/admin/facilities", action: "Review clinics", weight: 70 });
  }
  if (m.subscriptions.expired > 0) add({ id: "subs-expired", severity: "critical", title: `${m.subscriptions.expired} subscription${m.subscriptions.expired === 1 ? "" : "s"} expired`, detail: "These clinics are on an expired plan — renew or follow up.", href: "/admin/facilities", action: "Clinics", weight: 85 });
  if (m.subscriptions.expiringSoon > 0) add({ id: "subs-soon", severity: "warning", title: `${m.subscriptions.expiringSoon} plan${m.subscriptions.expiringSoon === 1 ? "" : "s"} end within 14 days`, detail: "Reach out before they lapse.", href: "/admin/facilities", action: "Clinics", weight: 65 });

  // ---- Clinical journey
  const start = m.funnel[0]?.count ?? 0;
  if (start >= 5) {
    let worst: { label: string; drop: number; from: string } | null = null;
    for (let i = 1; i < m.funnel.length; i++) {
      const a = m.funnel[i - 1], b = m.funnel[i];
      const drop = a.count ? (a.count - b.count) / a.count : 0;
      if (!worst || drop > worst.drop) worst = { label: b.label, drop, from: a.label };
    }
    if (worst && worst.drop >= 0.3) add({ id: "funnel", severity: "warning", title: `Biggest drop-off: ${worst.from} → ${worst.label}`, detail: `${Math.round(worst.drop * 100)}% of visits stop before ${worst.label.toLowerCase()}. Guidance or a tour on that step may help.`, href: "/admin/guidance", action: "Guidance", weight: 62 });
    const done = m.funnel.at(-1)?.count ?? 0;
    add({ id: "completion", severity: done / start >= 0.6 ? "positive" : "info", title: `${Math.round((done / start) * 100)}% of visits reached a finalised dossier`, detail: `${done} of ${start} visits in ${period} went all the way to Stage 5.`, weight: 35 });
  }

  // ---- Safety
  const rf = pct(m.referrals.now, m.referrals.prev);
  if (m.referrals.now >= 3 && rf !== null && rf >= 50) add({ id: "referrals-up", severity: "warning", title: `Emergency referrals up ${rf}%`, detail: `${m.referrals.now} referrals in ${period} (${m.referrals.prev} before). Worth a look at the warning-sign screens.`, href: "/admin/screening", action: "Screening", weight: 72 });
  if (m.amaDeclines > 0) add({ id: "ama", severity: "info", title: `${m.amaDeclines} referral${m.amaDeclines === 1 ? "" : "s"} declined by families`, detail: "Patients who continued local treatment against advice — reasons are recorded per visit.", href: "/admin/screening", action: "Screening", weight: 40 });
  if (m.complaintsRising.length) {
    const c = m.complaintsRising[0];
    add({ id: "complaint-rise", severity: "info", title: `${c.label} cases rising`, detail: `${c.now} in ${period} against ${c.prev} before${m.complaintsRising[1] ? `; also ${m.complaintsRising[1].label}` : ""}.`, weight: 42 });
  }

  // ---- Money & security
  if (m.refunds.count > 0) add({ id: "refunds", severity: m.refunds.amount > 0.1 * Math.max(1, m.revenue.now) ? "warning" : "info", title: `${inr(m.refunds.amount)} refunded in ${m.refunds.count} payment${m.refunds.count === 1 ? "" : "s"}`, detail: "Refund reasons are recorded on each payment.", href: "/admin/payments", action: "Payments", weight: 48 });
  if (m.failedLogins.now >= 10 && m.failedLogins.now >= 2 * Math.max(1, m.failedLogins.prev)) add({ id: "logins", severity: "critical", title: `Failed sign-ins jumped to ${m.failedLogins.now}`, detail: `Against ${m.failedLogins.prev} in the previous period — check for password guessing.`, href: "/admin/history/clinics", action: "Sign-in history", weight: 90 });
  if (m.notificationFailures > 0) add({ id: "email", severity: "warning", title: `${m.notificationFailures} email${m.notificationFailures === 1 ? "" : "s"} failed to send`, detail: "Check the email settings and the failed recipients.", href: "/admin/notifications", action: "Notifications", weight: 60 });

  // ---- Catalogue & content
  if (m.catalogue.safetyUnverified > 0) add({ id: "safety-review", severity: "warning", title: `${m.catalogue.safetyUnverified} medicine safety notes await a physician`, detail: "Pregnancy, children, interaction and contraindication notes are shown to doctors as Unverified until reviewed.", href: "/admin/meta/supplements", action: "Review", weight: 64 });
  if (m.catalogue.amrazUnverified > 0) add({ id: "amraz-review", severity: "info", title: `${m.catalogue.amrazUnverified} disease entries unverified`, detail: "The differential diagnosis marks them Unverified until a physician approves them.", href: "/admin/meta/tashkhees?tab=amraz", action: "Review", weight: 50 });
  if (m.catalogue.usoolDrafts > 0) add({ id: "usool", severity: "info", title: `${m.catalogue.usoolDrafts} treatment principles in draft`, detail: "Doctors only see approved principles.", href: "/admin/meta/tashkhees?tab=usool", action: "Review", weight: 38 });
  const weakLang = m.translations.filter((t) => t.coverage < 95).sort((a, b) => a.coverage - b.coverage)[0];
  if (weakLang) add({ id: "translations", severity: "info", title: `${weakLang.language} translation at ${weakLang.coverage}%`, detail: "Untranslated texts fall back to English for clinics using that language.", href: "/admin/languages", action: "Languages", weight: 33 });

  // ---- Operations
  if (m.busiest) add({ id: "busiest", severity: "info", title: `Busiest time: ${m.busiest.day} around ${hour12(m.busiest.hour)}`, detail: "Plan support and deployments outside this window.", weight: 25 });
  if (!m.aiOn) add({ id: "ai-off", severity: "info", title: "AI services are off", detail: "As you chose — these insights are computed on the server at no cost. Switch AI on in Settings when you want it.", href: "/admin/settings", action: "Settings", weight: 10 });

  const rank: Record<InsightSeverity, number> = { critical: 3, warning: 2, positive: 1, info: 0 };
  return out.sort((a, b) => rank[b.severity] - rank[a.severity] || b.weight - a.weight);
}

/** 0–100 platform health from engagement, clinical completion, safety follow-up and data quality. */
export function platformHealth(i: { clinicsTotal: number; clinicsHealthy: number; completion: number; catalogueCompleteness: number; criticalCount: number }) {
  const engagement = i.clinicsTotal ? (i.clinicsHealthy / i.clinicsTotal) * 40 : 0;
  const clinical = Math.min(1, i.completion) * 30;
  const data = Math.min(100, i.catalogueCompleteness) / 100 * 20;
  const safety = Math.max(0, 10 - i.criticalCount * 5);
  return Math.round(engagement + clinical + data + safety);
}
