import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";

interface CatalogAssistantSchedule {
  /** Prefix for server log lines, e.g. "allergy-assistant". */
  name: string;
  /** PortalSetting category holding `enabled`, `interval_minutes`, `last_run_at`. */
  settingsCategory: string;
  run: (trigger: "scheduled") => Promise<{ status: string; suggestionsCount: number }>;
}

const TICK_MS = 5 * 60 * 1000;
const started = new Set<string>();

/**
 * Starts an in-process poller for one catalog assistant (Unani complaints,
 * allergies, ...). Ticks every 5 minutes — finer than the shortest selectable
 * interval (15 min) — and compares against a persisted `last_run_at` rather
 * than computing cron offsets, so it survives restarts without double-running
 * or silently skipping a cycle. Called once per assistant from
 * instrumentation.ts when the server process boots.
 */
export function startCatalogAssistantScheduler({ name, settingsCategory, run }: CatalogAssistantSchedule) {
  if (started.has(name)) return;
  started.add(name);
  console.log(`[${name}] scheduler registered, polling every 5 minutes`);

  let inFlight = false;

  const tick = async () => {
    if (inFlight) return; // a slow run must never overlap the next tick
    inFlight = true;
    try {
      const enabled = (await getSetting(settingsCategory, "enabled", "false")) === "true";
      if (!enabled) return;

      const intervalMinutes = parseInt(await getSetting(settingsCategory, "interval_minutes", "1440"), 10) || 1440;
      const lastRunAt = await getSetting(settingsCategory, "last_run_at", "");
      const dueAt = lastRunAt ? new Date(lastRunAt).getTime() + intervalMinutes * 60 * 1000 : 0;
      if (Date.now() < dueAt) return;

      const now = new Date().toISOString();
      await db.portalSetting.upsert({
        where: { category_key: { category: settingsCategory, key: "last_run_at" } },
        update: { value: now },
        create: { category: settingsCategory, key: "last_run_at", value: now },
      });
      console.log(`[${name}] scheduled run starting`);
      const result = await run("scheduled");
      console.log(`[${name}] scheduled run finished: ${result.status}, ${result.suggestionsCount} new entr${result.suggestionsCount === 1 ? "y" : "ies"}`);
    } catch (err) {
      console.error(`[${name}] scheduler tick failed:`, err);
    } finally {
      inFlight = false;
    }
  };

  setInterval(tick, TICK_MS);
  // Also check shortly after boot, in case the server was down past when a
  // cycle was due — the dueAt comparison still prevents an early run.
  setTimeout(tick, 60 * 1000);
}
