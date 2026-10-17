import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";

/** Active Stage 5 options, grouped by list, plus the Supplements & Herbs catalogue for prescriptions. */
export async function GET(req: NextRequest) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [options, herbs] = await Promise.all([
    db.tashkheesOption.findMany({ where: { active: true }, orderBy: [{ list: "asc" }, { sortOrder: "asc" }], select: { id: true, list: true, label: true, localName: true, description: true } }),
    db.medicationTag.findMany({
      where: { kind: "supplement", active: true }, orderBy: { label: "asc" },
      select: { id: true, label: true, profile: { select: { herbType: true, dosageForms: true } } },
    }),
  ]);
  const grouped: Record<string, typeof options> = {};
  for (const o of options) (grouped[o.list] ||= []).push(o);
  return NextResponse.json({
    options: grouped,
    herbs: herbs.map((h) => {
      let forms: string[] = [];
      try { forms = JSON.parse(h.profile?.dosageForms || "[]"); } catch { /* ignore */ }
      return { id: h.id, label: h.label, category: h.profile?.herbType ?? null, forms };
    }),
  });
}
