import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { label, active, sortOrder } = await req.json();
  const data: { label?: string; active?: boolean; sortOrder?: number } = {};
  if (typeof label === "string" && label.trim()) data.label = label.trim();
  if (typeof active === "boolean") data.active = active;
  if (typeof sortOrder === "number") data.sortOrder = sortOrder;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (data.label) {
    const current = await db.metadataOption.findUnique({ where: { id }, select: { sectionId: true } });
    const siblings = current ? await db.metadataOption.findMany({ where: { sectionId: current.sectionId, id: { not: id } }, select: { label: true } }) : [];
    if (siblings.some((o) => o.label.trim().toLowerCase() === data.label!.toLowerCase())) {
      return NextResponse.json({ error: `"${data.label}" is already in this list` }, { status: 409 });
    }
  }

  const option = await db.metadataOption.update({ where: { id }, data });
  return NextResponse.json({ option });
}
