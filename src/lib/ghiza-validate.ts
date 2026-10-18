import type { GhizaRule, FoodSide } from "@/lib/ghiza-seed";
import { CONDITIONS } from "@/lib/ghiza-conditions";

const list = (v: unknown, max = 60) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()))].slice(0, max) : []);
const KEYS = new Set<string>(CONDITIONS.map((c) => c.key));
function side(v: any): FoodSide | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: FoodSide = {};
  const s = list(v.symptoms); if (s.length) out.symptoms = s;
  const c = list(v.conditions).filter((k) => KEYS.has(k)) as FoodSide["conditions"]; if (c && c.length) out.conditions = c;
  const g = list(v.categories); if (g.length) out.categories = g;
  const o = list(v.organs); if (o.length) out.organs = o;
  return Object.keys(out).length ? out : undefined;
}
/** Validates a food's rule from the admin editor. */
export function cleanGhizaRule(r: any): GhizaRule {
  const out: GhizaRule = {};
  if (!r || typeof r !== "object") return out;
  const g = side(r.good); if (g) out.good = g;
  const a = side(r.avoid); if (a) out.avoid = a;
  const al = list(r.allergens); if (al.length) out.allergens = al;
  if (r.heavy) out.heavy = true;
  if (r.nafakh) out.nafakh = true;
  return out;
}
/** "Barid-Ratab 2" style temperament from parts. */
export function foodMizajOf(hot: unknown, moist: unknown, degree: unknown): string | null {
  const h = hot === "Haar" || hot === "Barid" ? hot : null;
  const m = moist === "Ratab" || moist === "Yabis" ? moist : null;
  if (!h && !m) return "Mu'tadil";
  const d = Math.max(1, Math.min(4, Math.round(Number(degree) || 1)));
  return `${[h, m].filter(Boolean).join("-")} ${d}`;
}
const okUrl = (u: unknown) => typeof u === "string" && (/^\/foods\/[\w.-]+$/.test(u) || /^https:\/\/upload\.wikimedia\.org\//.test(u)) ? u : null;
export const cleanImage = (b: any) => ({
  imageUrl: okUrl(b.imageUrl),
  imageCredit: typeof b.imageCredit === "string" ? b.imageCredit.trim().slice(0, 200) || null : null,
  imageSource: typeof b.imageSource === "string" && /^https:\/\/commons\.wikimedia\.org\//.test(b.imageSource) ? b.imageSource : null,
});
