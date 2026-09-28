import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settings = await db.portalSetting.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { updates } = await req.json();
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  for (const u of updates) {
    if (!u.category || !u.key || typeof u.value !== "string") {
      return NextResponse.json({ error: "Invalid update entry" }, { status: 400 });
    }
  }

  await Promise.all(
    updates.map((u: { category: string; key: string; value: string }) =>
      db.portalSetting.upsert({
        where: { category_key: { category: u.category, key: u.key } },
        update: { value: u.value, updatedBy: session.admin.id },
        create: { category: u.category, key: u.key, value: u.value, updatedBy: session.admin.id },
      })
    )
  );

  await logAdminActivity(
    session.admin.id,
    "settings_updated",
    updates.map((u: any) => `${u.category}.${u.key}`).join(", "),
    getClientIp(req)
  );

  const settings = await db.portalSetting.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });
  return NextResponse.json({ settings });
}
