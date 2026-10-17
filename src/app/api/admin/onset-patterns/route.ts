import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const patterns = await db.onsetPatternTag.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ patterns });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label, description } = await req.json();
  if (!label || !String(label).trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  const existing = await db.onsetPatternTag.findUnique({ where: { label: String(label).trim() } });
  if (existing) return NextResponse.json({ error: "This option already exists" }, { status: 409 });

  const maxOrder = await db.onsetPatternTag.aggregate({ _max: { sortOrder: true } });
  const pattern = await db.onsetPatternTag.create({
    data: {
      label: String(label).trim(),
      description: description ? String(description).trim() : null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ pattern });
}
