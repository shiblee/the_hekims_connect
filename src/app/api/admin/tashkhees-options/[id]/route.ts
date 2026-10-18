import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { ENGINE_MIZAJ } from "@/lib/tashkhees";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const existing = await db.tashkheesOption.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  // The engine suggests these temperaments by name, so renaming or switching one off would break its suggestions.
  if (existing.list === "mizaj" && ENGINE_MIZAJ.includes(existing.label)) {
    if (b.label !== undefined && String(b.label).trim() !== existing.label) return NextResponse.json({ error: "This temperament is used by the Tashkhees engine and can't be renamed" }, { status: 400 });
    if (b.active === false) return NextResponse.json({ error: "This temperament is used by the Tashkhees engine and can't be switched off" }, { status: 400 });
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const data: Record<string, unknown> = {};
  if (b.label !== undefined) {
    const label = str(b.label);
    if (!label) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    const clash = await db.tashkheesOption.findFirst({ where: { list: existing.list, label, id: { not: id } } });
    if (clash) return NextResponse.json({ error: "This item already exists" }, { status: 409 });
    data.label = label;
  }
  if (b.localName !== undefined) data.localName = str(b.localName);
  if (b.description !== undefined) data.description = str(b.description);
  if (b.active !== undefined) data.active = !!b.active;
  if (b.sortOrder !== undefined) data.sortOrder = parseInt(b.sortOrder, 10);
  const option = await db.tashkheesOption.update({ where: { id }, data });
  if (b.sortOrder === undefined) {
    await logAdminActivity(session.admin.id, "tashkhees_config_updated", `Updated "${option.label}" (${option.list})${b.active !== undefined ? ` — ${option.active ? "enabled" : "disabled"}` : ""}`, getClientIp(req));
  }
  return NextResponse.json({ option });
}
