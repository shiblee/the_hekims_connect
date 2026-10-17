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
  if (body.active !== undefined) data.active = !!body.active;
  if (body.sortOrder !== undefined) data.sortOrder = parseInt(body.sortOrder, 10);

  const before = await db.complaintFactorTag.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.label && data.label !== before.label) {
    const clash = await db.complaintFactorTag.findUnique({ where: { kind_label: { kind: before.kind, label: data.label as string } } });
    if (clash) return NextResponse.json({ error: "This factor already exists" }, { status: 409 });
  }

  const factorTag = await db.$transaction(async (tx) => {
    const updated = await tx.complaintFactorTag.update({ where: { id }, data });
    // Humoral weight rules reference factors by label — carry the rule over
    // on rename so the factor keeps its Safra/Dam/Sauda/Balgham weighting.
    if (data.label && data.label !== before.label) {
      const target = await tx.humorWeightRule.findUnique({ where: { sourceType_sourceValue: { sourceType: "factor", sourceValue: data.label as string } } });
      const otherUsesOldLabel = await tx.complaintFactorTag.count({ where: { label: before.label, id: { not: id } } });
      if (!target && !otherUsesOldLabel) {
        await tx.humorWeightRule.updateMany({ where: { sourceType: "factor", sourceValue: before.label }, data: { sourceValue: data.label as string } });
      }
    }
    return updated;
  });
  return NextResponse.json({ factorTag });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  await db.complaintFactorTag.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
