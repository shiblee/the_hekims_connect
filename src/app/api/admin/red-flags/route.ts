import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const criteria = await db.redFlagCriterion.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ criteria });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label, description } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const baseKey = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  let key = baseKey;
  let suffix = 2;
  while (await db.redFlagCriterion.findUnique({ where: { key } })) {
    key = `${baseKey}_${suffix}`;
    suffix++;
  }

  const maxOrder = await db.redFlagCriterion.aggregate({ _max: { sortOrder: true } });
  const criterion = await db.redFlagCriterion.create({
    data: {
      key, label: String(label).trim(), description: description ? String(description).trim() : null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ criterion });
}
