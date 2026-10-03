import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const sections = await db.metadataSection.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { options: true } } },
  });
  return NextResponse.json({ sections });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const baseKey = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseKey) {
    return NextResponse.json({ error: "Could not derive a key from this label" }, { status: 400 });
  }

  let key = baseKey;
  let suffix = 2;
  while (await db.metadataSection.findUnique({ where: { key } })) {
    key = `${baseKey}_${suffix}`;
    suffix++;
  }

  const maxOrder = await db.metadataSection.aggregate({ _max: { sortOrder: true } });
  const section = await db.metadataSection.create({
    data: { key, label, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ section });
}
