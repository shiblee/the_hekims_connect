import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const activity = await db.adminActivityLog.findMany({
    where: { adminId: session.admin.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ activity });
}
