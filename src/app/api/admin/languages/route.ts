import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const languages = await db.language.findMany({ orderBy: { sortOrder: "asc" } });
  const totalKeys = await db.translationKey.count();
  const publishedCounts = await db.translationValue.groupBy({
    by: ["languageCode"],
    where: { status: "published" },
    _count: { _all: true },
  });
  const countByCode = new Map(publishedCounts.map((r) => [r.languageCode, r._count._all]));

  return NextResponse.json({
    languages: languages.map((l) => ({ ...l, publishedCount: countByCode.get(l.code) ?? 0, totalKeys })),
  });
}
