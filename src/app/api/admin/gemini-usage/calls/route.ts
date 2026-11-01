import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { listParam, eitherParam } from "@/lib/list-param";

const PAGE_SIZE = 25;

/** Individual Gemini requests, newest first. ?feature=&status=ok|failed&page= */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const features = listParam(sp, "feature");
  const ok = eitherParam(listParam(sp, "status"), "ok", "failed");
  const where = {
    ...(features.length ? { feature: { in: features } } : {}),
    ...(ok === true ? { status: "ok" } : ok === false ? { status: { not: "ok" } } : {}),
  };
  const [total, calls] = await Promise.all([
    db.geminiUsageLog.count({ where }),
    db.geminiUsageLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  return NextResponse.json({ total, page, pageSize: PAGE_SIZE, calls });
}
