import { NextResponse } from "next/server";
import { seedPages } from "@/lib/seed";

/** Idempotent — only creates missing Page/PageContent rows, never overwrites edited content. */
export async function POST() {
  try {
    await seedPages();
    return NextResponse.json({ seeded: true });
  } catch (e) {
    console.error("Pages seed error:", e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
