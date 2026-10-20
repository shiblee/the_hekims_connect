import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClinicActor } from "@/lib/reports-server";
import { loadFullProfile, parseJson } from "@/lib/supplement-profile-store";

/**
 * Read-only catalogue information for one medicine (Supplements & Herbs or Medications),
 * shown to the doctor from the prescription line. Rejected claims are left out; everything
 * else carries whether an admin has verified it. Dosage is never stored, so never shown.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  const actor = await getClinicActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tagId } = await params;
  const tag = await db.medicationTag.findUnique({ where: { id: tagId }, select: { id: true, label: true, kind: true } });
  if (!tag || (tag.kind !== "supplement" && tag.kind !== "medication")) return NextResponse.json({ error: "Record not found" }, { status: 404 });

  const p = await loadFullProfile({ tagId });
  if (!p || p.status === "pending") return NextResponse.json({ label: tag.label, kind: tag.kind, profile: null });

  const verified = (field: string) => p.fieldReviews.find((r) => r.field === field)?.verificationStatus === "verified";
  const rejected = (field: string) => p.fieldReviews.find((r) => r.field === field)?.verificationStatus === "rejected";
  const text = (field: keyof typeof p) => {
    const v = p[field];
    return typeof v === "string" && v.trim() && !rejected(field as string) ? { value: v.trim(), verified: verified(field as string) } : null;
  };
  const list = (field: keyof typeof p) => (rejected(field as string) ? [] : parseJson<unknown[]>(p[field] as string, []))
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && "product" in x
      ? [String((x as { product?: string }).product || ""), (x as { manufacturer?: string }).manufacturer ? `(${(x as { manufacturer?: string }).manufacturer})` : ""].join(" ").trim()
      : ""))
    .filter(Boolean);
  const keep = <T extends { verificationStatus: string }>(rows: T[]) => rows.filter((r) => r.verificationStatus !== "rejected");

  return NextResponse.json({
    label: tag.label,
    kind: tag.kind,
    profile: {
      category: p.herbType,
      names: {
        unani: text("unaniName"), english: text("englishName"), urdu: text("urduName"), hindi: text("hindiName"), arabic: text("arabicName"),
        botanical: text("botanicalName"), family: text("family"), generic: text("genericName"), salt: text("saltForm"),
      },
      synonyms: list("synonyms"),
      mizaj: text("mizaj"),
      partsUsed: text("partsUsed"),
      summary: text("summary"),
      traditional: text("traditionalDescription"),
      modern: text("modernEvidence"),
      preparation: text("preparation"),
      therapeuticClass: text("therapeuticClass"),
      pharmacologicalClass: text("pharmacologicalClass"),
      mechanism: text("mechanism"),
      rxStatus: text("rxStatus"),
      actions: list("actions"),
      forms: list("dosageForms"),
      routes: list("routes"),
      strengths: list("strengths"),
      brands: list("brands"),
      ingredients: [
        ...keep(p.ingredients).map((r) => ({ label: r.ingredientTag?.label || r.name, role: r.role && r.role !== "unknown" ? r.role : null, verified: r.verificationStatus === "verified" })),
        ...(p.enrichmentVersion < 2 ? parseJson<string[]>(p.keyIngredients, []).map((label) => ({ label, role: null, verified: false })) : []),
      ],
      uses: [
        ...keep(p.complaints).filter((r) => r.relationType !== "not_recommended").map((r) => ({ label: r.complaint.label, verified: r.verificationStatus === "verified" })),
        ...keep(p.symptoms).map((r) => ({ label: r.symptom.label, verified: r.verificationStatus === "verified" })),
      ],
      safety: [
        ...keep(p.safetyItems).map((r) => ({ text: r.text, category: r.category, severity: r.severity, verified: r.verificationStatus === "verified" })),
        ...(p.enrichmentVersion < 2 ? parseJson<string[]>(p.cautions, []).map((t) => ({ text: t, category: "precaution", severity: null, verified: false })) : []),
      ],
      allergies: keep(p.allergies).filter((r) => r.relation === "caution").map((r) => ({ label: r.allergy.label, verified: r.verificationStatus === "verified" })),
      notDocumented: parseJson<string[]>(p.unknownFields, []),
    },
  });
}
