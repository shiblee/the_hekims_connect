import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, logBooks, getPdfOr404 } from "@/lib/book-api";
import { deleteBookFile, bookStorageMode } from "@/lib/book-storage";
import { translationAvailable } from "@/lib/book-translation";
import { PDF_TITLE_MAX, cleanLine, pdfTranslationSummary } from "@/lib/books";

type Ctx = { params: Promise<{ pdfId: string }> };
const who = { select: { id: true, name: true } };

/** A PDF with its file versions and its translation history (without page text). */
export async function GET(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async () => {
    const { pdfId } = await params;
    const pdf = await db.bookPdf.findUnique({
      where: { id: pdfId },
      include: {
        book: { select: { id: true, title: true, bookCode: true } },
        files: { orderBy: { version: "desc" }, include: { uploadedBy: who } },
        translations: {
          orderBy: { versionNumber: "desc" },
          include: { createdBy: who, editedBy: who, confirmedBy: who, pages: { select: { status: true, reviewedText: true } } },
        },
      },
    });
    if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    const { files, translations, ...rest } = pdf;
    const ai = await translationAvailable();
    return NextResponse.json({
      pdf: {
        ...rest,
        files: files.map(({ storageKey: _key, ...f }) => f),
        summary: pdfTranslationSummary(translations, pdf.currentVersion),
        translations: translations.map(({ pages, ...t }) => ({
          ...t,
          pagesTotal: pages.length,
          pagesDone: pages.filter((p) => p.status === "done").length,
          pagesFailed: pages.filter((p) => p.status === "failed").length,
          pagesEdited: pages.filter((p) => p.reviewedText !== null).length,
        })),
      },
      ai,
      storage: bookStorageMode(),
    });
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async (session) => {
    const { pdfId } = await params;
    const pdf = await getPdfOr404(pdfId);
    if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const title = cleanLine(body.title, PDF_TITLE_MAX + 1);
    if (title.length < 1 || title.length > PDF_TITLE_MAX) return NextResponse.json({ error: `Enter the PDF title (up to ${PDF_TITLE_MAX} characters).` }, { status: 400 });
    const updated = await db.bookPdf.update({ where: { id: pdfId }, data: { title } });
    await logBooks(req, session, "book_pdf_updated", `Renamed ${pdf.pdfCode} to "${title}"`);
    return NextResponse.json({ pdf: updated });
  });
}

/** Deletes a PDF, its files and its drafts — refused once any translation of it is confirmed. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async (session) => {
    const { pdfId } = await params;
    const pdf = await db.bookPdf.findUnique({
      where: { id: pdfId },
      include: { files: { select: { storageKey: true } }, translations: { select: { reviewStatus: true, processingStatus: true } }, book: { select: { bookCode: true } } },
    });
    if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    if (pdf.translations.some((t) => t.reviewStatus === "confirmed")) {
      return NextResponse.json({ error: "This PDF has a confirmed translation, so it is kept for the record and can't be deleted." }, { status: 409 });
    }
    if (pdf.translations.some((t) => t.processingStatus === "queued" || t.processingStatus === "processing")) {
      return NextResponse.json({ error: "This PDF is being translated right now — wait for it to finish first." }, { status: 409 });
    }
    await db.bookPdf.delete({ where: { id: pdfId } });
    await Promise.all(pdf.files.map((f) => deleteBookFile(f.storageKey).catch((err) => console.error("[books] file delete failed:", f.storageKey, err))));
    await logBooks(req, session, "book_pdf_deleted", `Deleted ${pdf.pdfCode} "${pdf.title}" from ${pdf.book.bookCode}`);
    return NextResponse.json({ ok: true });
  });
}
