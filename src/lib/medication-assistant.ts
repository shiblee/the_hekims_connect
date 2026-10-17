import { db } from "@/lib/db";
import { generateMedicationSuggestions } from "@/lib/gemini";
import { startCatalogAssistantScheduler } from "@/lib/catalog-assistant-scheduler";
import { nameKeys, cleanLabel } from "@/lib/catalog-names";
import { enrichSupplementTags, enrichPendingSupplements } from "@/lib/supplement-enrichment";

export const MEDICATION_ASSISTANT_SETTINGS_CATEGORY = "medication_assistant";
const KIND = "medication";
// Older un-profiled medicines queued per scheduled run, so a backlog clears gradually.
const BACKFILL_PER_RUN = 10;

/**
 * Runs one pass of the Allopathic Medication Assistant: asks Gemini for new,
 * not-already-present allopathic medicines and publishes each as an active
 * MedicationTag (kind "medication") immediately — so it shows up in
 * Meta -> Medications and in the registration wizard's picker right away.
 * Every published entry is also logged as a MedicationSuggestion under its
 * MedicationAssistantRun, giving Settings a complete audit trail.
 */
export async function runMedicationAssistant(trigger: "scheduled" | "manual") {
  const run = await db.medicationAssistantRun.create({ data: { trigger, status: "running" } });

  try {
    const existing = await db.medicationTag.findMany({ where: { kind: KIND }, select: { label: true } });
    const taken = new Set(existing.flatMap((t) => nameKeys(t.label)));

    const suggestions = await generateMedicationSuggestions(existing.map((t) => t.label));
    if (suggestions === null) {
      return db.medicationAssistantRun.update({
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
      await db.medicationSuggestion.create({
        data: {
          runId: run.id, label,
          drugClass: s.drugClass || null,
          rationale: s.rationale || null,
          resultingTagId: tag.id,
        },
      });
      newTagIds.push(tag.id);
      published++;
    }

    // Queue search-backed profiles for what was just published, plus (on
    // scheduled runs) older medicines that still have none. Profiling runs in
    // the background and never fails the run.
    await enrichSupplementTags(newTagIds, "medication").catch(() => {});
    if (trigger === "scheduled") await enrichPendingSupplements(BACKFILL_PER_RUN, "medication").catch(() => {});

    return db.medicationAssistantRun.update({
      where: { id: run.id },
      data: { status: published ? "success" : "no_candidates", suggestionsCount: published, finishedAt: new Date() },
    });
  } catch (err: any) {
    return db.medicationAssistantRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: String(err?.message || err).slice(0, 500), finishedAt: new Date() },
    });
  }
}

export function scheduleMedicationAssistant() {
  startCatalogAssistantScheduler({ name: "medication-assistant", settingsCategory: MEDICATION_ASSISTANT_SETTINGS_CATEGORY, run: runMedicationAssistant });
}
