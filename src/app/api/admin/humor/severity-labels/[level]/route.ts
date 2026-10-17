import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ level: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const level = parseInt((await params).level, 10);
  if (!Number.isInteger(level) || level < 1 || level > 10) {
    return NextResponse.json({ error: "Invalid severity level" }, { status: 400 });
  }

  const body = await req.json();
  const label = String(body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  const severityLabel = await db.severityScaleLabel.upsert({
    where: { level },
    update: { label },
    create: { level, label },
  });
  return NextResponse.json({ severityLabel });
}
