import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

/** Body { ids } — approve draft principles after physician review. */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const ids = Array.isArray(b.ids) ? b.ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 300) : [];
  const r = await db.tashkheesOption.updateMany({ where: { id: { in: ids }, list: "usool", reviewStatus: "draft" }, data: { reviewStatus: "approved" } });
  await logAdminActivity(session.admin.id, "usool_engine_updated", `Approved ${r.count} Usool-e-Ilaj principle${r.count === 1 ? "" : "s"} after review`, getClientIp(req));
  return NextResponse.json({ approved: r.count });
}
