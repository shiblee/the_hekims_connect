import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInsights, forecastNext, platformHealth, slope, type InsightInput } from "../src/lib/admin-insights";

const base: InsightInput = {
  days: 30, visits: { now: 50, prev: 50 }, patientsNew: { now: 10, prev: 10 }, revenue: { now: 1000, prev: 1000 }, referrals: { now: 0, prev: 0 },
  amaDeclines: 0, dailyVisits: [], clinics: { total: 4, dormant: 0, atRisk: 0, inactiveNames: [] }, subscriptions: { expiringSoon: 0, expired: 0 },
  funnel: [], refunds: { count: 0, amount: 0 }, failedLogins: { now: 0, prev: 0 }, notificationFailures: 0,
  catalogue: { amrazUnverified: 0, safetyUnverified: 0, usoolDrafts: 0, avgCompleteness: 90 }, translations: [], complaintsRising: [], busiest: null, aiOn: true,
};

test("slope and damped forecast", () => {
  assert.equal(slope([1, 2, 3, 4]), 1);
  assert.equal(forecastNext([2, 2, 2, 2]), 8);
  const f = forecastNext([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(f <= Math.round(45 * 1.5) && f >= 45, `forecast ${f} stays within bounds`);
  assert.equal(forecastNext([]), 0);
});

test("quiet platform gives no alarms", () => {
  const out = buildInsights(base);
  assert.ok(!out.some((i) => i.severity === "critical" || i.severity === "warning"));
});

test("drops, expiries and security rank first", () => {
  const out = buildInsights({ ...base, visits: { now: 20, prev: 50 }, subscriptions: { expiringSoon: 1, expired: 2 }, failedLogins: { now: 30, prev: 2 } });
  assert.equal(out[0].severity, "critical");
  assert.ok(out.some((i) => i.id === "visits-down"));
  assert.ok(out.some((i) => i.id === "subs-soon"));
  const order = out.map((i) => i.severity);
  const rank = { critical: 3, warning: 2, positive: 1, info: 0 } as const;
  for (let i = 1; i < order.length; i++) assert.ok(rank[order[i - 1]] >= rank[order[i]]);
});

test("funnel finds the biggest drop-off", () => {
  const out = buildInsights({ ...base, funnel: [{ key: "a", label: "Registered", count: 100 }, { key: "b", label: "Vitals", count: 90 }, { key: "c", label: "Dossier", count: 20 }] });
  const f = out.find((i) => i.id === "funnel");
  assert.ok(f && f.title.includes("Vitals → Dossier"));
});

test("AI-off note appears only when AI is off", () => {
  assert.ok(!buildInsights(base).some((i) => i.id === "ai-off"));
  assert.ok(buildInsights({ ...base, aiOn: false }).some((i) => i.id === "ai-off"));
});

test("platform health stays within 0–100", () => {
  assert.equal(platformHealth({ clinicsTotal: 0, clinicsHealthy: 0, completion: 0, catalogueCompleteness: 0, criticalCount: 5 }), 0);
  assert.equal(platformHealth({ clinicsTotal: 10, clinicsHealthy: 10, completion: 1, catalogueCompleteness: 100, criticalCount: 0 }), 100);
});
