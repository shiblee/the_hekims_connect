import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";

export type PdfCheck =
  | { ok: true; pageCount: number; checksum: string }
  | { ok: false; error: string };

/**
 * Server-side check of an uploaded file: real PDF signature (not just the
 * extension or the browser's type), not password-protected, parses, has pages.
 * Scanned (image-only) PDFs are fine — translation reads the page images.
 */
export async function inspectPdf(data: Buffer): Promise<PdfCheck> {
  if (data.length < 8 || data.subarray(0, 1024).indexOf("%PDF-") === -1) {
    return { ok: false, error: "This file is not a PDF." };
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return { ok: false, error: "This PDF is damaged or incomplete and can't be opened. Try saving it again and re-upload." };
  }
  if (doc.isEncrypted) {
    return { ok: false, error: "This PDF is password-protected. Remove the password (print to PDF) and upload it again." };
  }
  const pageCount = doc.getPageCount();
  if (pageCount < 1) return { ok: false, error: "This PDF has no pages." };
  return { ok: true, pageCount, checksum: createHash("sha256").update(data).digest("hex") };
}

/** Parses a stored PDF once, so a long book is not re-read for every chunk. */
export function loadPdf(data: Buffer) {
  return PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
}

/** A new PDF holding only pages first..last (1-based, inclusive) of the source. */
export async function extractPages(src: PDFDocument, first: number, last: number): Promise<Buffer> {
  const out = await PDFDocument.create();
  const indices = Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i);
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  return Buffer.from(await out.save());
}
