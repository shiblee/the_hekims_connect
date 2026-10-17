import { db } from "@/lib/db";
import { getHumorConfig } from "@/lib/humor-config";
import { computeHumorBreakdown } from "@/lib/humor-engine";

const HUMORAL_SELECT = {
  id: true, safraPercent: true, damPercent: true, saudaPercent: true, balghamPercent: true,
  dominant: true, dominantOverride: true, breakdown: true, computedAt: true,
  aiClue: true, aiClueGeneratedAt: true,
};

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Makes this visit's ComplaintAssessment rows match `labels` exactly — used
 * when the Registration wizard's Chief Complaint picker (VisitIntake) is the
 * side that just changed. Rows for a label that's dropped are deleted; a
 * label that's new gets a blank row (same shape chief-complaint-matrix.tsx's
 * own emptyDraft produces client-side). Rows for a label that survives are
 * left untouched so the doctor's severity/factors/etc. aren't lost.
 */
export async function syncComplaintAssessmentsToLabels(visitId: string, labels: string[], recordedById: string | null) {
  const trimmedLabels = labels.map((l) => l.trim()).filter(Boolean);
  const wanted = new Set(trimmedLabels);

  const existing = await db.complaintAssessment.findMany({
    where: { visitId },
    select: { id: true, chiefComplaintLabel: true, sortOrder: true },
  });
  const existingLabels = new Set(existing.map((e) => e.chiefComplaintLabel));
  const toDeleteIds = existing.filter((e) => !wanted.has(e.chiefComplaintLabel)).map((e) => e.id);
  const toAddLabels = trimmedLabels.filter((l) => !existingLabels.has(l));

  if (!toDeleteIds.length && !toAddLabels.length) return;

  // Case/whitespace-insensitive, matching the registration route's own
  // pre-fill match — only looked up when something's actually being added.
  const idByLabel = new Map<string, string>();
  if (toAddLabels.length) {
    const allComplaints = await db.chiefComplaint.findMany({ select: { id: true, label: true } });
    for (const c of allComplaints) idByLabel.set(normalize(c.label), c.id);
  }

  const maxSort = existing.reduce((m, e) => Math.max(m, e.sortOrder), -1);
  const newRows = toAddLabels.map((label, i) => ({
    visitId,
    chiefComplaintId: idByLabel.get(normalize(label)) ?? null,
    chiefComplaintLabel: label,
    sortOrder: maxSort + 1 + i,
    recordedById,
  }));

  await db.$transaction([
    ...(toDeleteIds.length ? [db.complaintAssessment.deleteMany({ where: { id: { in: toDeleteIds } } })] : []),
    ...(newRows.length ? [db.complaintAssessment.createMany({ data: newRows })] : []),
  ]);
}

/**
 * Upserts VisitIntake.chiefComplaints to `labels` — used when the Chief
 * Complaint Matrix (ComplaintAssessment) is the side that just changed, so
 * the Registration wizard's simple selector stays in step with it.
 */
export async function syncVisitIntakeToLabels(visitId: string, labels: string[]) {
  const chiefComplaints = JSON.stringify(labels.map((l) => l.trim()).filter(Boolean));
  await db.visitIntake.upsert({
    where: { visitId },
    update: { chiefComplaints },
    create: { visitId, chiefComplaints },
  });
}

/**
 * Recomputes HumoralAssessment from this visit's current ComplaintAssessment
 * rows — shared by both sync directions (and the Chief Complaint Matrix's
 * own save) so there's one place that owns "what counts as scored" and
 * clearing the now-stale AI clue when the breakdown changes underneath it.
 */
export async function recomputeHumoralAssessment(visitId: string) {
  const [complaints, { weightRules }] = await Promise.all([
    db.complaintAssessment.findMany({
      where: { visitId },
      select: { associatedManifestations: true, aggravatingFactors: true, relievingFactors: true, severityScore: true, onsetPattern: true },
    }),
    getHumorConfig(),
  ]);

  const result = computeHumorBreakdown(
    weightRules,
    complaints.map((c) => ({
      manifestations: JSON.parse(c.associatedManifestations || "[]"),
      factors: [...JSON.parse(c.aggravatingFactors || "[]"), ...JSON.parse(c.relievingFactors || "[]")],
      severityScore: c.severityScore,
      onsetPattern: c.onsetPattern,
    }))
  );

  if (!result) {
    // Nothing scored (no manifestations/factors with configured weight) —
    // clear any stale prior result rather than leaving an outdated matrix.
    await db.humoralAssessment.deleteMany({ where: { visitId } });
    return null;
  }

  return db.humoralAssessment.upsert({
    where: { visitId },
    update: {
      safraPercent: result.safraPercent, damPercent: result.damPercent,
      saudaPercent: result.saudaPercent, balghamPercent: result.balghamPercent,
      dominant: result.dominant, breakdown: JSON.stringify(result.breakdown),
      // The persisted AI clue describes the old breakdown — clearing it here
      // (not just client-side) stops a reload from showing stale text next
      // to freshly recomputed percentages it no longer matches.
      aiClue: null, aiClueGeneratedAt: null,
    },
    create: {
      visitId,
      safraPercent: result.safraPercent, damPercent: result.damPercent,
      saudaPercent: result.saudaPercent, balghamPercent: result.balghamPercent,
      dominant: result.dominant, breakdown: JSON.stringify(result.breakdown),
    },
    select: HUMORAL_SELECT,
  });
}

/** Clinical Routing is computed from vitals + red flag + chief complaint +
 * acute symptoms — any of those changing makes a previously generated
 * suggestion stale, so every route that touches one of those clears it here. */
export async function clearClinicalRoutingInsight(visitId: string) {
  await db.clinicalRoutingInsight.deleteMany({ where: { visitId } });
}
