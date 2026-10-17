import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const suggestions = await db.medicationSuggestion.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ suggestions });
}
