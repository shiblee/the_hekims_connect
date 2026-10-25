import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin, logBooks } from "@/lib/book-api";
import { BOOK_DESCRIPTION_MAX, BOOK_TITLE_MAX, cleanLine, cleanText, ensureBookTypeSection, nextBookCode } from "@/lib/books";

const PAGE_SIZE = 20;

/** Books list — search by title/code/description, filter by type and status, paginated. */
export async function GET(req: NextRequest) {
  return withAdmin(req, async () => {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim();
    const typeId = sp.get("typeId") || "";
    const status = sp.get("status") || "";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const where = {
      ...(q ? { OR: [{ title: { contains: q } }, { bookCode: { contains: q } }, { description: { contains: q } }] } : {}),
      ...(typeId ? { bookTypeId: typeId } : {}),
      ...(status === "active" ? { active: true } : status === "inactive" ? { active: false } : {}),
    };
    const [total, books] = await Promise.all([
      db.book.count({ where }),
      db.book.findMany({
        where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
        include: {
          bookType: { select: { id: true, label: true, active: true } },
          createdBy: { select: { id: true, name: true } },
          pdfs: { select: { currentVersion: true, translations: { select: { sourceVersion: true, reviewStatus: true } } } },
        },
      }),
    ]);
    return NextResponse.json({
      total, page, pageSize: PAGE_SIZE,
      books: books.map(({ pdfs, ...b }) => ({
        ...b,
        pdfCount: pdfs.length,
        // PDFs whose current file has a confirmed English translation.
        confirmedCount: pdfs.filter((p) => p.translations.some((t) => t.reviewStatus === "confirmed" && t.sourceVersion === p.currentVersion)).length,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAdmin(req, async (session) => {
    const body = await req.json().catch(() => ({}));
    const title = cleanLine(body.title, BOOK_TITLE_MAX + 1);
    const description = cleanText(body.description, BOOK_DESCRIPTION_MAX + 1);
    if (title.length < 2) return NextResponse.json({ error: "Enter the book title (at least 2 characters)." }, { status: 400 });
    if (title.length > BOOK_TITLE_MAX) return NextResponse.json({ error: `The title can be at most ${BOOK_TITLE_MAX} characters.` }, { status: 400 });
    if (description.length > BOOK_DESCRIPTION_MAX) return NextResponse.json({ error: `The description can be at most ${BOOK_DESCRIPTION_MAX} characters.` }, { status: 400 });

    const section = await ensureBookTypeSection();
    const type = typeof body.bookTypeId === "string"
      ? await db.metadataOption.findFirst({ where: { id: body.bookTypeId, sectionId: section.id } })
      : null;
    if (!type) return NextResponse.json({ error: "Choose the book type." }, { status: 400 });
    if (!type.active) return NextResponse.json({ error: `The book type "${type.label}" is switched off — choose another.` }, { status: 400 });

    const book = await db.book.create({
      data: {
        bookCode: await nextBookCode(), title, description: description || null, bookTypeId: type.id,
        active: body.active !== false, createdById: session.admin.id,
      },
    });
    await logBooks(req, session, "book_created", `Added book ${book.bookCode} "${book.title}"`);
    return NextResponse.json({ book });
  });
}
