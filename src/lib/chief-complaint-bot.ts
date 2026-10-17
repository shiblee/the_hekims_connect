import { db } from "@/lib/db";
import { generateChiefComplaintSuggestions } from "@/lib/gemini";
import { deriveChiefComplaintKey } from "@/lib/chief-complaint-key";
import { startCatalogAssistantScheduler } from "@/lib/catalog-assistant-scheduler";

const SETTINGS_CATEGORY = "chief_complaint_assistant";
const normalize = (s: string) => s.trim().toLowerCase();

/**
 * Runs one pass of the Unani Chief Complaint discovery bot: asks Gemini for
 * new, not-already-present complaints and immediately publishes each one as
 * a real ChiefComplaint — no human review step. Every suggestion is still
 * recorded as a ChiefComplaintSuggestion row (status "auto_approved", with
 * resultingComplaintId set) alongside the ChiefComplaintBotRun it came from,
 * so Admin -> Settings always shows a complete, honest log of what the bot
 * generated and when, even with no approval gate in front of it.
 */
export async function runChiefComplaintBot(trigger: "scheduled" | "manual") {
  const run = await db.chiefComplaintBotRun.create({
    data: { trigger, status: "running" },
  });

  try {
    const existing = await db.chiefComplaint.findMany({ select: { label: true, category: true } });
    const taken = new Set(existing.map((c) => normalize(c.label)));

    const suggestions = await generateChiefComplaintSuggestions(existing);
    if (suggestions === null) {
      return db.chiefComplaintBotRun.update({
        where: { id: run.id },
        data: { status: "failed", errorMessage: "Hakeem Insight is not configured or did not respond — check the Gemini integration under Admin → Settings.", finishedAt: new Date() },
      });
    }

    const fresh = suggestions.filter((s) => {
      const key = normalize(s.label);
      if (taken.has(key)) return false;
      taken.add(key); // guard against the model suggesting the same label twice in one batch
      return true;
    });

    let maxOrder = (await db.chiefComplaint.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? -1;
    let published = 0;

    for (const s of fresh) {
      const label = s.label.trim();
      const key = await deriveChiefComplaintKey(label);
      if (!key) continue; // couldn't derive a usable key (e.g. label was punctuation-only) — skip rather than fail the whole run

      maxOrder += 1;
      const complaint = await db.chiefComplaint.create({
        data: { key, label, labelLocal: s.labelLocal?.trim() || null, category: s.category.trim(), sortOrder: maxOrder },
      });
      await db.chiefComplaintSuggestion.create({
        data: {
          runId: run.id, label, labelLocal: s.labelLocal?.trim() || null, category: s.category.trim(),
          rationale: s.rationale?.trim() || null,
          status: "auto_approved", resultingComplaintId: complaint.id, reviewedAt: new Date(),
        },
      });
      published++;
    }

    return db.chiefComplaintBotRun.update({
      where: { id: run.id },
      data: {
        status: published ? "success" : "no_candidates",
        suggestionsCount: published,
        finishedAt: new Date(),
      },
    });
  } catch (err: any) {
    return db.chiefComplaintBotRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: String(err?.message || err).slice(0, 500), finishedAt: new Date() },
    });
  }
}

export function scheduleChiefComplaintBot() {
  startCatalogAssistantScheduler({ name: "complaint-assistant", settingsCategory: SETTINGS_CATEGORY, run: runChiefComplaintBot });
}
