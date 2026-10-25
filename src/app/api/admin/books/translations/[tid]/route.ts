import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, logBooks } from "@/lib/book-api";
import { savePageEdits, confirmationChecks } from "@/lib/book-translation";

type Ctx = { params: Promise<{ tid: string }> };
const who = { select: { id: true, name: true } };

/** One translation version with every page's generated and proofread text. */
export async function GET(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async () => {
    const { tid } = await params;
    const t = await db.bookTranslation.findUnique({
      where: { id: tid },
      include: {
        pages: { orderBy: { pageNumber: "asc" } },
        createdBy: who, editedBy: who, confirmedBy: who,
        pdf: { select: { id: true, currentVersion: true } },
      },
    });
    if (!t) return NextResponse.json({ error: "Translation not found" }, { status: 404 });
    return NextResponse.json({ translation: t, checks: await confirmationChecks(tid) });
  });
}

/** Save proofread pages: { pages: [{ pageNumber, text }] }. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async (session) => {
    const { tid } = await params;
    const body = await req.json().catch(() => ({}));
    const edits = Array.isArray(body.pages)
      ? body.pages.filter((p: any) => Number.isInteger(p?.pageNumber) && typeof p?.text === "string")
      : [];
    await savePageEdits(tid, edits, session.admin.id);
    const t = await db.bookTranslation.findUnique({ where: { id: tid }, select: { versionNumber: true, pdf: { select: { pdfCode: true } } } });
    await logBooks(req, session, "book_translation_edited", `Proofread ${edits.length} page${edits.length === 1 ? "" : "s"} of ${t?.pdf.pdfCode} v${t?.versionNumber}`);
    return NextResponse.json({ ok: true });
  });
}
