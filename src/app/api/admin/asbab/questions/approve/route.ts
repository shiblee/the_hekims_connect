import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

/** Body { ids: string[] } — approves draft questions after clinical review (bulk). */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const ids = Array.isArray(b.ids) ? b.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 500) : [];
  if (!ids.length) return NextResponse.json({ error: "Nothing to approve" }, { status: 400 });
  const r = await db.asbabQuestion.updateMany({ where: { id: { in: ids }, reviewStatus: "draft" }, data: { reviewStatus: "approved" } });
  await logAdminActivity(session.admin.id, "asbab_config_updated", `Approved ${r.count} Dala'il question${r.count === 1 ? "" : "s"} after review`, getClientIp(req));
  return NextResponse.json({ approved: r.count });
}
