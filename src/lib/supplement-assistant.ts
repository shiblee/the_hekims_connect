import { db } from "@/lib/db";
import { generateSupplementSuggestions } from "@/lib/gemini";
import { startCatalogAssistantScheduler } from "@/lib/catalog-assistant-scheduler";
import { nameKeys, cleanLabel } from "@/lib/catalog-names";
import { enrichSupplementTags, enrichPendingSupplements } from "@/lib/supplement-enrichment";

export const SUPPLEMENT_ASSISTANT_SETTINGS_CATEGORY = "supplement_assistant";
const KIND = "supplement";
// Older items profiled per scheduled run, so the backlog clears gradually
// without one run making dozens of slow calls.
const BACKFILL_PER_RUN = 10;

/**
 * Runs one pass of the Unani Supplement & Herb Assistant: asks Gemini for
 * new, not-already-present Unani herbs/formulations and publishes each as an
 * active MedicationTag (kind "supplement") immediately — so it shows up in
 * Meta -> Supplements & Herbs and in the registration wizard's picker right
 * away. Every published entry is also logged as a SupplementSuggestion under
 * its SupplementAssistantRun, giving Settings a complete audit trail.
 */
export async function runSupplementAssistant(trigger: "scheduled" | "manual") {
  const run = await db.supplementAssistantRun.create({ data: { trigger, status: "running" } });

  try {
    const existing = await db.medicationTag.findMany({ where: { kind: KIND }, select: { label: true } });
    const taken = new Set(existing.flatMap((t) => nameKeys(t.label)));

    const suggestions = await generateSupplementSuggestions(existing.map((t) => t.label));
    if (suggestions === null) {
      return db.supplementAssistantRun.update({
        where: { id: run.id },
        data: { status: "failed", errorMessage: "Hakeem Insight is not configured or did not respond — check the Gemini integration under Admin → Settings.", finishedAt: new Date() },
      });
    }

    let maxOrder = (await db.medicationTag.aggregate({ where: { kind: KIND }, _max: { sortOrder: true } }))._max.sortOrder ?? -1;
    let published = 0;
    const newTagIds: string[] = [];

    for (const s of suggestions) {
      const label = cleanLabel(s.label);
      const keys = nameKeys(label);
      if (!label || keys.some((k) => taken.has(k))) continue;
      keys.forEach((k) => taken.add(k)); // also guards against repeats within one batch

      maxOrder += 1;
      let tag;
      try {
        tag = await db.medicationTag.create({ data: { kind: KIND, label, sortOrder: maxOrder } });
      } catch (err: any) {
        if (err?.code === "P2002") continue; // added concurrently by another run or an admin — skip, don't fail the run
        throw err;
      }
      await db.supplementSuggestion.create({
        data: {
          runId: run.id, label,
          herbType: s.herbType?.trim() || null,
          rationale: s.rationale?.trim() || null,
          resultingTagId: tag.id,
        },
      });
      newTagIds.push(tag.id);
      published++;
    }

    // Profile what was just published, then (scheduled runs only) work
    // through older items that still have no profile. Enrichment failures
    // never fail the run — those items are retried on later passes.
    await enrichSupplementTags(newTagIds).catch(() => {});
    if (trigger === "scheduled") await enrichPendingSupplements(BACKFILL_PER_RUN).catch(() => {});

    return db.supplementAssistantRun.update({
      where: { id: run.id },
      data: { status: published ? "success" : "no_candidates", suggestionsCount: published, finishedAt: new Date() },
    });
  } catch (err: any) {
    return db.supplementAssistantRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: String(err?.message || err).slice(0, 500), finishedAt: new Date() },
    });
  }
}

export function scheduleSupplementAssistant() {
  startCatalogAssistantScheduler({ name: "supplement-assistant", settingsCategory: SUPPLEMENT_ASSISTANT_SETTINGS_CATEGORY, run: runSupplementAssistant });
}
