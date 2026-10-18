import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { cleanUsoolRule } from "@/lib/usool-validate";

/** Body: any of { label, localName, description, priority, reviewStatus, active, rule }. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const existing = await db.tashkheesOption.findFirst({ where: { id, list: "usool" } });
  if (!existing) return NextResponse.json({ error: "Principle not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.label === "string" && b.label.trim()) data.label = b.label.trim().slice(0, 120);
  if (b.localName !== undefined) data.localName = typeof b.localName === "string" ? b.localName.trim() || null : null;
  if (b.description !== undefined) data.description = typeof b.description === "string" ? b.description.trim().slice(0, 300) || null : null;
  if (b.priority !== undefined) data.priority = Math.max(1, Math.min(5, Math.round(Number(b.priority) || 3)));
  if (["draft", "approved", "retired"].includes(b.reviewStatus)) data.reviewStatus = b.reviewStatus;
  if (typeof b.active === "boolean") data.active = b.active;
  if (b.rule !== undefined) data.appliesTo = JSON.stringify(cleanUsoolRule(b.rule));
  const o = await db.tashkheesOption.update({ where: { id }, data });
  await logAdminActivity(session.admin.id, "usool_engine_updated", `Updated Usool-e-Ilaj principle "${o.label}"`, getClientIp(req));
  return NextResponse.json({ principle: o });
}
