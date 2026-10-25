import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAdmin } from "@/lib/book-api";
import { ensureBookTypeSection } from "@/lib/books";

/** Book types from Meta — all of them (inactive ones are marked; the form offers only active ones). */
export async function GET(req: NextRequest) {
  return withAdmin(req, async () => {
    const section = await ensureBookTypeSection();
    const types = await db.metadataOption.findMany({
      where: { sectionId: section.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, label: true, active: true },
    });
    return NextResponse.json({ types, sectionKey: section.key });
  });
}
