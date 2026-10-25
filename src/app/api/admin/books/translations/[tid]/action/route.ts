import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, logBooks } from "@/lib/book-api";
import { confirmTranslation, retryFailedPages, markChangesRequired, newDraftFrom } from "@/lib/book-translation";

/** Review actions on one version: confirm | retry | changes_required | new_draft. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  return withAdmin(req, async (session) => {
    const { tid } = await params;
    const body = await req.json().catch(() => ({}));
    const t = await db.bookTranslation.findUnique({ where: { id: tid }, select: { versionNumber: true, pdf: { select: { pdfCode: true, title: true } } } });
    if (!t) return NextResponse.json({ error: "Translation not found" }, { status: 404 });
    const label = `${t.pdf.pdfCode} "${t.pdf.title}" v${t.versionNumber}`;

    switch (body.action) {
      case "confirm":
        await confirmTranslation(tid, session.admin.id, body.acceptWarnings === true);
        await logBooks(req, session, "book_translation_confirmed", `Confirmed the English translation ${label}`);
        return NextResponse.json({ ok: true });
      case "retry":
        await retryFailedPages(tid);
        await logBooks(req, session, "book_translation_retried", `Retried missing pages of ${label}`);
        return NextResponse.json({ ok: true });
      case "changes_required":
        await markChangesRequired(tid, typeof body.note === "string" ? body.note : null, session.admin.id);
        await logBooks(req, session, "book_translation_changes_required", `Marked ${label} as needing changes`);
        return NextResponse.json({ ok: true });
      case "new_draft": {
        const draft = await newDraftFrom(tid, session.admin.id);
        await logBooks(req, session, "book_translation_draft", `Started draft v${draft.versionNumber} from ${label}`);
        return NextResponse.json({ translation: draft });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  });
}
