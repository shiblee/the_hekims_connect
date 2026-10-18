// Stage 5 Ilaj-bil-Ghiza (diet) engine — sorts the approved foods into
// Recommended and Parhez (avoid) for the patient, each with plain reasons.
//
//   • Temperament (Ilaj bil Zid): foods opposite to the present dyscrasia
//     (Su-e-Mizaj) are favoured, foods of the same quality are avoided —
//     scaled by the food's degree.
//   • History: conditions recognised in the patient's recorded chronic
//     conditions / medical history / medicines (diabetes, high BP, kidney
//     stones, gout, acidity …) — each food says which it suits or must avoid.
//   • Today: the visit's complaints and other symptoms, affected organs.
//   • Allergies: a food matching a recorded allergy is always Parhez.
//   • Digestion: heavy (Ghaleez) or wind-forming (Nafakh) foods are avoided
//     when digestion is weak or there's bloating.
//
// The engine never writes foods — it only sorts the admin's approved list.
// Food data is managed in Admin → Meta → Tashkhees & Ilaj → Ghiza (Foods).

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { buildDalailContext } from "@/lib/dalail-engine";
import { runTashkheesEngine } from "@/lib/tashkhees-engine";
import { CONDITIONS, conditionLabel, conditionsIn } from "@/lib/ghiza-conditions";
import type { GhizaRule } from "@/lib/ghiza-seed";
import { rankGhizaFoods } from "@/lib/gemini";

export interface GhizaConfig { maxRecommended: number; maxAvoid: number; ranking: boolean }
export const DEFAULT_GHIZA_CONFIG: GhizaConfig = { maxRecommended: 8, maxAvoid: 8, ranking: true };
export async function getGhizaConfig(): Promise<GhizaConfig> {
  const row = await db.portalSetting.findUnique({ where: { category_key: { category: "ghiza_engine", key: "config" } } }).catch(() => null);
  try { return { ...DEFAULT_GHIZA_CONFIG, ...JSON.parse(row?.value || "{}") }; } catch { return DEFAULT_GHIZA_CONFIG; }
}

export const parseGhizaRule = (raw: string | null | undefined): GhizaRule => { try { return JSON.parse(raw || "{}") || {}; } catch { return {}; } };

/** "Barid-Ratab 2" → { hot: -1, moist: 1, degree: 2 }. */
export function parseFoodMizaj(m: string | null | undefined): { hot: number; moist: number; degree: number } {
  const s = (m || "").toLowerCase();
  const hot = /haar|hot/.test(s) ? 1 : /barid|cold/.test(s) ? -1 : 0;
  const moist = /ratab|moist/.test(s) ? 1 : /yabis|dry/.test(s) ? -1 : 0;
  const d = Number((s.match(/[1-4]/) || ["1"])[0]);
  return { hot, moist, degree: d };
}
/** Axes of the patient's present dyscrasia. */
const DYSCRASIA: Record<string, { hot: number; moist: number }> = {
  Safrawi: { hot: 1, moist: -1 }, Damawi: { hot: 1, moist: 1 }, Balghami: { hot: -1, moist: 1 }, Saudawi: { hot: -1, moist: -1 },
  Haar: { hot: 1, moist: 0 }, Barid: { hot: -1, moist: 0 }, Ratab: { hot: 0, moist: 1 }, Yabis: { hot: 0, moist: -1 },
};
const QUALITY: Record<string, string> = { "1,0": "warming", "-1,0": "cooling", "0,1": "moistening", "0,-1": "drying" };
const describe = (hot: number, moist: number) => [hot ? QUALITY[`${hot},0`] : null, moist ? QUALITY[`0,${moist}`] : null].filter(Boolean).join(" & ");

