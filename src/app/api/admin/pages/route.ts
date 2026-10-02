import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const pages = await db.page.findMany({
    orderBy: { title: "asc" },
    include: { contents: { select: { languageCode: true, status: true } } },
  });

  return NextResponse.json({
    pages: pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      statuses: Object.fromEntries(p.contents.map((c) => [c.languageCode, c.status])),
    })),
  });
}
