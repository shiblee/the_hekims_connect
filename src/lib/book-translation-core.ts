// Pure rules for book translation (no database) — shared by the worker, the
// API routes, the admin pages and the tests.

export type ProcessingStatus = "not_started" | "queued" | "processing" | "generated" | "partial" | "failed";
export type ReviewStatus = "pending_review" | "in_review" | "confirmed" | "changes_required";
export type PageStatus = "pending" | "done" | "failed";

export const PROCESSING_LABEL: Record<ProcessingStatus, string> = {
  not_started: "Not started",
  queued: "Queued",
  processing: "Processing",
  generated: "Generated",
  partial: "Partially completed",
  failed: "Failed",
};

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  pending_review: "Pending review",
  in_review: "In review",
  confirmed: "Confirmed",
  changes_required: "Changes required",
};

/** Pages sent to Gemini per request — small enough to never hit output limits on dense pages. */
export const CHUNK_PAGES = 5;
/** Tries per page before it is marked failed (a failed page can be retried later by hand). */
export const MAX_PAGE_ATTEMPTS = 3;

/**
 * Splits page numbers into runs of consecutive pages, at most `size` long,
 * keeping book order — e.g. [1,2,3,7,8] size 2 → [[1,2],[3],[7,8]].
 */
export function planChunks(pages: number[], size: number): number[][] {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const p of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.length < size && last[last.length - 1] === p - 1) last.push(p);
    else runs.push([p]);
  }
  return runs;
}

/**
 * Reads Gemini's "=== PAGE n ===" blocks for pages first..last. Only pages
 * that came back are returned — a missing page is never filled in. When the
 * answer was cut off (truncated), the last block may be incomplete, so it is
 * dropped and retried.
 */
export function parsePageBlocks(text: string, first: number, last: number, truncated: boolean): Map<number, string> {
  const out = new Map<number, string>();
  const re = /^[ \t]*={2,}\s*PAGE\s+(\d+)\s*={2,}[ \t]*$/gim;
  const marks: { page: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) marks.push({ page: Number(m[1]), start: m.index, end: m.index + m[0].length });
  for (let i = 0; i < marks.length; i++) {
    if (truncated && i === marks.length - 1) break;
    const { page, end } = marks[i];
    if (page < first || page > last || out.has(page)) continue;
    const body = text.slice(end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim();
    if (body) out.set(page, body);
  }
  // A one-page request answered without the marker is still that page.
  if (!marks.length && first === last && !truncated && text.trim()) out.set(first, text.trim());
  return out;
}

/** Status of a finished run from its pages. */
export function finishedStatus(pages: { status: string }[]): "generated" | "partial" | "failed" {
  const done = pages.filter((p) => p.status === "done").length;
  if (done === pages.length) return "generated";
  return done > 0 ? "partial" : "failed";
}

/** Places the translator flagged for a human ([unreadable], [uncertain: …]). */
export function countReviewMarkers(text: string): number {
  return (text.match(/\[(unreadable|uncertain\b[^\]]*)\]/gi) || []).length;
}

/** Contiguous ranges for display: [1,2,3,7] → "1–3, 7". */
export function formatPageRanges(pages: number[]): string {
  return planChunks(pages, Number.MAX_SAFE_INTEGER)
    .map((r) => (r.length === 1 ? `${r[0]}` : `${r[0]}–${r[r.length - 1]}`))
    .join(", ");
}
