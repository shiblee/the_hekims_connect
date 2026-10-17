import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const factorTags = await db.complaintFactorTag.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ factorTags });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { kind, label } = await req.json();
  if (kind !== "aggravating" && kind !== "relieving") {
    return NextResponse.json({ error: "kind must be \"aggravating\" or \"relieving\"" }, { status: 400 });
  }
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const existing = await db.complaintFactorTag.findUnique({ where: { kind_label: { kind, label: String(label).trim() } } });
  if (existing) return NextResponse.json({ error: "This tag already exists" }, { status: 409 });

  const maxOrder = await db.complaintFactorTag.aggregate({ where: { kind }, _max: { sortOrder: true } });
  const factorTag = await db.complaintFactorTag.create({
    data: { kind, label: String(label).trim(), sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ factorTag });
}
