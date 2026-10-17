import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const manifestations = await db.complaintManifestation.findMany({ orderBy: [{ chiefComplaintId: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ manifestations });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { chiefComplaintId, label, labelLocal } = await req.json();
  if (!chiefComplaintId) return NextResponse.json({ error: "A chief complaint is required" }, { status: 400 });
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const baseKey = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!baseKey) return NextResponse.json({ error: "Could not derive a key from this label" }, { status: 400 });
  let key = baseKey;
  let suffix = 2;
  while (await db.complaintManifestation.findUnique({ where: { chiefComplaintId_key: { chiefComplaintId, key } } })) {
    key = `${baseKey}_${suffix}`;
    suffix++;
  }

  const maxOrder = await db.complaintManifestation.aggregate({ where: { chiefComplaintId }, _max: { sortOrder: true } });
  const manifestation = await db.complaintManifestation.create({
    data: { chiefComplaintId, key, label: String(label).trim(), labelLocal: labelLocal || null, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ manifestation });
}
