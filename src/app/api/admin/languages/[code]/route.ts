import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { bumpMessagesVersion } from "@/lib/i18n/messages";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { code } = await params;
  const existing = await db.language.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ error: "Language not found" }, { status: 404 });

  const body = await req.json();
  const { name, englishName, direction, enabled, isDefault, sortOrder } = body;

  if (existing.isDefault && enabled === false) {
    return NextResponse.json({ error: "Can't disable the default language — set another language as default first" }, { status: 400 });
  }
  if (direction && !["ltr", "rtl"].includes(direction)) {
    return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
  }

  const data: Record<string, unknown> = { updatedBy: session.admin.id };
  if (name !== undefined) data.name = String(name);
  if (englishName !== undefined) data.englishName = String(englishName);
  if (direction !== undefined) data.direction = direction;
  if (enabled !== undefined) data.enabled = !!enabled;
  if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

  let updated;
  if (isDefault === true && !existing.isDefault) {
    [, updated] = await db.$transaction([
      db.language.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      db.language.update({ where: { code }, data: { ...data, isDefault: true, enabled: true } }),
    ]);
  } else {
    updated = await db.language.update({ where: { code }, data });
  }

  await bumpMessagesVersion(session.admin.id);
  await logAdminActivity(
    session.admin.id,
    "language_updated",
    `Language "${existing.englishName}" updated${isDefault ? " (set as default)" : ""}`,
    getClientIp(req)
  );

  return NextResponse.json({ language: updated });
}
