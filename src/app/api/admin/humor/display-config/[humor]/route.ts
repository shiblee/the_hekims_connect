import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const VALID_HUMORS = ["safra", "dam", "sauda", "balgham"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ humor: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { humor } = await params;
  if (!VALID_HUMORS.includes(humor)) {
    return NextResponse.json({ error: "Invalid humor" }, { status: 400 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.axisLabel !== undefined) {
    if (!String(body.axisLabel).trim()) return NextResponse.json({ error: "Axis label is required" }, { status: 400 });
    data.axisLabel = String(body.axisLabel).trim();
  }
  if (body.unaniLabel !== undefined) {
    if (!String(body.unaniLabel).trim()) return NextResponse.json({ error: "Unani label is required" }, { status: 400 });
    data.unaniLabel = String(body.unaniLabel).trim();
  }
  if (body.description !== undefined) data.description = body.description ? String(body.description).trim() : null;

  const config = await db.humorDisplayConfig.upsert({
    where: { humor },
    update: data,
    create: { humor, axisLabel: String(body.axisLabel || humor), unaniLabel: String(body.unaniLabel || humor), description: body.description || null },
  });
  return NextResponse.json({ config });
}
