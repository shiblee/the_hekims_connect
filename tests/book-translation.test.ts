// Book translation: pages are planned, checked and reported so none can silently go missing.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planChunks, parsePageBlocks, finishedStatus, countReviewMarkers, formatPageRanges } from "@/lib/book-translation-core";
import { pdfTranslationSummary } from "@/lib/books";

describe("planChunks", () => {
  it("groups consecutive pages up to the chunk size, in book order", () => {
    assert.deepEqual(planChunks([1, 2, 3, 4, 5, 6, 7], 5), [[1, 2, 3, 4, 5], [6, 7]]);
  });
  it("never joins pages across a gap", () => {
    assert.deepEqual(planChunks([8, 1, 2, 3, 7], 5), [[1, 2, 3], [7, 8]]);
  });
  it("covers every page exactly once", () => {
    const pages = Array.from({ length: 503 }, (_, i) => i + 1);
    assert.deepEqual(planChunks(pages, 5).flat(), pages);
  });
});

describe("parsePageBlocks", () => {
  const answer = "=== PAGE 6 ===\n# Chapter\nFirst page.\n\n=== PAGE 7 ===\nSecond page.\n=== PAGE 8 ===\nThird.";
  it("reads one block per page", () => {
    const m = parsePageBlocks(answer, 6, 8, false);
    assert.deepEqual([...m.keys()], [6, 7, 8]);
    assert.equal(m.get(6), "# Chapter\nFirst page.");
  });
  it("leaves out a page the model skipped — it is never filled in", () => {
    const m = parsePageBlocks("=== PAGE 6 ===\nA\n=== PAGE 8 ===\nC", 6, 8, false);
    assert.equal(m.has(7), false);
    assert.equal(m.size, 2);
  });
  it("drops the last block of a cut-off answer, which may be incomplete", () => {
    const m = parsePageBlocks(answer, 6, 8, true);
    assert.deepEqual([...m.keys()], [6, 7]);
  });
  it("ambiguous numbering is left out (retried), never guessed", () => {
    const m = parsePageBlocks("=== PAGE 3 ===\nX\n=== PAGE 6 ===\n\n=== PAGE 7 ===\nY", 6, 7, false);
    assert.equal(m.size, 0);
  });
  it("skips an empty block", () => {
    const m = parsePageBlocks("=== PAGE 1 ===\n\n=== PAGE 2 ===\nY", 6, 7, false);
    assert.deepEqual([...m.entries()], [[7, "Y"]]);
  });
  it("attachment positions 1..k map onto the requested book pages", () => {
    const m = parsePageBlocks("=== PAGE 1 ===\nA\n=== PAGE 2 ===\nB", 11, 12, false);
    assert.deepEqual([...m.entries()], [[11, "A"], [12, "B"]]);
  });
  it("the page number printed on a scan (e.g. 28) is matched by order", () => {
    const m = parsePageBlocks("=== PAGE 28 ===\nA\n=== PAGE 29 ===\nB", 1, 2, false);
    assert.deepEqual([...m.entries()], [[1, "A"], [2, "B"]]);
    assert.equal(parsePageBlocks("=== PAGE 28 ===\nOnly page", 1, 1, false).get(1), "Only page");
  });
  it("bold / heading markers and Urdu digits are understood", () => {
    const m = parsePageBlocks("**=== PAGE ۱ ===**\nA\n## === Page 2 ===\nB", 1, 2, false);
    assert.deepEqual([...m.entries()], [[1, "A"], [2, "B"]]);
  });
  it("a cut-off answer in book numbering is not mistaken for positions", () => {
    // pages 3–7 asked; answer stops after book pages 3, 4, 5 (5 cut off)
    const m = parsePageBlocks("=== PAGE 3 ===\nA\n=== PAGE 4 ===\nB\n=== PAGE 5 ===\nC", 3, 7, true);
    assert.deepEqual([...m.entries()], [[3, "A"], [4, "B"]]);
  });
  it("accepts a single-page answer without the marker", () => {
    assert.equal(parsePageBlocks("Just the text.", 4, 4, false).get(4), "Just the text.");
    assert.equal(parsePageBlocks("Just the text.", 4, 5, false).size, 0);
  });
  it("tolerates marker spacing and case", () => {
    assert.equal(parsePageBlocks("==  page 2  ==\nHi", 2, 2, false).get(2), "Hi");
  });
});

describe("statuses", () => {
  it("finished run → generated / partial / failed", () => {
    assert.equal(finishedStatus([{ status: "done" }, { status: "done" }]), "generated");
    assert.equal(finishedStatus([{ status: "done" }, { status: "failed" }]), "partial");
    assert.equal(finishedStatus([{ status: "failed" }, { status: "pending" }]), "failed");
  });
  it("counts passages flagged for a human", () => {
    assert.equal(countReviewMarkers("a [unreadable] b [uncertain: Sartan] c [Arabic]"), 2);
  });
  it("formats page ranges", () => {
    assert.equal(formatPageRanges([12, 13, 14, 15, 20]), "12–15, 20");
  });
  it("a PDF's approved version must be for its current file", () => {
    const base = { processingStatus: "generated", confirmedAt: null };
    const s = pdfTranslationSummary([
      { ...base, id: "a", versionNumber: 1, sourceVersion: 1, reviewStatus: "confirmed" },
      { ...base, id: "b", versionNumber: 2, sourceVersion: 1, reviewStatus: "pending_review" },
    ], 2);
    assert.equal(s.approvedVersion, null);
    assert.equal(s.outdated, true);
    assert.equal(s.latestVersion, 2);
    assert.equal(pdfTranslationSummary([], 1).processingStatus, "not_started");
  });
});
