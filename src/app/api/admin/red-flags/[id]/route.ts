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
    if (!String(body.label).trim()) return NextResponse.json({ error: "Label is required" }, { status: 400 });
    data.label = String(body.label).trim();
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;
  if (body.active !== undefined) data.active = !!body.active;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10);

  const criterion = await db.redFlagCriterion.update({ where: { id }, data });
  return NextResponse.json({ criterion });
}
