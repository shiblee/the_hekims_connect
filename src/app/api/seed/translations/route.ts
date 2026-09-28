import { NextResponse } from "next/server";
import { seedTranslations } from "@/lib/seed";
import { bumpMessagesVersion } from "@/lib/i18n/messages";

/** Idempotent — only upserts Language/TranslationKey/TranslationValue rows, never demo data. */
export async function POST() {
  try {
    await seedTranslations();
    await bumpMessagesVersion();
    return NextResponse.json({ seeded: true });
  } catch (e) {
    console.error("Translation seed error:", e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
