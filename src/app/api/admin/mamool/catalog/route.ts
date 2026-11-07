import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

// What a regimen can be built from — only existing masters (complaints, medicines,
// and the dosage-form / timing lists the prescription itself uses).
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [complaints, medicines, options] = await Promise.all([
    db.chiefComplaint.findMany({ where: { active: true }, select: { id: true, label: true, labelLocal: true, synonyms: true, category: true }, orderBy: { label: "asc" } }),
    db.medicationTag.findMany({
      where: { active: true, kind: { in: ["supplement", "medication"] } }, orderBy: { label: "asc" },
      select: { id: true, label: true, kind: true, synonyms: true, profile: { select: { herbType: true, dosageForms: true, genericName: true } } },
    }),
    db.tashkheesOption.findMany({ where: { active: true, list: { in: ["dosage_form", "timing"] } }, orderBy: { sortOrder: "asc" }, select: { list: true, label: true } }),
  ]);
  return NextResponse.json({
    complaints,
    medicines: medicines.map((m) => {
      let forms: string[] = [];
      try { forms = JSON.parse(m.profile?.dosageForms || "[]"); } catch { /* ignore */ }
      // herbType decides the Unani tab (Murakkab / Mufrad / Other) — same rule as the prescription picker.
      return { id: m.id, label: m.label, kind: m.kind, synonyms: m.synonyms, herbType: m.profile?.herbType ?? null, generic: m.profile?.genericName ?? null, category: m.kind === "medication" ? "Allopathic" : m.profile?.herbType || "Unani", forms };
    }),
    forms: options.filter((o) => o.list === "dosage_form").map((o) => o.label),
    timings: options.filter((o) => o.list === "timing").map((o) => o.label),
  });
}
