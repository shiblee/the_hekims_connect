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

/** Western, Arabic-Indic (٠-٩) and Urdu/Persian (۰-۹) digits → number. */
function toNumber(digits: string) {
  return Number(digits.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)));
}

/**
 * Reads Gemini's "=== PAGE n ===" blocks for pages first..last. Gemini is asked
 * to number blocks by position in the attachment (1, 2, …), but it sometimes
 * uses the book's numbering or the page number printed on the scan, so:
 *  - numbers 1..k (starting at 1) → attachment positions; first..last (starting
 *    at first) → book pages;
 *  - otherwise, when the number of blocks matches, blocks are taken in order;
 *  - anything still ambiguous is left out (and retried) — never guessed.
 * When the answer was cut off (truncated), the last block may be incomplete,
 * so it is dropped and retried.
 */
export function parsePageBlocks(text: string, first: number, last: number, truncated: boolean): Map<number, string> {
  const out = new Map<number, string>();
  const count = last - first + 1;
  // Tolerates markdown around the marker (**, ##, >) and ===/--- fences.
  const re = /^[ \t>#*_]*(?:={2,}|-{3,})?[ \t*_]*PAGE[ \t]+([0-9\u0660-\u0669\u06F0-\u06F9]+)[ \t*_]*(?:={2,}|-{3,})?[ \t*_]*$/gim;
  const marks: { n: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) marks.push({ n: toNumber(m[1]), start: m.index, end: m.index + m[0].length });

  if (!marks.length) {
    // A one-page request answered without the marker is still that page.
    if (count === 1 && !truncated && text.trim()) out.set(first, text.trim());
    return out;
  }

  const blocks = marks.map((mk, i) => ({ n: mk.n, body: text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim() }));
  const nums = blocks.map((b) => b.n);
  const distinct = new Set(nums).size === nums.length;
  let pageOf: ((n: number, i: number) => number) | null = null;
  // Positions start at 1, book numbers at `first` — that tells the two apart even when an answer stops early.
  if (distinct && nums[0] === 1 && nums.every((x) => x >= 1 && x <= count)) pageOf = (n) => first + n - 1;
  else if (distinct && nums[0] === first && nums.every((x) => x >= first && x <= last)) pageOf = (n) => n;
  else if (blocks.length === count) pageOf = (_n, i) => first + i;
  if (!pageOf) return out;

  blocks.forEach((b, i) => {
    if (truncated && i === blocks.length - 1) return;
    const page = pageOf!(b.n, i);
    if (b.body && !out.has(page)) out.set(page, b.body);
  });
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
