import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { cleanGhizaRule, cleanImage, foodMizajOf } from "@/lib/ghiza-validate";

/** Body: any of { label, description, category, hot, moist, degree, rule, reviewStatus, active, imageUrl, imageCredit, imageSource }. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const existing = await db.tashkheesOption.findFirst({ where: { id, list: "ghiza" } });
  if (!existing) return NextResponse.json({ error: "Food not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.label === "string" && b.label.trim()) data.label = b.label.trim().slice(0, 120);
  if (b.description !== undefined) data.description = typeof b.description === "string" ? b.description.trim().slice(0, 300) || null : null;
  if (b.category !== undefined) data.category = typeof b.category === "string" ? b.category.trim().slice(0, 60) || null : null;
  if (b.hot !== undefined || b.moist !== undefined) data.foodMizaj = foodMizajOf(b.hot, b.moist, b.degree);
  if (b.rule !== undefined) data.appliesTo = JSON.stringify(cleanGhizaRule(b.rule));
  if (["draft", "approved", "retired"].includes(b.reviewStatus)) data.reviewStatus = b.reviewStatus;
  if (typeof b.active === "boolean") data.active = b.active;
  if (b.imageUrl !== undefined) Object.assign(data, cleanImage(b));
  const o = await db.tashkheesOption.update({ where: { id }, data });
  await logAdminActivity(session.admin.id, "ghiza_engine_updated", `Updated food "${o.label}"`, getClientIp(req));
  return NextResponse.json({ food: o });
}
