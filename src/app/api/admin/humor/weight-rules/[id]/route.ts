import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.safraPoints !== undefined) data.safraPoints = Number(body.safraPoints) || 0;
  if (body.damPoints !== undefined) data.damPoints = Number(body.damPoints) || 0;
  if (body.saudaPoints !== undefined) data.saudaPoints = Number(body.saudaPoints) || 0;
  if (body.balghamPoints !== undefined) data.balghamPoints = Number(body.balghamPoints) || 0;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.active !== undefined) data.active = !!body.active;

  const weightRule = await db.humorWeightRule.update({ where: { id }, data });
  return NextResponse.json({ weightRule });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  await db.humorWeightRule.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
