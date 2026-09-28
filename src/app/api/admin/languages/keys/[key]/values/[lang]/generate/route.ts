import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { translateString, isMissingAnthropicCredentials } from "@/lib/i18n/ai-translate";

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string; lang: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { key: rawKey, lang } = await params;
  const key = decodeURIComponent(rawKey);

  const translationKey = await db.translationKey.findUnique({ where: { key } });
  if (!translationKey) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  try {
    const text = await translateString({
      sourceText: translationKey.sourceText,
      targetLanguageCode: lang,
      keyName: key,
      description: translationKey.description,
    });

    const value = await db.translationValue.upsert({
      where: { keyId_languageCode: { keyId: translationKey.id, languageCode: lang } },
      update: { text, status: "ai_generated", source: "ai", updatedBy: session.admin.id },
      create: {
        keyId: translationKey.id,
        languageCode: lang,
        text,
        status: "ai_generated",
        source: "ai",
        updatedBy: session.admin.id,
      },
    });

    await logAdminActivity(session.admin.id, "translation_ai_generated", `"${key}" (${lang}) generated with AI`, getClientIp(req));
    return NextResponse.json({ value });
  } catch (err) {
    if (isMissingAnthropicCredentials(err)) {
      return NextResponse.json({ error: "AI translation isn't configured yet — add an ANTHROPIC_API_KEY." }, { status: 503 });
    }
    console.error("AI translate error:", err);
    return NextResponse.json({ error: "AI translation failed — try again." }, { status: 500 });
  }
}
