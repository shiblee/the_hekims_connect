import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const options = await db.metadataOption.findMany({ where: { sectionId: id }, orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ options });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { label } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const maxOrder = await db.metadataOption.aggregate({ where: { sectionId: id }, _max: { sortOrder: true } });
  const option = await db.metadataOption.create({
    data: { sectionId: id, label: String(label).trim(), sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ option });
}
