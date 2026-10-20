// Stage 5 Usool-e-Ilaj engine — suggests a step-by-step treatment plan (the
// principles of treatment) from the diagnosis (Su-e-Mizaj quality, Sada/Maddi,
// Darja, affected organs) and what's recorded for the visit. Principles are
// admin-managed (Admin → Meta → Tashkhees & Ilaj → Usool-e-Ilaj): each has
// conditions, a step in the classical order, a priority and cautions. The
// engine only chooses among approved principles; anything that hits a caution
// is shown separately with the reason and never pre-selected. The Hakim decides.

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { buildDalailContext } from "@/lib/dalail-engine";
import { runTashkheesEngine } from "@/lib/tashkhees-engine";
import { rankUsoolPrinciples } from "@/lib/gemini";

export const PHASES = [
  { n: 1, label: "Remove the cause", local: "Izala-e-Sabab" },
  { n: 2, label: "Concoction", local: "Nuzj" },
  { n: 3, label: "Evacuation", local: "Istifragh" },
  { n: 4, label: "Correct the temperament", local: "Tadeel-e-Mizaj" },
  { n: 5, label: "Strengthen the organs", local: "Taqwiyat" },
  { n: 6, label: "Relieve symptoms", local: "Ilaj-e-Alamati" },
] as const;

export interface UsoolRule {
  always?: boolean;
  mizaj?: string[]; // Su-e-Mizaj qualities, e.g. "Safrawi", "Haar"
  type?: "Sada" | "Maddi";
  minDarja?: number;
  organs?: string[]; // organ labels; ["*"] = any organ recorded
  categories?: string[];
  complaints?: string[];
  symptoms?: string[];
  regions?: string[];
  sex?: "male" | "female";
  marz?: string[]; // Amraz catalogue keys — matches the working / secondary diagnosis
  phase?: number;
  avoidIf?: string[]; // findings / symptoms / regions / categories that call for caution
  cautionBelowAge?: number;
  cautionAboveAge?: number;
}
export const parseRule = (raw: string | null | undefined): UsoolRule => { try { return JSON.parse(raw || "{}") || {}; } catch { return {}; } };

export interface UsoolConfig { maxPrinciples: number; ranking: boolean }
export const DEFAULT_USOOL_CONFIG: UsoolConfig = { maxPrinciples: 6, ranking: true };
export async function getUsoolConfig(): Promise<UsoolConfig> {
  const row = await db.portalSetting.findUnique({ where: { category_key: { category: "usool_engine", key: "config" } } }).catch(() => null);
  try { return { ...DEFAULT_USOOL_CONFIG, ...JSON.parse(row?.value || "{}") }; } catch { return DEFAULT_USOOL_CONFIG; }
}

export interface PlanItem { label: string; localName: string | null; description: string | null; phase: number; reason: string; score: number; caution?: string }
export interface UsoolPlan {
  basis: { suMizaj: string | null; type: string | null; darja: number | null; organs: string[]; fromEngine: boolean; marz?: string[]; sabab?: string[] };
  plan: PlanItem[];
  cautions: PlanItem[];
  insufficient: string[];
}

const norm = (s: string) => s.trim().toLowerCase();

