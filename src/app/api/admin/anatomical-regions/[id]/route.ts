import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ANATOMICAL_REGION_ICONS } from "@/lib/anatomical-region-icons";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });
    const clash = await db.anatomicalRegionTag.findFirst({ where: { label, id: { not: id } } });
    if (clash) return NextResponse.json({ error: "This region already exists" }, { status: 409 });
    data.label = label;
  }
  if (body.localTerms !== undefined) data.localTerms = body.localTerms ? String(body.localTerms).trim() : null;
  if (body.icon !== undefined) data.icon = ANATOMICAL_REGION_ICONS[body.icon] ? body.icon : "activity";
  if (body.active !== undefined) data.active = !!body.active;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10);

  const region = await db.anatomicalRegionTag.update({ where: { id }, data });
  return NextResponse.json({ region });
}
