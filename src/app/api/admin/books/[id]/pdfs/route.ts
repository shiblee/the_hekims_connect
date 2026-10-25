import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, logBooks, receivePdf } from "@/lib/book-api";
import { deleteBookFile } from "@/lib/book-storage";
import { PDF_TITLE_MAX, cleanLine, nextPdfCode } from "@/lib/books";

/** Upload one PDF (multipart: title + file) as a new document of this book. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAdmin(req, async (session) => {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id } });
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

    const { form, file } = await receivePdf(req);
    const title = cleanLine(form.get("title"), PDF_TITLE_MAX + 1);
    if (title.length < 1 || title.length > PDF_TITLE_MAX) {
      await deleteBookFile(file.storageKey).catch(() => {});
      return NextResponse.json({ error: `Enter the PDF title (up to ${PDF_TITLE_MAX} characters).` }, { status: 400 });
    }
    try {
      const pdf = await db.bookPdf.create({
        data: {
          pdfCode: await nextPdfCode(), bookId: id, title, currentVersion: 1,
          files: { create: { version: 1, ...file, uploadedById: session.admin.id } },
        },
      });
      await logBooks(req, session, "book_pdf_uploaded", `Uploaded ${pdf.pdfCode} "${title}" (${file.pageCount} pages) to ${book.bookCode}`);
      return NextResponse.json({ pdf });
    } catch (err) {
      await deleteBookFile(file.storageKey).catch(() => {});
      throw err;
    }
  });
}