/** Runs the engine for a visit. Diagnosis comes from the saved dossier; if not yet recorded, from the Tashkhees engine's suggestion. */
export async function runUsoolEngine(visitId: string, facilityId: string) {
  const started = Date.now();
  const [ctx, visit, cfg, principles] = await Promise.all([
    buildDalailContext(visitId, facilityId),
    db.visit.findFirst({
      where: { id: visitId, facilityId },
      select: {
        tashkheesDossier: { select: { suMizajQuality: true, suMizajType: true, suMizajGrade: true, organs: true, sabab: true, diagnoses: { where: { role: { in: ["working", "secondary"] } }, select: { label: true, marz: { select: { key: true, organs: true } } } } } },
        asbabAssessments: { select: { responses: { select: { selectedOptions: true } } } },
      },
    }),
    getUsoolConfig(),
    db.tashkheesOption.findMany({ where: { list: "usool", active: true, reviewStatus: "approved" }, orderBy: { sortOrder: "asc" }, select: { label: true, localName: true, description: true, appliesTo: true, priority: true } }),
  ]);
  if (!ctx || !visit) return null;

  // ---- Basis: the recorded diagnosis, else the Tashkhees engine's suggestion
  const dos = visit.tashkheesDossier;
  let organs: string[] = [];
  try { organs = JSON.parse(dos?.organs || "[]"); } catch { organs = []; }
  let basis: UsoolPlan["basis"] = { suMizaj: dos?.suMizajQuality ?? null, type: dos?.suMizajType ?? null, darja: dos?.suMizajGrade ?? null, organs, fromEngine: false };
  if (!basis.suMizaj) {
    const t = await runTashkheesEngine(visitId, facilityId).catch(() => null);
    const su = t?.suggestion.suMizaj;
    if (su?.label) basis = { suMizaj: su.label, type: su.type, darja: su.darja, organs: organs.length ? organs : t!.suggestion.organs.map((o) => o.label), fromEngine: true };
  }
  // The confirmed disease and its causes shape the plan too: its organs join the basis when none are chosen.
  const dx = dos?.diagnoses ?? [];
  const marzKeys = dx.map((d) => d.marz?.key).filter(Boolean) as string[];
  let sabab: string[] = [];
  try { sabab = JSON.parse(dos?.sabab || "[]"); } catch { sabab = []; }
  if (!basis.organs.length) { const o = [...new Set(dx.flatMap((d) => { try { return JSON.parse(d.marz?.organs || "[]") as string[]; } catch { return []; } }))]; if (o.length) basis = { ...basis, organs: o }; }
  basis = { ...basis, marz: dx.map((d) => d.label), sabab };

  // ---- Signals for cautions: answered findings, symptoms, regions, complaint categories
  const answered = visit.asbabAssessments.flatMap((a) => a.responses.flatMap((r) => {
    try { return (JSON.parse(r.selectedOptions || "[]") as { label: string }[]).map((o) => o.label); } catch { return []; }
  }));
  const signals = new Set([...answered, ...ctx.symptoms, ...ctx.regions.map((r) => r.label), ...ctx.complaints.map((c) => c.category || ""), ...ctx.complaints.map((c) => c.label)].filter(Boolean).map(norm));

  const cats = new Set(ctx.complaints.map((c) => norm(c.category || "")));
  const syms = new Set(ctx.symptoms.map(norm));
  const regs = new Set(ctx.regions.map((r) => norm(r.label)));
  const orgs = new Set(basis.organs.map(norm));

  const scored: PlanItem[] = [];
  for (const p of principles) {
    const r = parseRule(p.appliesTo);
    if (r.sex && ctx.sex && r.sex !== ctx.sex) continue;
    // Hard conditions: a principle written for Maddi (or Sada) needs that type; minimum Darja.
    if (r.type && basis.type && r.type !== basis.type) continue;
    if (r.type && !basis.type) continue;
    if (r.minDarja && (basis.darja ?? 0) < r.minDarja) continue;
    // A balanced (Mu'tadil) picture needs no temperament correction.
    if (basis.suMizaj === "Mu'tadil" && (r.phase === 4 || r.mizaj?.length)) continue;
    let score = 0;
    const why: string[] = [];
    if (r.mizaj?.length) {
      if (basis.suMizaj && r.mizaj.some((m) => norm(m) === norm(basis.suMizaj!))) { score += 6; why.push(basis.suMizaj); }
      else continue; // written for other temperaments
    }
    if (r.type) { score += 3; why.push(r.type); }
    if (r.organs?.length) {
      const hits = r.organs.includes("*") ? basis.organs : r.organs.filter((o) => orgs.has(norm(o)));
      if (hits.length) { score += 3 + hits.length; why.push(...hits.slice(0, 2)); }
    }
    const catHits = (r.categories || []).filter((c) => cats.has(norm(c)));
    if (catHits.length) { score += 3; why.push(catHits[0]); }
    const marzHit = (r.marz || []).find((k) => marzKeys.includes(k));
    if (marzHit) { score += 6; why.push(dx.find((d) => d.marz?.key === marzHit)!.label); }
    const compHits = ctx.complaints.filter((c) => c.key && (r.complaints || []).includes(c.key)).map((c) => c.label);
    if (compHits.length) { score += 5; why.push(compHits[0]); }
    const symHits = (r.symptoms || []).filter((s) => syms.has(norm(s)));
    if (symHits.length) { score += 2 + symHits.length; why.push(symHits[0]); }
    const regHits = (r.regions || []).filter((x) => regs.has(norm(x)));
    if (regHits.length) { score += 2; why.push(regHits[0]); }
    const matched = score > 0;
    if (!matched && !r.always) continue;
    if (r.always) score += 2;
    score += (p.priority || 3) * 1.5;

    // Cautions
    const hit = (r.avoidIf || []).find((x) => signals.has(norm(x)));
    let caution: string | undefined;
    if (hit) caution = `Caution — ${hit} is recorded`;
    else if (r.cautionBelowAge != null && ctx.age != null && ctx.age < r.cautionBelowAge) caution = `Caution — patient is under ${r.cautionBelowAge}`;
    else if (r.cautionAboveAge != null && ctx.age != null && ctx.age > r.cautionAboveAge) caution = `Caution — patient is over ${r.cautionAboveAge}`;

    scored.push({
      label: p.label, localName: p.localName, description: p.description, phase: r.phase || 6, score,
      reason: (matched ? `For ${[...new Set(why)].slice(0, 3).join(" · ")}` : "Foundation of every plan") + ((r.phase || 6) === 1 && sabab.length ? ` — recorded Sabab: ${sabab.slice(0, 3).join(", ")}` : ""),
      caution,
    });
  }

  const ok = scored.filter((x) => !x.caution).sort((a, b) => b.score - a.score);
  const cautions = scored.filter((x) => x.caution).sort((a, b) => b.score - a.score).slice(0, 4);
  // Foundation principles (marked "every plan") always lead — up to two of them —
  // then the most relevant of the rest fill the remaining places.
  const foundation = ok.filter((x) => x.reason === "Foundation of every plan" || principles.find((p) => p.label === x.label && parseRule(p.appliesTo).always)).slice(0, 2);
  const restOk = ok.filter((x) => !foundation.includes(x));
  let picked = [...foundation, ...restOk.slice(0, Math.max(0, cfg.maxPrinciples - foundation.length))];
  let method: "rules" | "ranked" | "rules-fallback" = "rules";

  if (cfg.ranking && restOk.length > cfg.maxPrinciples - foundation.length) {
    const ranked = await Promise.race([
      rankUsoolPrinciples(
        { complaints: ctx.complaints.map((c) => c.label), symptoms: ctx.symptoms, suMizaj: basis.suMizaj, type: basis.type, darja: basis.darja, organs: basis.organs },
        restOk.slice(0, 15).map((x) => ({ id: x.label, label: `${x.label}${x.description ? ` — ${x.description}` : ""}` })),
        Math.max(1, cfg.maxPrinciples - foundation.length),
      ).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 8000)),
    ]);
    const valid = (ranked || []).filter((id) => restOk.some((x) => x.label === id));
    if (valid.length) { picked = [...foundation, ...[...new Set(valid)].map((id) => restOk.find((x) => x.label === id)!)].slice(0, cfg.maxPrinciples); method = "ranked"; }
    else method = "rules-fallback";
  }

  const insufficient: string[] = [];
  if (!basis.suMizaj) insufficient.push("No Su-e-Mizaj yet — record the diagnosis (or the examination) for a firmer plan.");
  if (!principles.length) insufficient.push("No approved principles yet — approve them in Admin → Tashkhees & Ilaj → Usool-e-Ilaj.");

  const plan: UsoolPlan = { basis, plan: picked.sort((a, b) => a.phase - b.phase || b.score - a.score), cautions, insufficient };
  const hash = (v: unknown) => createHash("sha1").update(JSON.stringify(v)).digest("hex").slice(0, 16);
  return { plan, method, contextHash: hash({ basis, ctx, answered }), configVersion: hash({ cfg, principles }), latencyMs: Date.now() - started };
}
