import type { UsoolRule } from "@/lib/usool-engine";

const list = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()))].slice(0, 100) : []);
const age = (v: unknown) => { const n = Number(v); return v !== "" && v != null && Number.isFinite(n) && n >= 0 && n <= 120 ? Math.round(n) : undefined; };

/** Validates a Usool-e-Ilaj principle's conditions from the admin editor. */
export function cleanUsoolRule(r: any): UsoolRule {
  const out: UsoolRule = {};
  if (!r || typeof r !== "object") return out;
  if (r.always) out.always = true;
  for (const k of ["mizaj", "organs", "categories", "complaints", "symptoms", "regions", "avoidIf", "marz"] as const) { const l = list(r[k]); if (l.length) out[k] = l; }
  if (r.type === "Sada" || r.type === "Maddi") out.type = r.type;
  const d = Number(r.minDarja); if (Number.isFinite(d) && d >= 1 && d <= 4) out.minDarja = Math.round(d);
  if (r.sex === "male" || r.sex === "female") out.sex = r.sex;
  const p = Number(r.phase); if (Number.isFinite(p) && p >= 1 && p <= 6) out.phase = Math.round(p);
  const below = age(r.cautionBelowAge); if (below != null) out.cautionBelowAge = below;
  const above = age(r.cautionAboveAge); if (above != null) out.cautionAboveAge = above;
  return out;
}
