import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { marzData } from "./shared";

/** Admin → Amraz catalogue: every entry with its review status and how often Hakims chose it. */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [rows, usage] = await Promise.all([
    db.marzEntry.findMany({ orderBy: [{ category: "asc" }, { label: "asc" }] }),
    db.dossierDiagnosis.groupBy({ by: ["marzId"], where: { marzId: { not: null }, role: { in: ["working", "secondary"] } }, _count: { _all: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.marzId, u._count._all]));
  return NextResponse.json({ entries: rows.map((r) => ({ ...r, used: used.get(r.id) ?? 0 })) });
}

/** Body: the entry's fields. New entries start unverified (draft). */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const { data, error } = marzData(b, true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const key = String(data.label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || `marz_${Date.now()}`;
  if (await db.marzEntry.findUnique({ where: { key } })) return NextResponse.json({ error: "This disease already exists" }, { status: 409 });
  const entry = await db.marzEntry.create({ data: { ...(data as any), key, reviewStatus: "draft" } });
  await logAdminActivity(session.admin.id, "amraz_created", `Added Amraz entry "${entry.label}" (unverified)`, getClientIp(req));
  return NextResponse.json({ entry });
}
