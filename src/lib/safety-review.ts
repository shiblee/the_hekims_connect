// Stage 5 safety review — everything that must be seen before a dossier is
// finalised, in one list. High items block finalising until the Hakim records a
// reason for continuing (an acknowledgement); nothing here can be cleared by
// the engines or AI.
//
//   • case alerts: declined referral, warning signs, abnormal vitals, critical
//     reports, pregnancy / breastfeeding
//   • medicine warnings for the dossier's medicine lines (shared safety module)
//   • facts a safe prescription needs: allergies, pregnancy status, current medicines
//   • serious alternatives ("don't miss") for the working diagnosis — a checklist

import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { buildCaseContext } from "@/lib/case-context";
import { checkMedicines, loadPatientSafety } from "@/lib/medicine-safety";

export interface SafetyItem {
  key: string; level: "high" | "caution" | "info";
  kind: "case" | "medicine" | "missing" | "dontmiss";
  // case alerts are translated on screen from their key + params; the rest carry their text
  alertKey?: string; params?: Record<string, string | number>; text?: string; medicine?: string; why?: string;
  ack?: { reason: string; byName: string | null; at: string } | null;
}
export interface SafetyReview { items: SafetyItem[]; blocking: number }

const short = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 10);

/** `lines` overrides the saved medicine lines (used while saving, before they're stored). */
export async function computeSafetyReview(visitId: string, facilityId: string, lines?: { tagId: string | null; name: string }[]): Promise<SafetyReview | null> {
  const ctx = await buildCaseContext(visitId, facilityId);
  if (!ctx) return null;
  const dossier = await db.tashkheesDossier.findUnique({
    where: { visitId },
    select: { prescriptions: { select: { tagId: true, name: true } }, diagnoses: { where: { role: { in: ["working", "secondary"] } }, select: { marzId: true, label: true } } },
  });
  const meds = lines ?? dossier?.prescriptions ?? [];
  const items: SafetyItem[] = [];

  for (const a of ctx.alerts) {
    if (a.level === "info" || a.key === "allergies") continue;
    items.push({ key: `case:${a.key}:${short(JSON.stringify(a.params ?? {}))}`, level: a.level, kind: "case", alertKey: a.key, params: a.params });
  }

  if (meds.length) {
    const ps = await loadPatientSafety(ctx.patient.id, visitId);
    if (!ps.allergiesRecorded) items.push({ key: "missing:allergies", level: "high", kind: "missing", alertKey: "allergies_unknown" });
    if (ps.childbearing && (!ps.pregnancy || ps.pregnancy === "unknown")) items.push({ key: "missing:pregnancy", level: "high", kind: "missing", alertKey: "pregnancy_unknown" });
    if (!ps.medsRecorded) items.push({ key: "missing:medicines", level: "caution", kind: "missing", alertKey: "medicines_unknown" });
    const notes = await checkMedicines(ps, meds.map((m) => m.tagId).filter(Boolean) as string[]);
    for (const m of meds) {
      for (const n of (m.tagId && notes[m.tagId]) || []) {
        if (n.level === "info") continue;
        items.push({ key: `med:${m.tagId}:${short(n.text)}`, level: n.level, kind: "medicine", medicine: m.name, text: n.text });
      }
    }
  }

  const marzIds = (dossier?.diagnoses || []).map((d) => d.marzId).filter(Boolean) as string[];
  if (marzIds.length) {
    const entries = await db.marzEntry.findMany({ where: { id: { in: marzIds } }, select: { label: true, dontMiss: true } });
    const seen = new Set<string>();
    for (const e of entries) {
      let dm: { label: string; why: string }[] = [];
      try { dm = JSON.parse(e.dontMiss || "[]"); } catch { /* ignore */ }
      for (const d of dm) if (!seen.has(d.label)) { seen.add(d.label); items.push({ key: `dontmiss:${short(d.label)}`, level: "info", kind: "dontmiss", text: d.label, why: d.why }); }
    }
  }

  const acks = await db.safetyAcknowledgement.findMany({ where: { visitId } });
  for (const it of items) {
    const a = acks.find((x) => x.key === it.key);
    it.ack = a ? { reason: a.reason, byName: a.byName, at: a.createdAt.toISOString() } : null;
  }
  const order = { high: 0, caution: 1, info: 2 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  return { items, blocking: items.filter((i) => i.level === "high" && !i.ack).length };
}
