import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const languages = await db.language.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
    select: { code: true, name: true, direction: true, isDefault: true },
  });
  return NextResponse.json({ languages });
}
