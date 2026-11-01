import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { conditionLabel } from "@/lib/ghiza-conditions";

/** Active Stage 5 options, grouped by list, plus the Supplements & Herbs catalogue for prescriptions. */
export async function GET(req: NextRequest) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [options, herbs, amraz] = await Promise.all([
    // Doctors only see approved options (Usool-e-Ilaj drafts await physician review).
    db.tashkheesOption.findMany({ where: { active: true, reviewStatus: "approved" }, orderBy: [{ list: "asc" }, { sortOrder: "asc" }], select: { id: true, list: true, label: true, localName: true, description: true, imageUrl: true, imageCredit: true, category: true, foodMizaj: true, appliesTo: true } }),
    db.medicationTag.findMany({
      // Unani medicines & supplements, and allopathic medicines ("medication") for the prescription picker.
      where: { kind: { in: ["supplement", "medication"] }, active: true }, orderBy: { label: "asc" },
      select: { id: true, label: true, kind: true, profile: { select: { herbType: true, dosageForms: true, genericName: true } } },
    }),
    // Amraz catalogue for the diagnosis picker — unverified entries included, labelled on screen.
    db.marzEntry.findMany({ where: { active: true, reviewStatus: { not: "rejected" } }, orderBy: { label: "asc" }, select: { id: true, label: true, localName: true, category: true, sabab: true, reviewStatus: true } }),
  ]);
  // Principles carry their classical step (1–6) so the page can group them; other rules stay on the server.
  // Foods carry their action / how-to-take / restriction reason; meal rules, who they suit.
  type Extra = { phase?: number; action?: string; use?: string; harm?: string; suits?: { mizaj?: string[]; conditions?: string[]; always?: boolean } };
  const grouped: Record<string, (Omit<(typeof options)[number], "appliesTo"> & Extra)[]> = {};
  for (const { appliesTo, ...o } of options) {
    let rule: Record<string, any> = {};
    try { rule = JSON.parse(appliesTo || "{}") || {}; } catch { rule = {}; }
    const extra: Extra = {};
    if (o.list === "usool") extra.phase = Number(rule.phase) || 6;
    if (o.list === "ghiza") { if (rule.action) extra.action = rule.action; if (rule.use) extra.use = rule.use; if (rule.harm) extra.harm = rule.harm; }
    if (o.list === "ghiza_rule") extra.suits = { ...(rule.suits ?? {}), conditions: (rule.suits?.conditions ?? []).map(conditionLabel) };
    (grouped[o.list] ||= []).push({ ...o, ...extra });
  }
  return NextResponse.json({
    options: grouped,
    amraz: amraz.map((m) => {
      let sabab: string[] = [];
      try { sabab = JSON.parse(m.sabab || "[]"); } catch { /* ignore */ }
      return { id: m.id, label: m.label, localName: m.localName, category: m.category, sabab, unverified: m.reviewStatus !== "approved" };
    }),
    herbs: herbs.map((h) => {
      let forms: string[] = [];
      try { forms = JSON.parse(h.profile?.dosageForms || "[]"); } catch { /* ignore */ }
      return { id: h.id, label: h.label, kind: h.kind, generic: h.profile?.genericName ?? null, category: h.profile?.herbType ?? null, forms };
    }),
  });
}
