import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";

const PAGE_SIZE = 25;

/** Individual Gemini requests, newest first. ?feature=&status=ok|failed&page= */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const feature = sp.get("feature") || "";
  const status = sp.get("status") || "";
  const where = {
    ...(feature ? { feature } : {}),
    ...(status === "ok" ? { status: "ok" } : status === "failed" ? { status: { not: "ok" } } : {}),
  };
  const [total, calls] = await Promise.all([
    db.geminiUsageLog.count({ where }),
    db.geminiUsageLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  return NextResponse.json({ total, page, pageSize: PAGE_SIZE, calls });
}
