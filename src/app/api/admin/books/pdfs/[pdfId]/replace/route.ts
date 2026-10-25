import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, logBooks, receivePdf, getPdfOr404 } from "@/lib/book-api";
import { deleteBookFile } from "@/lib/book-storage";

/**
 * Replace the PDF with a corrected file. The old file and every translation
 * made from it are kept (they stay linked to the old file version); the new
 * file needs a new translation.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ pdfId: string }> }) {
  return withAdmin(req, async (session) => {
    const { pdfId } = await params;
    const pdf = await getPdfOr404(pdfId);
    if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    const active = await db.bookTranslation.findFirst({ where: { pdfId, processingStatus: { in: ["queued", "processing"] } } });
    if (active) return NextResponse.json({ error: "This PDF is being translated right now — wait for it to finish first." }, { status: 409 });

    const { file } = await receivePdf(req);
    const version = pdf.currentVersion + 1;
    try {
      await db.$transaction([
        db.bookPdfFile.create({ data: { pdfId, version, ...file, uploadedById: session.admin.id } }),
        db.bookPdf.update({ where: { id: pdfId }, data: { currentVersion: version } }),
      ]);
    } catch (err) {
      await deleteBookFile(file.storageKey).catch(() => {});
      throw err;
    }
    await logBooks(req, session, "book_pdf_replaced", `Replaced the file of ${pdf.pdfCode} "${pdf.title}" (file v${version}, ${file.pageCount} pages)`);
    return NextResponse.json({ ok: true, version });
  });
}