export interface FoodPick { label: string; imageUrl: string | null; imageCredit: string | null; category: string | null; foodMizaj: string | null; score: number; reasons: string[]; hard?: boolean }
export interface GhizaPlan {
  basis: { suMizaj: string | null; fromEngine: boolean; conditions: string[]; allergies: string[] };
  recommended: FoodPick[];
  avoid: FoodPick[];
  insufficient: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

export async function runGhizaEngine(visitId: string, facilityId: string) {
  const started = Date.now();
  const [ctx, visit, cfg, foods] = await Promise.all([
    buildDalailContext(visitId, facilityId),
    db.visit.findFirst({
      where: { id: visitId, facilityId },
      select: {
        tashkheesDossier: { select: { suMizajQuality: true, organs: true } },
        intake: { select: { allergies: true, medications: true } },
        patient: { select: { chronicConditions: true, medicalHistory: true, allergies: true, currentMedications: true, familyHistory: true } },
      },
    }),
    getGhizaConfig(),
    db.tashkheesOption.findMany({ where: { list: "ghiza", active: true, reviewStatus: "approved" }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!ctx || !visit) return null;

  // ---- Present dyscrasia: recorded, else the Tashkhees engine's suggestion
  let suMizaj = visit.tashkheesDossier?.suMizajQuality ?? null;
  let fromEngine = false;
  let organs: string[] = [];
  try { organs = JSON.parse(visit.tashkheesDossier?.organs || "[]"); } catch { organs = []; }
  if (!suMizaj) {
    const t = await runTashkheesEngine(visitId, facilityId).catch(() => null);
    if (t?.suggestion.suMizaj?.label) { suMizaj = t.suggestion.suMizaj.label; fromEngine = true; }
    if (!organs.length && t) organs = t.suggestion.organs.map((o) => o.label);
  }
  const axes = suMizaj ? DYSCRASIA[suMizaj] : undefined;

  // ---- History → conditions; allergies
  const p = visit.patient;
  let intakeAllergies: string[] = [];
  let intakeMeds: string[] = [];
  try { intakeAllergies = JSON.parse(visit.intake?.allergies || "[]"); } catch { /* none */ }
  try { intakeMeds = (JSON.parse(visit.intake?.medications || "[]") as { label: string }[]).map((m) => m.label); } catch { /* none */ }
  const historyText = [p?.chronicConditions, p?.medicalHistory, p?.currentMedications, ...intakeMeds, ...ctx.complaints.map((c) => c.label)].filter(Boolean).join(" ; ");
  const conditions = conditionsIn(historyText);
  const allergyText = [p?.allergies, ...intakeAllergies].filter(Boolean).join(" ; ").toLowerCase();
  const allergies = [...new Set(intakeAllergies.concat(p?.allergies ? p.allergies.split(/[,;]/).map((x) => x.trim()) : []).filter((a) => a && !/^none/i.test(a)))];

  // ---- Today's picture
  const today = [...ctx.symptoms, ...ctx.complaints.map((c) => c.label)].map(norm);
  const todayRaw = [...ctx.symptoms, ...ctx.complaints.map((c) => c.label)];
  const has = (kw: string) => today.some((t) => t.includes(norm(kw)));
  /** The patient's own wording for a matched keyword (e.g. "constipat" → "Constipation (Qabz)"). */
  const term = (kw: string) => todayRaw.find((t) => norm(t).includes(norm(kw))) ?? kw;
  const cats = new Set(ctx.complaints.map((c) => norm(c.category || "")));
  const orgs = new Set(organs.map(norm));
  const weakDigestion = has("indigestion") || has("appetite") || orgs.has("meda") || conditions.includes("obesity");
  const bloating = has("bloat") || has("gas") || conditions.includes("ibs");

  const picks: FoodPick[] = [];
  for (const f of foods) {
    const r = parseGhizaRule(f.appliesTo);
    let score = 0;
    const good: string[] = [];
    const bad: string[] = [];
    let hard = false;

    // Allergy — always Parhez
    const allergen = (r.allergens || []).find((a) => {
      const key = norm(a.split(/[(/]/)[0]);
      return key.length > 2 && allergyText.includes(key);
    });
    if (allergen) { hard = true; bad.push(`Allergy recorded: ${allergen}`); score -= 100; }

    // Temperament by opposites
    if (axes && f.foodMizaj) {
      const fm = parseFoodMizaj(f.foodMizaj);
      const t = -(fm.hot * axes.hot + fm.moist * axes.moist) * fm.degree;
      // Spices are taken in small amounts — their benefit counts half; benefit is capped so a
      // strong (3rd-degree) item never outranks an everyday food. Harm counts in full.
      const spice = f.category === "Spices";
      if (t > 0) { score += Math.min(2 * t, 6) * (spice ? 0.5 : 1); good.push(`${describe(fm.hot, fm.moist) || "balancing"} — balances ${suMizaj}`); }
      else if (t < 0) { score += 2 * t; bad.push(`${describe(fm.hot, fm.moist)} — adds to ${suMizaj}`); }
    }

    // History conditions
    for (const c of r.good?.conditions || []) if (conditions.includes(c)) { score += 4; good.push(`good in ${conditionLabel(c).toLowerCase()}`); }
    for (const c of r.avoid?.conditions || []) if (conditions.includes(c)) { score -= 6; bad.push(`not suitable with ${conditionLabel(c).toLowerCase()}`); }

    // Today's symptoms / categories / organs
    const gs = (r.good?.symptoms || []).filter(has);
    if (gs.length) { score += 2 + gs.length; good.push(`helps ${[...new Set(gs.map(term))].slice(0, 2).join(", ")}`); }
    const bs = (r.avoid?.symptoms || []).filter(has);
    if (bs.length) { score -= 3 + bs.length; bad.push(`worsens ${[...new Set(bs.map(term))].slice(0, 2).join(", ")}`); }
    if ((r.good?.categories || []).some((c) => cats.has(norm(c)))) score += 2;
    if ((r.avoid?.categories || []).some((c) => cats.has(norm(c)))) score -= 2;
    if ((r.good?.organs || []).some((o) => orgs.has(norm(o)))) { score += 2; good.push("supports the affected organ"); }
    if ((r.avoid?.organs || []).some((o) => orgs.has(norm(o)))) { score -= 3; bad.push("burdens the affected organ"); }

    // Digestion
    if (r.heavy && weakDigestion) { score -= 3; bad.push("heavy (Ghaleez) for weak digestion"); }
    if (r.nafakh && bloating) { score -= 3; bad.push("wind-forming (Nafakh)"); }

    picks.push({
      label: f.label, imageUrl: f.imageUrl, imageCredit: f.imageCredit, category: f.category, foodMizaj: f.foodMizaj,
      score: Math.round(score * 10) / 10, reasons: score >= 0 ? good : bad, hard,
    });
  }

  // Varied list: at most two foods from any one food group.
  const perGroup = new Map<string, number>();
  let recommended = picks.filter((x) => !x.hard && x.score >= 3).sort((a, b) => b.score - a.score).filter((x) => {
    const g = x.category || "Other";
    const n = perGroup.get(g) ?? 0;
    if (n >= 2) return false;
    perGroup.set(g, n + 1);
    return true;
  });
  // Allergy items are always listed, on top of the usual Parhez list.
  const avoid = [
    ...picks.filter((x) => x.hard),
    ...picks.filter((x) => !x.hard && x.score <= -3).sort((a, b) => a.score - b.score).slice(0, cfg.maxAvoid),
  ];
  let method: "rules" | "ranked" | "rules-fallback" = "rules";
  if (cfg.ranking && recommended.length > cfg.maxRecommended) {
    const ranked = await Promise.race([
      rankGhizaFoods(
        { complaints: ctx.complaints.map((c) => c.label), symptoms: ctx.symptoms, suMizaj, conditions: conditions.map(conditionLabel) },
        recommended.slice(0, 20).map((x) => ({ id: x.label, label: `${x.label}${x.foodMizaj ? ` (${x.foodMizaj})` : ""}` })),
        cfg.maxRecommended,
      ).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    const valid = (ranked || []).filter((id) => recommended.some((x) => x.label === id));
    if (valid.length) { recommended = [...new Set(valid)].map((id) => recommended.find((x) => x.label === id)!); method = "ranked"; }
    else method = "rules-fallback";
  }
  recommended = recommended.slice(0, cfg.maxRecommended);

  const insufficient: string[] = [];
  if (!suMizaj) insufficient.push("No Su-e-Mizaj yet — temperament-based advice will appear once the diagnosis (or examination) is recorded.");
  if (!foods.length) insufficient.push("No approved foods yet — approve them in Admin → Tashkhees & Ilaj → Ghiza (Foods).");

  const plan: GhizaPlan = { basis: { suMizaj, fromEngine, conditions: conditions.map(conditionLabel), allergies }, recommended, avoid, insufficient };
  const hash = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 16);
  return { plan, method, contextHash: hash({ suMizaj, conditions, allergies, today, organs }), configVersion: hash({ cfg, n: foods.length, u: foods.map((f) => f.updatedAt) }), latencyMs: Date.now() - started };
}

export { CONDITIONS };
