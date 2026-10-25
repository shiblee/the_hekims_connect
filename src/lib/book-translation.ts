import { db } from "@/lib/db";
import { geminiStatus, translateUrduPdfPages, GeminiQuotaError, GEMINI_MODEL } from "@/lib/gemini";
import { getBookFile } from "@/lib/book-storage";
import { loadPdf, extractPages } from "@/lib/book-pdf";
import {
  CHUNK_PAGES, MAX_PAGE_ATTEMPTS, planChunks, parsePageBlocks, finishedStatus, countReviewMarkers, formatPageRanges,
} from "@/lib/book-translation-core";

// Urdu → English book translation, run as a persistent job: every page is its
// own row, so progress survives restarts (instrumentation.ts resumes), a
// failure only costs the pages that failed, and no page can silently vanish —
// a page the model did not return stays pending/failed and is reported.
// Pages go to Gemini a few at a time as a small PDF of just those pages, so
// typed and scanned books are handled the same way.

/** Gemini's inline request limit is ~20 MB; stay well under it. */
const MAX_CHUNK_BYTES = 14 * 1024 * 1024;
const PAUSE_MS = 1000;

const AI_OFF = "AI translation is switched off. Turn Gemini on in Admin → Settings to translate.";
const QUOTA = "Gemini's credits or rate limit ran out. Top up / wait, then use Retry to continue from the pages still missing.";

export class BookTranslationError extends Error {}

type Translator = typeof translateUrduPdfPages;

/**
 * Development-only stand-in (BOOK_TRANSLATOR_FAKE=1, never in production) so
 * the whole flow can be exercised without paid AI calls.
 * BOOK_TRANSLATOR_FAKE_DROP=7 leaves page 7 out of every answer.
 */
const fakeTranslator: Translator = async (_pdf, first, last, instructions) => {
  await new Promise((r) => setTimeout(r, 400));
  const drop = Number(process.env.BOOK_TRANSLATOR_FAKE_DROP || 0);
  const blocks: string[] = [];
  for (let p = first; p <= last; p++) {
    if (p === drop) continue;
    blocks.push(`=== PAGE ${p} ===\n# Page ${p}\n\nSample English translation of page ${p}.${instructions ? ` (Style: ${instructions})` : ""}`);
  }
  return { text: blocks.join("\n\n"), finishReason: "STOP" };
};

function fakeEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.BOOK_TRANSLATOR_FAKE === "1";
}

function translator(): Translator {
  return fakeEnabled() ? fakeTranslator : translateUrduPdfPages;
}

export async function translationAvailable(): Promise<{ ok: boolean; reason: string | null }> {
  if (fakeEnabled()) return { ok: true, reason: null };
  return (await geminiStatus()) === "on" ? { ok: true, reason: null } : { ok: false, reason: AI_OFF };
}

// ---------------------------------------------------------------- worker

let workerRunning = false;

