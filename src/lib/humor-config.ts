import { db } from "@/lib/db";

// Manifestations + factor tags + weight rules, in one shape shared by the
// admin builder (which edits it) and the facility runner (which reads it to
// render the per-complaint checklists/pickers and to compute the live Humoral
// Matrix preview — same convention as getScreeningConfig in src/lib/screening.ts.
const DEFAULT_SEVERITY_LABELS: Record<number, string> = {
  1: "Mild Disturbance", 2: "Mild Disturbance", 3: "Noticeable Discomfort",
  4: "Interferes With Activity", 5: "Impaired Daily Habit", 6: "Moderate to Severe",
  7: "Severe Discomfort", 8: "Severe Discomfort", 9: "Near-Incapacitating",
  10: "Incapacitating Crisis",
};

// Fixed 10-row severity scale — seeded on first read if missing, so the admin
// page always has all 10 levels to edit without a separate migration step.
async function getSeverityLabels() {
  const existing = await db.severityScaleLabel.findMany({ orderBy: { level: "asc" } });
  if (existing.length === 10) return existing;

  const existingLevels = new Set(existing.map((r) => r.level));
  const missing = Array.from({ length: 10 }, (_, i) => i + 1).filter((lvl) => !existingLevels.has(lvl));
  if (missing.length) {
    await db.severityScaleLabel.createMany({
      data: missing.map((level) => ({ level, label: DEFAULT_SEVERITY_LABELS[level] })),
    });
  }
  return db.severityScaleLabel.findMany({ orderBy: { level: "asc" } });
}

const DEFAULT_HUMOR_DISPLAY: Record<string, { axisLabel: string; unaniLabel: string; description: string }> = {
  safra: { axisLabel: "Fire", unaniLabel: "Safrawi", description: "Hot & Dry" },
  dam: { axisLabel: "Air", unaniLabel: "Damawi", description: "Hot & Moist" },
  balgham: { axisLabel: "Water", unaniLabel: "Balghami", description: "Cold & Moist" },
  sauda: { axisLabel: "Earth", unaniLabel: "Saudawi", description: "Cold & Dry" },
};
const HUMOR_KEYS = ["safra", "dam", "balgham", "sauda"] as const;

// Fixed 4-row humor display config — seeded on first read if missing, same
// convention as getSeverityLabels.
async function getHumorDisplayConfig() {
  const existing = await db.humorDisplayConfig.findMany();
  if (existing.length === 4) return existing;

  const existingHumors = new Set(existing.map((r) => r.humor));
  const missing = HUMOR_KEYS.filter((h) => !existingHumors.has(h));
  if (missing.length) {
    await db.humorDisplayConfig.createMany({
      data: missing.map((humor) => ({ humor, ...DEFAULT_HUMOR_DISPLAY[humor] })),
    });
  }
  return db.humorDisplayConfig.findMany();
}

export async function getHumorConfig() {
  const [manifestations, factorTags, weightRules, severityLabels, displayConfig] = await Promise.all([
    db.complaintManifestation.findMany({
      orderBy: [{ chiefComplaintId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, chiefComplaintId: true, key: true, label: true, labelLocal: true, sortOrder: true, active: true },
    }),
    db.complaintFactorTag.findMany({
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
      select: { id: true, kind: true, label: true, sortOrder: true, active: true },
    }),
    db.humorWeightRule.findMany({
      orderBy: [{ sourceType: "asc" }, { sourceValue: "asc" }],
      select: {
        id: true, sourceType: true, sourceValue: true,
        safraPoints: true, damPoints: true, saudaPoints: true, balghamPoints: true,
        active: true, notes: true,
      },
    }),
    getSeverityLabels(),
    getHumorDisplayConfig(),
  ]);

  return { manifestations, factorTags, weightRules, severityLabels, displayConfig };
}

export type HumorConfig = Awaited<ReturnType<typeof getHumorConfig>>;
