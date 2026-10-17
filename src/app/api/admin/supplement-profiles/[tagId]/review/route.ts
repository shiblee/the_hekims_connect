import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { refreshCompleteness } from "@/lib/supplement-profile-store";

const STATUSES = new Set(["verified", "rejected", "unverified"]);

/**
 * Verify / reject / reset one claim. Body: { subjectType, subjectKey, status, note? }.
 * subjectType "field" uses the field name as subjectKey; the others use the row id.
 * Verified claims are locked against re-enrichment; rejected ones are hidden
 * from consumers and never re-added.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tagId: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { tagId } = await params;
  const { subjectType, subjectKey, status, note } = await req.json().catch(() => ({}));
  if (!STATUSES.has(status) || typeof subjectKey !== "string") return NextResponse.json({ error: "Invalid review" }, { status: 400 });

  const profile = await db.supplementProfile.findUnique({ where: { tagId }, include: { tag: { select: { label: true } } } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const review = {
    verificationStatus: status,
    reviewedById: status === "unverified" ? null : session.admin.id,
    reviewedAt: status === "unverified" ? null : new Date(),
  };
  const noteValue = typeof note === "string" && note.trim() ? note.trim().slice(0, 1000) : undefined;
  const where = { id: subjectKey, profileId: profile.id };
  let label = subjectKey;

  switch (subjectType) {
    case "field":
      await db.supplementFieldReview.upsert({
        where: { profileId_field: { profileId: profile.id, field: subjectKey } },
        update: { ...review, ...(noteValue !== undefined ? { note: noteValue } : {}) },
        create: { profileId: profile.id, field: subjectKey, provenance: profile.enrichmentVersion >= 2 ? "search" : "legacy", ...review, note: noteValue ?? null },
      });
      break;
    case "complaint": {
      const r = await db.supplementComplaintLink.update({ where, data: { ...review, reviewNote: noteValue }, include: { complaint: { select: { label: true } } } });
      label = `used for ${r.complaint.label}`;
      break;
    }
    case "allergy": {
      const r = await db.supplementAllergyLink.update({ where, data: { ...review, reviewNote: noteValue }, include: { allergy: { select: { label: true } } } });
      label = `${r.relation === "relief" ? "eases" : "allergy caution"} ${r.allergy.label}`;
      break;
    }
    case "symptom": {
      const r = await db.supplementSymptomLink.update({ where, data: { ...review, reviewNote: noteValue }, include: { symptom: { select: { label: true } } } });
      label = `symptom ${r.symptom.label}`;
      break;
    }
    case "ingredient": {
      const r = await db.supplementIngredient.update({ where, data: { ...review, reviewNote: noteValue } });
      label = `ingredient ${r.name}`;
      break;
    }
    case "safety": {
      const r = await db.supplementSafetyItem.update({ where, data: { ...review, reviewNote: noteValue } });
      label = `${r.category.replace("_", " ")}: ${r.text.slice(0, 80)}`;
      break;
    }
    default:
      return NextResponse.json({ error: "Invalid subject type" }, { status: 400 });
  }

  await refreshCompleteness(profile.id);
  await logAdminActivity(
    session.admin.id, "supplement_claim_reviewed",
    `Marked "${label}" on "${profile.tag.label}" as ${status}${noteValue ? ` — ${noteValue}` : ""}`,
    getClientIp(req)
  );
  return NextResponse.json({ ok: true });
}
