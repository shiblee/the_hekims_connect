import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { bumpMessagesVersion } from "@/lib/i18n/messages";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ key: string; lang: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { key: rawKey, lang } = await params;
  const key = decodeURIComponent(rawKey);

  const translationKey = await db.translationKey.findUnique({ where: { key } });
  if (!translationKey) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  const { text, status } = await req.json();
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }
  if (!["draft", "published"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const value = await db.translationValue.upsert({
    where: { keyId_languageCode: { keyId: translationKey.id, languageCode: lang } },
    update: { text: String(text), status, source: "manual", updatedBy: session.admin.id },
    create: {
      keyId: translationKey.id,
      languageCode: lang,
      text: String(text),
      status,
      source: "manual",
      updatedBy: session.admin.id,
    },
  });

  if (status === "published") await bumpMessagesVersion(session.admin.id);
  await logAdminActivity(
    session.admin.id,
    status === "published" ? "translation_published" : "translation_saved",
    `"${key}" (${lang}) ${status === "published" ? "published" : "saved as draft"}`,
    getClientIp(req)
  );

  return NextResponse.json({ value });
}
