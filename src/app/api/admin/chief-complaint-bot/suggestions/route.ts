import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Full transparent log by default — every suggestion the bot has ever
  // generated, regardless of status, so approvals are never "invisible"
  // after the fact. Pass ?status= to narrow it (e.g. the legacy "pending"
  // review queue for any leftover rows from before auto-approval shipped).
  const status = req.nextUrl.searchParams.get("status");
  const suggestions = await db.chiefComplaintSuggestion.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ suggestions });
}
