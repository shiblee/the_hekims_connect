import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const SOURCE_TYPES = ["manifestation", "factor", "severity_band", "onset_pattern"];

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const weightRules = await db.humorWeightRule.findMany({ orderBy: [{ sourceType: "asc" }, { sourceValue: "asc" }] });
  return NextResponse.json({ weightRules });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { sourceType, sourceValue, safraPoints, damPoints, saudaPoints, balghamPoints, notes } = await req.json();
  if (!SOURCE_TYPES.includes(sourceType)) {
    return NextResponse.json({ error: `sourceType must be one of ${SOURCE_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!sourceValue || !String(sourceValue).trim()) {
    return NextResponse.json({ error: "Source value is required" }, { status: 400 });
  }

  const existing = await db.humorWeightRule.findUnique({ where: { sourceType_sourceValue: { sourceType, sourceValue: String(sourceValue).trim() } } });
  if (existing) return NextResponse.json({ error: "A rule for this source already exists" }, { status: 409 });

  const weightRule = await db.humorWeightRule.create({
    data: {
      sourceType, sourceValue: String(sourceValue).trim(),
      safraPoints: Number(safraPoints) || 0, damPoints: Number(damPoints) || 0,
      saudaPoints: Number(saudaPoints) || 0, balghamPoints: Number(balghamPoints) || 0,
      notes: notes || null,
    },
  });
  return NextResponse.json({ weightRule });
}
