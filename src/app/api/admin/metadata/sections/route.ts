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

  const { key, label } = await req.json();
  if (!key || !label) {
    return NextResponse.json({ error: "Key and label are required" }, { status: 400 });
  }
  const normalizedKey = String(key).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalizedKey) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const existing = await db.metadataSection.findUnique({ where: { key: normalizedKey } });
  if (existing) {
    return NextResponse.json({ error: "A section with this key already exists" }, { status: 409 });
  }

  const maxOrder = await db.metadataSection.aggregate({ _max: { sortOrder: true } });
  const section = await db.metadataSection.create({
    data: { key: normalizedKey, label, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ section });
}