/** Starts the in-process worker if it isn't already running; it drains every queued job, oldest first. */
export function kickBookTranslationWorker() {
  if (workerRunning) return;
  workerRunning = true;
  void (async () => {
    try {
      for (;;) {
        const next = await db.bookTranslation.findFirst({
          where: { processingStatus: { in: ["queued", "processing"] } },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        if (!next) break;
        await processTranslation(next.id);
      }
    } catch (err) {
      console.error("[book-translation] worker stopped:", err);
    } finally {
      workerRunning = false;
    }
  })();
}

/** Jobs left queued/processing by a restart carry on from their pending pages. */
export async function resumeBookTranslations() {
  const n = await db.bookTranslation.count({ where: { processingStatus: { in: ["queued", "processing"] } } });
  if (n) kickBookTranslationWorker();
}

async function finish(id: string, errorMessage: string | null) {
  const pages = await db.bookTranslationPage.findMany({ where: { translationId: id }, select: { status: true, pageNumber: true } });
  const status = finishedStatus(pages);
  const failed = pages.filter((p) => p.status !== "done").map((p) => p.pageNumber);
  const message = errorMessage ?? (failed.length ? `${failed.length === 1 ? "Page" : "Pages"} ${formatPageRanges(failed)} could not be translated. Use Retry for just ${failed.length === 1 ? "that page" : "those pages"}.` : null);
  await db.bookTranslation.update({
    where: { id },
    data: { processingStatus: status, errorMessage: message, generatedAt: new Date() },
  });
}

async function processTranslation(id: string) {
  const t = await db.bookTranslation.findUnique({ where: { id }, select: { id: true, pdfId: true, sourceVersion: true, instructions: true } });
  if (!t) return;

  const available = await translationAvailable();
  if (!available.ok) return finish(id, available.reason);

  const file = await db.bookPdfFile.findUnique({ where: { pdfId_version: { pdfId: t.pdfId, version: t.sourceVersion } } });
  if (!file) return finish(id, "The source PDF file is missing.");

  let doc;
  try {
    doc = await loadPdf(await getBookFile(file.storageKey));
  } catch (err) {
    console.error("[book-translation] could not read source:", err);
    return finish(id, "The source PDF could not be read from storage. Try again later.");
  }

  await db.bookTranslation.update({ where: { id }, data: { processingStatus: "processing", errorMessage: null, modelIdentifier: fakeEnabled() ? "fake" : GEMINI_MODEL } });
  const translate = translator();

  for (;;) {
    const pending = await db.bookTranslationPage.findMany({
      where: { translationId: id, status: "pending" },
      orderBy: { pageNumber: "asc" },
      select: { pageNumber: true, attempts: true },
    });
    if (!pending.length) break;

    // Pages that already failed once go alone, so one hard page can't sink its neighbours.
    const size = pending[0].attempts > 0 ? 1 : CHUNK_PAGES;
    let run = planChunks(pending.filter((p) => (p.attempts > 0) === (pending[0].attempts > 0)).map((p) => p.pageNumber), size)[0];

    let chunk = await extractPages(doc, run[0], run[run.length - 1]);
    while (chunk.length > MAX_CHUNK_BYTES && run.length > 1) {
      run = run.slice(0, Math.ceil(run.length / 2));
      chunk = await extractPages(doc, run[0], run[run.length - 1]);
    }
    const first = run[0];
    const last = run[run.length - 1];

    let got = new Map<number, string>();
    let failure = "No answer from Gemini.";
    try {
      if (chunk.length > MAX_CHUNK_BYTES) throw new BookTranslationError("This page is too large to send for translation.");
      const res = await translate(chunk.toString("base64"), first, last, t.instructions);
      if (res?.text) {
        got = parsePageBlocks(res.text, first, last, res.finishReason === "MAX_TOKENS");
        if (got.size < run.length) {
          // Kept in the server log so a format the parser doesn't know can be diagnosed.
          console.error(`[book-translation] pages ${first}-${last}: matched ${got.size}/${run.length} (finish ${res.finishReason}). Answer starts: ${JSON.stringify(res.text.slice(0, 400))}`);
        }
        failure = res.finishReason === "MAX_TOKENS" ? "The answer was cut off." : "This page was missing from Gemini's answer.";
      }
    } catch (err) {
      if (err instanceof GeminiQuotaError) return finish(id, QUOTA);
      failure = err instanceof BookTranslationError ? err.message
        : err instanceof Error && err.name === "TimeoutError" ? "Gemini took too long to answer." : "The request to Gemini failed.";
      if (!(err instanceof BookTranslationError)) console.error("[book-translation] chunk failed:", err);
    }

    // Stop quietly if the job was deleted meanwhile.
    if (!(await db.bookTranslation.findUnique({ where: { id }, select: { id: true } }))) return;

    await db.$transaction(run.map((pageNumber) => {
      const text = got.get(pageNumber);
      const attempts = (pending.find((p) => p.pageNumber === pageNumber)?.attempts ?? 0) + 1;
      return db.bookTranslationPage.update({
        where: { translationId_pageNumber: { translationId: id, pageNumber } },
        data: text
          ? { status: "done", generatedText: text, error: null, attempts }
          : { status: attempts >= MAX_PAGE_ATTEMPTS || failure.includes("too large") ? "failed" : "pending", error: failure, attempts },
      });
    }));
    await db.bookTranslation.update({ where: { id }, data: { updatedAt: new Date() } });
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  await finish(id, null);
}

// ---------------------------------------------------------------- actions

async function nextVersionNumber(pdfId: string) {
  const max = await db.bookTranslation.aggregate({ where: { pdfId }, _max: { versionNumber: true } });
  return (max._max.versionNumber ?? 0) + 1;
}

async function assertNoActiveJob(pdfId: string) {
  const active = await db.bookTranslation.findFirst({ where: { pdfId, processingStatus: { in: ["queued", "processing"] } } });
  if (active) throw new BookTranslationError(`Version ${active.versionNumber} is still being translated — wait for it to finish.`);
}

/** Translate / Regenerate: always a fresh version made from the original PDF (current file). */
export async function startTranslation(pdfId: string, adminId: string, instructions?: string | null) {
  const available = await translationAvailable();
  if (!available.ok) throw new BookTranslationError(available.reason!);
  const pdf = await db.bookPdf.findUnique({ where: { id: pdfId }, include: { files: true } });
  if (!pdf) throw new BookTranslationError("PDF not found");
  const file = pdf.files.find((f) => f.version === pdf.currentVersion);
  if (!file) throw new BookTranslationError("The PDF file is missing — upload it again.");
  await assertNoActiveJob(pdfId);

  const created = await db.bookTranslation.create({
    data: {
      pdfId, sourceVersion: file.version, versionNumber: await nextVersionNumber(pdfId), method: "gemini",
      instructions: instructions?.trim().slice(0, 1000) || null, processingStatus: "queued", reviewStatus: "pending_review",
      createdById: adminId,
      pages: { create: Array.from({ length: file.pageCount }, (_, i) => ({ pageNumber: i + 1 })) },
    },
  });
  kickBookTranslationWorker();
  return created;
}

async function loadEditable(id: string) {
  const t = await db.bookTranslation.findUnique({ where: { id }, include: { pdf: { select: { currentVersion: true } } } });
  if (!t) throw new BookTranslationError("Translation not found");
  if (t.reviewStatus === "confirmed") throw new BookTranslationError("This version is confirmed and can't be changed. Start a new draft from it instead.");
  if (t.processingStatus === "queued" || t.processingStatus === "processing") throw new BookTranslationError("Wait for the translation to finish first.");
  return t;
}

/** Sends only the pages that failed (or never came back) to Gemini again, in the same version. */
export async function retryFailedPages(id: string) {
  const t = await loadEditable(id);
  if (t.method !== "gemini") throw new BookTranslationError("This draft was copied from another version — use Regenerate for a fresh translation.");
  const available = await translationAvailable();
  if (!available.ok) throw new BookTranslationError(available.reason!);
  await assertNoActiveJob(t.pdfId);
  const { count } = await db.bookTranslationPage.updateMany({
    where: { translationId: id, status: { not: "done" } },
    data: { status: "pending", attempts: 0, error: null },
  });
  if (!count) throw new BookTranslationError("Every page is already translated.");
  await db.bookTranslation.update({ where: { id }, data: { processingStatus: "queued", errorMessage: null } });
  kickBookTranslationWorker();
}

/** Saves proofread text. A page set back to exactly the generated text counts as unedited. */
export async function savePageEdits(id: string, edits: { pageNumber: number; text: string }[], adminId: string) {
  const t = await loadEditable(id);
  const pages = await db.bookTranslationPage.findMany({ where: { translationId: id } });
  const byNumber = new Map(pages.map((p) => [p.pageNumber, p]));
  const ops: ReturnType<typeof db.bookTranslationPage.update>[] = [];
  for (const e of edits) {
    const page = byNumber.get(e.pageNumber);
    if (!page || typeof e.text !== "string") continue;
    const text = e.text.replace(/\r\n/g, "\n").slice(0, 200_000);
    const reviewedText = text.trim() === (page.generatedText ?? "").trim() ? null : text;
    ops.push(db.bookTranslationPage.update({ where: { id: page.id }, data: { reviewedText } }));
  }
  if (!ops.length) throw new BookTranslationError("Nothing to save");
  await db.$transaction([
    ...ops,
    db.bookTranslation.update({
      where: { id },
      data: { editedById: adminId, editedAt: new Date(), reviewStatus: t.reviewStatus === "pending_review" ? "in_review" : t.reviewStatus },
    }),
  ]);
}

/** What confirming would knowingly accept — shown in the confirm dialog. */
export async function confirmationChecks(id: string) {
  const pages = await db.bookTranslationPage.findMany({ where: { translationId: id }, orderBy: { pageNumber: "asc" } });
  const missing = pages.filter((p) => !(p.reviewedText ?? p.generatedText)?.trim()).map((p) => p.pageNumber);
  const markers = pages.reduce((n, p) => n + countReviewMarkers(p.reviewedText ?? p.generatedText ?? ""), 0);
  return { totalPages: pages.length, missingPages: missing, missingLabel: formatPageRanges(missing), markers };
}

export async function confirmTranslation(id: string, adminId: string, acceptWarnings: boolean) {
  const t = await loadEditable(id);
  if (t.sourceVersion !== t.pdf.currentVersion) throw new BookTranslationError("This translation was made from an older file. Translate the current file instead.");
  const checks = await confirmationChecks(id);
  if (checks.missingPages.length === checks.totalPages) throw new BookTranslationError("The translation has no content to confirm.");
  if ((checks.missingPages.length || checks.markers) && !acceptWarnings) {
    throw new BookTranslationError("This translation has missing pages or passages marked for review — confirm again to accept them.");
  }
  await db.bookTranslation.update({
    where: { id },
    data: { reviewStatus: "confirmed", confirmedById: adminId, confirmedAt: new Date() },
  });
}

export async function markChangesRequired(id: string, note: string | null, adminId: string) {
  await loadEditable(id);
  await db.bookTranslation.update({
    where: { id },
    data: { reviewStatus: "changes_required", reviewNote: note?.trim().slice(0, 1000) || null, editedById: adminId, editedAt: new Date() },
  });
}

/** Further changes to a confirmed (or any) version: a new version copied from it — the original stays as it was. */
export async function newDraftFrom(id: string, adminId: string) {
  const src = await db.bookTranslation.findUnique({ where: { id }, include: { pages: true, pdf: { select: { currentVersion: true } } } });
  if (!src) throw new BookTranslationError("Translation not found");
  if (src.sourceVersion !== src.pdf.currentVersion) throw new BookTranslationError("This translation was made from an older file. Translate the current file instead.");
  if (src.processingStatus === "queued" || src.processingStatus === "processing") throw new BookTranslationError("Wait for the translation to finish first.");
  await assertNoActiveJob(src.pdfId);
  return db.bookTranslation.create({
    data: {
      pdfId: src.pdfId, sourceVersion: src.sourceVersion, versionNumber: await nextVersionNumber(src.pdfId),
      method: "copy", basedOnVersion: src.versionNumber, modelIdentifier: src.modelIdentifier, instructions: src.instructions,
      processingStatus: src.processingStatus, reviewStatus: "in_review", errorMessage: src.errorMessage,
      generatedAt: src.generatedAt, createdById: adminId,
      pages: {
        create: src.pages.map((p) => ({
          pageNumber: p.pageNumber, status: p.status, generatedText: p.generatedText, reviewedText: p.reviewedText, error: p.error, attempts: p.attempts,
        })),
      },
    },
  });
}
