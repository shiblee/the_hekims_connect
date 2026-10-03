import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const { label, sortOrder } = await req.json();
  const data: { label?: string; sortOrder?: number } = {};
  if (typeof label === "string" && label.trim()) data.label = label;
  if (typeof sortOrder === "number") data.sortOrder = sortOrder;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const section = await db.metadataSection.update({ where: { id }, data });
  return NextResponse.json({ section });
}
