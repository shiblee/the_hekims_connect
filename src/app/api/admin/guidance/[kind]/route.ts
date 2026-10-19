import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { cleanText, emptyDoc, emptyTour } from "@/lib/guidance/content";
import { moduleDef } from "@/lib/guidance/registry";
import { isKind } from "@/lib/guidance/admin-kind";

/** Create a new tour or tutorial (as a draft) for a module. Body { moduleKey, name }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { kind } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { moduleKey, name } = await req.json();
  const def = moduleDef(String(moduleKey));
  if (!def) return NextResponse.json({ error: "Unknown module" }, { status: 400 });
  const label = cleanText(name).trim() || `${def.name} ${kind === "tours" ? "tour" : "tutorial"}`;
  const audience = JSON.stringify(def.app === "admin" ? ["admin"] : []);
  const row = kind === "tours"
    ? await db.guidanceTour.create({ data: { moduleKey: def.key, name: label, audience, draft: JSON.stringify(emptyTour(label)), updatedBy: session.admin.id } })
    : await db.guidanceDoc.create({ data: { moduleKey: def.key, name: label, audience, draft: JSON.stringify(emptyDoc(label)), updatedBy: session.admin.id } });
  await logAdminActivity(session.admin.id, "guidance_created", `New ${kind === "tours" ? "tour" : "tutorial"} "${label}" for ${def.name}`, getClientIp(req));
  return NextResponse.json({ id: row.id });
}
