import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const symptoms = await db.acuteSymptomTag.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ symptoms });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { label, description } = await req.json();
  if (!label || !String(label).trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const existing = await db.acuteSymptomTag.findUnique({ where: { label: String(label).trim() } });
  if (existing) return NextResponse.json({ error: "This symptom already exists" }, { status: 409 });

  const maxOrder = await db.acuteSymptomTag.aggregate({ _max: { sortOrder: true } });
  const symptom = await db.acuteSymptomTag.create({
    data: {
      label: String(label).trim(), description: description ? String(description).trim() : null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ symptom });
}
