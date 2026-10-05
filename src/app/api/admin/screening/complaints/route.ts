import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const complaints = await db.chiefComplaint.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ complaints });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label, labelLocal, category } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const baseKey = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseKey) {
    return NextResponse.json({ error: "Could not derive a key from this label" }, { status: 400 });
  }
  let key = baseKey;
  let suffix = 2;
  while (await db.chiefComplaint.findUnique({ where: { key } })) {
    key = `${baseKey}_${suffix}`;
    suffix++;
  }

  const maxOrder = await db.chiefComplaint.aggregate({ _max: { sortOrder: true } });
  const complaint = await db.chiefComplaint.create({
    data: {
      key, label: String(label).trim(), labelLocal: labelLocal || null,
      category: category && String(category).trim() ? String(category).trim() : "General",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ complaint });
}
