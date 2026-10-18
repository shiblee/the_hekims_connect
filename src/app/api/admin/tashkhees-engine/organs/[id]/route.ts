import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { parseSelectionMeta } from "@/lib/asbab-validate";

/** Body { appliesTo, priority } — which complaints / categories / symptoms / regions point to this organ. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const organ = await db.tashkheesOption.findFirst({ where: { id, list: "organ" } });
  if (!organ) return NextResponse.json({ error: "Organ not found" }, { status: 404 });
  const meta = parseSelectionMeta(await req.json().catch(() => ({})));
  const o = await db.tashkheesOption.update({
    where: { id },
    data: { ...(meta.appliesTo ? { appliesTo: meta.appliesTo as string } : {}), ...(meta.priority !== undefined ? { priority: meta.priority as number } : {}) },
  });
  await logAdminActivity(session.admin.id, "tashkhees_engine_updated", `Updated organ links for "${o.label}"`, getClientIp(req));
  return NextResponse.json({ organ: o });
}
