import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";

/** Switch guidance for one module on or off (the module itself keeps working either way). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { key } = await params;
  const { enabled } = await req.json();
  const m = await db.guidanceModule.update({ where: { key }, data: { enabled: !!enabled } }).catch(() => null);
  if (!m) return NextResponse.json({ error: "Module not found" }, { status: 404 });
  await logAdminActivity(session.admin.id, "guidance_module_toggled", `Guidance for "${m.name}" switched ${m.enabled ? "on" : "off"}`, getClientIp(req));
  return NextResponse.json({ module: m });
}
