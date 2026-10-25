import { NextRequest, NextResponse } from "next/server";
import { withAdmin, logBooks, getPdfOr404 } from "@/lib/book-api";
import { startTranslation } from "@/lib/book-translation";

/** Translate to English / Regenerate — a new version made from the original PDF. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ pdfId: string }> }) {
  return withAdmin(req, async (session) => {
    const { pdfId } = await params;
    const pdf = await getPdfOr404(pdfId);
    if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const t = await startTranslation(pdfId, session.admin.id, typeof body.instructions === "string" ? body.instructions : null);
    await logBooks(req, session, "book_translation_started", `Started English translation v${t.versionNumber} of ${pdf.pdfCode} "${pdf.title}"`);
    return NextResponse.json({ translation: t });
  });
}
