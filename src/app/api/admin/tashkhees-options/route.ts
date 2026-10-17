import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { isTashkheesList, TASHKHEES_LISTS } from "@/lib/tashkhees";

/** All Stage 5 option lists (including disabled items). */
export async function GET(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const options = await db.tashkheesOption.findMany({ orderBy: [{ list: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ options });
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!isTashkheesList(b.list)) return NextResponse.json({ error: "Unknown list" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (await db.tashkheesOption.findUnique({ where: { list_label: { list: b.list, label } } })) {
    return NextResponse.json({ error: "This item already exists" }, { status: 409 });
  }
  const max = await db.tashkheesOption.aggregate({ where: { list: b.list }, _max: { sortOrder: true } });
  const option = await db.tashkheesOption.create({
    data: {
      list: b.list, label, sortOrder: (max._max.sortOrder ?? -1) + 1,
      localName: typeof b.localName === "string" && b.localName.trim() ? b.localName.trim() : null,
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
    },
  });
  const listLabel = TASHKHEES_LISTS.find((l) => l.key === b.list)?.label ?? b.list;
  await logAdminActivity(session.admin.id, "tashkhees_config_updated", `Added "${label}" to ${listLabel}`, getClientIp(req));
  return NextResponse.json({ option });
}
