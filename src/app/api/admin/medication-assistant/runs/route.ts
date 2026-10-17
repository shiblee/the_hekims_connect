import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const runs = await db.medicationAssistantRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 });
  return NextResponse.json({ runs });
}
