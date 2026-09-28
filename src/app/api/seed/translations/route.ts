import { NextResponse } from "next/server";
import { seedTranslations } from "@/lib/seed";

/** Idempotent — only upserts Language/TranslationKey/TranslationValue rows, never demo data. */
export async function POST() {
  try {
    await seedTranslations();
    return NextResponse.json({ seeded: true });
  } catch (e) {
    console.error("Translation seed error:", e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
