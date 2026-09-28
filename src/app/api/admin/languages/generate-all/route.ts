import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { translateString, isMissingAnthropicCredentials } from "@/lib/i18n/ai-translate";

/** Bulk-fills every key missing a value (or still draft) for one language. Sequential, not parallel — keeps this predictable and easy to reason about for a bounded admin action, not a hot request path. */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { languageCode, group } = await req.json();
  if (!languageCode) return NextResponse.json({ error: "languageCode is required" }, { status: 400 });

  const language = await db.language.findUnique({ where: { code: languageCode } });
  if (!language) return NextResponse.json({ error: "Unknown language" }, { status: 404 });

  const keys = await db.translationKey.findMany({
    where: { ...(group ? { group } : {}) },
    include: { values: { where: { languageCode } } },
  });
  const pending = keys.filter((k) => {
    const existing = k.values[0];
    return !existing || existing.status !== "published";
  });

  let generated = 0;
  const failures: string[] = [];

  for (const k of pending) {
    try {
      const text = await translateString({
        sourceText: k.sourceText,
        targetLanguageCode: languageCode,
        keyName: k.key,
        description: k.description,
      });
      await db.translationValue.upsert({
        where: { keyId_languageCode: { keyId: k.id, languageCode } },
        update: { text, status: "ai_generated", source: "ai", updatedBy: session.admin.id },
        create: { keyId: k.id, languageCode, text, status: "ai_generated", source: "ai", updatedBy: session.admin.id },
      });
      generated++;
    } catch (err) {
      if (isMissingAnthropicCredentials(err)) {
        return NextResponse.json(
          { error: "AI translation isn't configured yet — add an ANTHROPIC_API_KEY.", generated, total: pending.length },
          { status: 503 }
        );
      }
      failures.push(k.key);
    }
  }

  await logAdminActivity(
    session.admin.id,
    "translation_bulk_ai_generated",
    `${generated}/${pending.length} keys generated for ${language.englishName}${failures.length ? ` (${failures.length} failed)` : ""}`,
    getClientIp(req)
  );

  return NextResponse.json({ generated, total: pending.length, failures });
}
