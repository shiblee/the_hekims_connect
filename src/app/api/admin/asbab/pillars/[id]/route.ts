import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

/** Edit a pillar's wording, order or active state. Pillars can't be created or deleted — the six-factor framework is fixed. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const data: Record<string, unknown> = {};
  if (b.label !== undefined) { if (!str(b.label)) return NextResponse.json({ error: "Name is required" }, { status: 400 }); data.label = str(b.label); }
  if (b.english !== undefined) { if (!str(b.english)) return NextResponse.json({ error: "English name is required" }, { status: 400 }); data.english = str(b.english); }
  if (b.description !== undefined) data.description = str(b.description) || null;
  if (b.active !== undefined) data.active = !!b.active;
  if (b.sortOrder !== undefined) data.sortOrder = parseInt(b.sortOrder, 10);
  const pillar = await db.asbabPillar.update({ where: { id }, data });
  if (b.sortOrder === undefined) {
    await logAdminActivity(session.admin.id, "asbab_config_updated", `Updated the Asbab-e-Sittah pillar "${pillar.label}"${b.active !== undefined ? ` — ${pillar.active ? "enabled" : "disabled"}` : ""}`, getClientIp(req));
  }
  return NextResponse.json({ pillar });
}
