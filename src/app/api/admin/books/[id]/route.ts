import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, logBooks } from "@/lib/book-api";
import { BOOK_DESCRIPTION_MAX, BOOK_TITLE_MAX, cleanLine, cleanText, ensureBookTypeSection, pdfTranslationSummary } from "@/lib/books";

type Ctx = { params: Promise<{ id: string }> };

/** One book with its PDFs and each PDF's translation status. */
export async function GET(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async () => {
    const { id } = await params;
    const book = await db.book.findUnique({
      where: { id },
      include: {
        bookType: { select: { id: true, label: true, active: true } },
        createdBy: { select: { id: true, name: true } },
        pdfs: {
          orderBy: { createdAt: "asc" },
          include: {
            files: { orderBy: { version: "desc" }, select: { version: true, originalFilename: true, fileSize: true, pageCount: true, createdAt: true } },
            translations: { select: { id: true, versionNumber: true, sourceVersion: true, processingStatus: true, reviewStatus: true, confirmedAt: true } },
          },
        },
      },
    });
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    const { pdfs, ...rest } = book;
    return NextResponse.json({
      book: {
        ...rest,
        pdfs: pdfs.map(({ files, translations, ...p }) => ({
          ...p,
          file: files.find((f) => f.version === p.currentVersion) ?? null,
          translation: pdfTranslationSummary(translations, p.currentVersion),
        })),
      },
    });
  });
}

/** Edit title / description / type / status. PDFs and translations are untouched. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async (session) => {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id } });
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const data: { title?: string; description?: string | null; bookTypeId?: string; active?: boolean } = {};

    if (body.title !== undefined) {
      const title = cleanLine(body.title, BOOK_TITLE_MAX + 1);
      if (title.length < 2) return NextResponse.json({ error: "Enter the book title (at least 2 characters)." }, { status: 400 });
      if (title.length > BOOK_TITLE_MAX) return NextResponse.json({ error: `The title can be at most ${BOOK_TITLE_MAX} characters.` }, { status: 400 });
      data.title = title;
    }
    if (body.description !== undefined) {
      const description = cleanText(body.description, BOOK_DESCRIPTION_MAX + 1);
      if (description.length > BOOK_DESCRIPTION_MAX) return NextResponse.json({ error: `The description can be at most ${BOOK_DESCRIPTION_MAX} characters.` }, { status: 400 });
      data.description = description || null;
    }
    // Keeping a type that has since been switched off is fine; choosing one is not.
    if (typeof body.bookTypeId === "string" && body.bookTypeId !== book.bookTypeId) {
      const section = await ensureBookTypeSection();
      const type = await db.metadataOption.findFirst({ where: { id: body.bookTypeId, sectionId: section.id } });
      if (!type) return NextResponse.json({ error: "Choose the book type." }, { status: 400 });
      if (!type.active) return NextResponse.json({ error: `The book type "${type.label}" is switched off — choose another.` }, { status: 400 });
      data.bookTypeId = type.id;
    }
    if (typeof body.active === "boolean") data.active = body.active;
    if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

    const updated = await db.book.update({ where: { id }, data });
    await logBooks(req, session, "book_updated", `Edited book ${updated.bookCode} "${updated.title}"`);
    return NextResponse.json({ book: updated });
  });
}

/** Only an empty book can be deleted — a book with PDFs is switched to Inactive instead. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async (session) => {
    const { id } = await params;
    const book = await db.book.findUnique({ where: { id }, include: { _count: { select: { pdfs: true } } } });
    if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
    if (book._count.pdfs) {
      return NextResponse.json({ error: "This book still has PDFs. Delete its PDFs first, or set the book to Inactive to keep its history." }, { status: 409 });
    }
    await db.book.delete({ where: { id } });
    await logBooks(req, session, "book_deleted", `Deleted book ${book.bookCode} "${book.title}"`);
    return NextResponse.json({ ok: true });
  });
}
