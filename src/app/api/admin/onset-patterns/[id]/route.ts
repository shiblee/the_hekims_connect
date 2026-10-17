import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });
    const clash = await db.onsetPatternTag.findFirst({ where: { label, id: { not: id } } });
    if (clash) return NextResponse.json({ error: "This option already exists" }, { status: 409 });
    data.label = label;
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.active !== undefined) data.active = !!body.active;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10);

  const pattern = await db.onsetPatternTag.update({ where: { id }, data });
  return NextResponse.json({ pattern });
}
