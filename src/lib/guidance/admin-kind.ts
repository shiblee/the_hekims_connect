// Small helpers so tour and tutorial admin routes share one implementation.
import { db } from "@/lib/db";
import { cleanDoc, cleanTour, emptyDoc, emptyTour, GUIDE_LANGS, translationState, type DocContent, type TourContent } from "./content";

export type GuidanceKind = "tours" | "docs";
export const isKind = (k: string): k is GuidanceKind => k === "tours" || k === "docs";
export const singular = (k: GuidanceKind) => (k === "tours" ? "tour" : "doc") as "tour" | "doc";

export interface GuidanceRow {
  id: string; moduleKey: string; name: string; audience: string; draft: string; published: string | null;
  version: number; status: string; dirty: boolean; publishedAt: Date | null; publishedBy: string | null; updatedAt: Date;
  trigger?: string; reoffer?: boolean;
}

export async function findRow(kind: GuidanceKind, id: string): Promise<GuidanceRow | null> {
  return kind === "tours" ? db.guidanceTour.findUnique({ where: { id } }) : db.guidanceDoc.findUnique({ where: { id } });
}

export const parseContent = (kind: GuidanceKind, json: string | null): TourContent | DocContent =>
  kind === "tours" ? cleanTour(json ? JSON.parse(json) : emptyTour()) : cleanDoc(json ? JSON.parse(json) : emptyDoc());

export const langStates = (c: TourContent | DocContent) => Object.fromEntries(GUIDE_LANGS.map((l) => [l, translationState(c, l)]));

/** Summary row for lists (no full content). */
export function summarize(kind: GuidanceKind, r: GuidanceRow) {
  const draft = parseContent(kind, r.draft);
  return {
    id: r.id, moduleKey: r.moduleKey, name: r.name, audience: r.audience, status: r.status, version: r.version, dirty: r.dirty,
    publishedAt: r.publishedAt, updatedAt: r.updatedAt, trigger: r.trigger, reoffer: r.reoffer,
    steps: "steps" in draft ? draft.steps.filter((s) => s.active).length : undefined,
    languages: langStates(draft),
  };
}
