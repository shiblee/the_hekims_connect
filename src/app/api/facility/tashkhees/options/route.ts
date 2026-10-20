import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";

/** Active Stage 5 options, grouped by list, plus the Supplements & Herbs catalogue for prescriptions. */
export async function GET(req: NextRequest) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [options, herbs, amraz] = await Promise.all([
    // Doctors only see approved options (Usool-e-Ilaj drafts await physician review).
    db.tashkheesOption.findMany({ where: { active: true, reviewStatus: "approved" }, orderBy: [{ list: "asc" }, { sortOrder: "asc" }], select: { id: true, list: true, label: true, localName: true, description: true, imageUrl: true, imageCredit: true, category: true, foodMizaj: true, appliesTo: true } }),
    db.medicationTag.findMany({
      where: { kind: "supplement", active: true }, orderBy: { label: "asc" },
      select: { id: true, label: true, profile: { select: { herbType: true, dosageForms: true } } },
    }),
    // Amraz catalogue for the diagnosis picker — unverified entries included, labelled on screen.
    db.marzEntry.findMany({ where: { active: true, reviewStatus: { not: "rejected" } }, orderBy: { label: "asc" }, select: { id: true, label: true, localName: true, category: true, sabab: true, reviewStatus: true } }),
  ]);
  // Principles carry their classical step (1–6) so the page can group them; other rules stay on the server.
  const grouped: Record<string, (Omit<(typeof options)[number], "appliesTo"> & { phase?: number })[]> = {};
  for (const { appliesTo, ...o } of options) {
    let phase: number | undefined;
    if (o.list === "usool") { try { phase = Number(JSON.parse(appliesTo || "{}").phase) || 6; } catch { phase = 6; } }
    (grouped[o.list] ||= []).push(phase ? { ...o, phase } : o);
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
      return { id: h.id, label: h.label, category: h.profile?.herbType ?? null, forms };
    }),
  });
}
