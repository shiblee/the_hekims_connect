import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { enrichSupplementTags } from "@/lib/supplement-enrichment";

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

  const before = await db.medicationTag.findUnique({ where: { id }, select: { label: true } });
  const medication = await db.medicationTag.update({ where: { id }, data });
  // A renamed record's profile describes the old name — rebuild it.
  if ((medication.kind === "supplement" || medication.kind === "medication") && before && before.label !== medication.label) {
    void enrichSupplementTags([medication.id], medication.kind).catch(() => {});
  }
  return NextResponse.json({ medication });
}
