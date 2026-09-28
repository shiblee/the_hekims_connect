import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const group = searchParams.get("group") || undefined;
  const q = searchParams.get("q")?.trim() || undefined;

  const keys = await db.translationKey.findMany({
    where: {
      group,
      ...(q ? { OR: [{ key: { contains: q } }, { sourceText: { contains: q } }] } : {}),
    },
    orderBy: { key: "asc" },
    include: { values: { select: { languageCode: true, status: true } } },
  });

  const groups = await db.translationKey.findMany({ distinct: ["group"], select: { group: true } });

  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      key: k.key,
      group: k.group,
      sourceText: k.sourceText,
      statuses: Object.fromEntries(k.values.map((v) => [v.languageCode, v.status])),
    })),
    groups: groups.map((g) => g.group),
  });
}
