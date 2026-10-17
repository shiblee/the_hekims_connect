// Runs once when the server process boots (Next.js instrumentation hook —
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation).
// Starts the in-process schedulers for the catalog assistants — appropriate
// here because production runs as a long-lived systemd process, not serverless.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ scheduleChiefComplaintBot }, { scheduleAllergyAssistant }, { scheduleSupplementAssistant }, { scheduleMedicationAssistant }, { resumeEnrichmentJobs }] = await Promise.all([
    import("@/lib/chief-complaint-bot"),
    import("@/lib/allergy-assistant"),
    import("@/lib/supplement-assistant"),
    import("@/lib/medication-assistant"),
    import("@/lib/supplement-enrichment"),
  ]);
  scheduleChiefComplaintBot();
  scheduleAllergyAssistant();
  scheduleSupplementAssistant();
  scheduleMedicationAssistant();
  // Supplement enrichment runs left "running" by a restart pick up where they stopped.
  void resumeEnrichmentJobs().catch((err) => console.error("[supplement-enrichment] resume failed:", err));
}
