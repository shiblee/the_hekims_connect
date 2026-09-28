import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  try {
    const result = await seedDatabase();
    return NextResponse.json({ seeded: result });
  } catch (e) {
    console.error("Seed error:", e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
