import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin } from "@/lib/book-api";
import { getBookFile } from "@/lib/book-storage";

/** The original PDF (current file, or ?version=n), streamed only to a signed-in admin. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ pdfId: string }> }) {
  return withAdmin(req, async () => {
    const { pdfId } = await params;
    const pdf = await db.bookPdf.findUnique({ where: { id: pdfId }, select: { currentVersion: true } });
    if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    const version = parseInt(req.nextUrl.searchParams.get("version") || "", 10) || pdf.currentVersion;
    const file = await db.bookPdfFile.findUnique({ where: { pdfId_version: { pdfId, version } } });
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
    const data = await getBookFile(file.storageKey);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(data.length),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalFilename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
