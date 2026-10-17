import { db } from "@/lib/db";
import type { AsbabPillarCfg } from "@/lib/asbab";

export const FRAMEWORKS = ["asbab", "dalail"] as const;
export type Framework = (typeof FRAMEWORKS)[number];
export const frameworkOf = (v: unknown): Framework => (v === "dalail" ? "dalail" : "asbab");

/** Sections with their questions and options for one framework. `activeOnly` = what doctors see. */
export async function loadAsbabConfig(activeOnly: boolean, framework: Framework = "asbab") {
  const pillars = await db.asbabPillar.findMany({
    where: { framework, ...(activeOnly ? { active: true } : {}) },
    orderBy: { sortOrder: "asc" },
    include: {
      questions: {
        where: activeOnly ? { active: true } : {},
        orderBy: { sortOrder: "asc" },
        include: { options: { where: activeOnly ? { active: true } : {}, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return pillars;
}

export function toPillarCfg(pillars: Awaited<ReturnType<typeof loadAsbabConfig>>): AsbabPillarCfg[] {
  return pillars.map((p) => ({
    id: p.id, key: p.key, label: p.label, english: p.english, description: p.description,
    questions: p.questions.map((q) => ({
      id: q.id, label: q.label, labelLocal: q.labelLocal, helpText: q.helpText, type: q.type, required: q.required,
      weight: q.weight, showIfQuestionId: q.showIfQuestionId, showIfOption: q.showIfOption, version: q.version,
      options: q.options.map((o) => ({ id: o.id, label: o.label, description: o.description, safra: o.safra, dam: o.dam, balgham: o.balgham, sauda: o.sauda })),
    })),
  }));
}
