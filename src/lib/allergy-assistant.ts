import { db } from "@/lib/db";
import { generateAllergySuggestions } from "@/lib/gemini";
import { startCatalogAssistantScheduler } from "@/lib/catalog-assistant-scheduler";
import { nameKeys, cleanLabel } from "@/lib/catalog-names";

export const ALLERGY_ASSISTANT_SETTINGS_CATEGORY = "allergy_assistant";

/**
 * Runs one pass of the Unani Allergy Assistant: asks Gemini for new,
 * not-already-present allergens and publishes each as an active AllergyTag
 * immediately — so it shows up in the registration wizard's allergy picker
 * right away. Every published entry is also logged as an AllergySuggestion
 * under its AllergyAssistantRun, giving Settings a complete audit trail.
 */
export async function runAllergyAssistant(trigger: "scheduled" | "manual") {
  const run = await db.allergyAssistantRun.create({ data: { trigger, status: "running" } });

  try {
    const existing = await db.allergyTag.findMany({ select: { label: true } });
    const taken = new Set(existing.flatMap((a) => nameKeys(a.label)));

    const suggestions = await generateAllergySuggestions(existing.map((a) => a.label));
    if (suggestions === null) {
      return db.allergyAssistantRun.update({
        where: { id: run.id },
        data: { status: "failed", errorMessage: "Hakeem Insight is not configured or did not respond — check the Gemini integration under Admin → Settings.", finishedAt: new Date() },
      });
    }

    let maxOrder = (await db.allergyTag.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1;
    let published = 0;

    for (const s of suggestions) {
      const label = cleanLabel(s.label);
      const keys = nameKeys(label);
      if (!label || keys.some((k) => taken.has(k))) continue;
      keys.forEach((k) => taken.add(k)); // also guards against repeats within one batch

      maxOrder += 1;
      let allergy;
      try {
        allergy = await db.allergyTag.create({ data: { label, sortOrder: maxOrder } });
      } catch (err: any) {
        if (err?.code === "P2002") continue; // added concurrently by another run or an admin — skip, don't fail the run
        throw err;
      }
      await db.allergySuggestion.create({
        data: {
          runId: run.id, label,
          allergenType: s.allergenType?.trim() || null,
          rationale: s.rationale?.trim() || null,
          resultingAllergyId: allergy.id,
        },
      });
      published++;
    }

    return db.allergyAssistantRun.update({
      where: { id: run.id },
      data: { status: published ? "success" : "no_candidates", suggestionsCount: published, finishedAt: new Date() },
    });
  } catch (err: any) {
    return db.allergyAssistantRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: String(err?.message || err).slice(0, 500), finishedAt: new Date() },
    });
  }
}

export function scheduleAllergyAssistant() {
  startCatalogAssistantScheduler({ name: "allergy-assistant", settingsCategory: ALLERGY_ASSISTANT_SETTINGS_CATEGORY, run: runAllergyAssistant });
}
