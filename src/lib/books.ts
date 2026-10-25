import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import type { ProcessingStatus, ReviewStatus } from "@/lib/book-translation-core";

// Book types are a regular Meta section, so Admin → Meta adds, renames and
// switches them off like any other list. Created on first use with a few
// starting types; after that the admin owns the list.
export const BOOK_TYPE_SECTION = {
  key: "book_type",
  label: "Book Type",
  category: "Books",
  options: ["Classical Text", "Pharmacopoeia", "Textbook", "Research / Journal", "Reference / Dictionary", "Other"],
};

export async function ensureBookTypeSection() {
  const existing = await db.metadataSection.findUnique({ where: { key: BOOK_TYPE_SECTION.key } });
  if (existing) return existing;
  const max = await db.metadataSection.aggregate({ _max: { sortOrder: true } });
  return db.metadataSection.create({
    data: {
      key: BOOK_TYPE_SECTION.key, label: BOOK_TYPE_SECTION.label, category: BOOK_TYPE_SECTION.category,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      options: { create: BOOK_TYPE_SECTION.options.map((label, i) => ({ label, sortOrder: i })) },
    },
  });
}

export const BOOK_TITLE_MAX = 200;
export const BOOK_DESCRIPTION_MAX = 2000;
export const PDF_TITLE_MAX = 200;

/** Upload limit in MB — PortalSetting books/max_upload_mb (default 100). */
export async function maxUploadBytes() {
  const mb = parseInt(await getSetting("books", "max_upload_mb", "100"), 10) || 100;
  return mb * 1024 * 1024;
}

// Short running numbers — BK3, BP12 (same convention as lib/codes.ts).
export async function nextBookCode() {
  for (let i = 0; i < 5; i++) {
    const code = `BK${(await db.book.count()) + 1 + i}`;
    if (!(await db.book.findUnique({ where: { bookCode: code } }))) return code;
  }
  throw new Error("Could not generate a unique book code");
}

export async function nextPdfCode() {
  for (let i = 0; i < 5; i++) {
    const code = `BP${(await db.bookPdf.count()) + 1 + i}`;
    if (!(await db.bookPdf.findUnique({ where: { pdfCode: code } }))) return code;
  }
  throw new Error("Could not generate a unique PDF code");
}

/** Collapses runs of spaces and trims — titles are single-line. */
export function cleanLine(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function cleanText(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, max) : "";
}

type TranslationLite = {
  id: string; versionNumber: number; sourceVersion: number;
  processingStatus: string; reviewStatus: string; confirmedAt: Date | null;
};

/** What a PDF's list row shows: the newest version's two statuses and the approved version, if any. */
export function pdfTranslationSummary(translations: TranslationLite[], currentVersion: number) {
  const sorted = [...translations].sort((a, b) => b.versionNumber - a.versionNumber);
  const latest = sorted[0];
  const approved = sorted.find((t) => t.reviewStatus === "confirmed" && t.sourceVersion === currentVersion) ?? null;
  return {
    processingStatus: (latest?.processingStatus ?? "not_started") as ProcessingStatus,
    reviewStatus: (latest ? latest.reviewStatus : null) as ReviewStatus | null,
    latestVersion: latest?.versionNumber ?? null,
    latestId: latest?.id ?? null,
    // The newest translation was made from an older file — a new one is needed.
    outdated: !!latest && latest.sourceVersion !== currentVersion,
    approvedVersion: approved?.versionNumber ?? null,
    versionCount: translations.length,
  };
}
