import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { translationState } from "@/lib/guidance/content";
import { publishGuidance, setGuidanceStatus } from "@/lib/guidance/server";
import { findRow, isKind, parseContent, singular } from "@/lib/guidance/admin-kind";

/** Body { action: "publish" | "unpublish" | "archive" | "restore", note?, version? }. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { kind, id } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await findRow(kind, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { action, note, version } = await req.json();
  const what = `${singular(kind) === "tour" ? "Tour" : "Tutorial"} "${row.name}"`;
  const ip = getClientIp(req);

  if (action === "publish") {
    // Never publish something that would show users empty instructions.
    const draft = parseContent(kind, row.draft);
    if (translationState(draft, "en") !== "complete") {
      return NextResponse.json({ error: kind === "tours" ? "Add a title and at least one step with a title and text in English before publishing." : "Add a title and at least one section in English before publishing." }, { status: 400 });
    }
    if ("steps" in draft && !draft.steps.some((s) => s.active)) return NextResponse.json({ error: "Add at least one active step before publishing." }, { status: 400 });
    const v = await publishGuidance(singular(kind), id, session.admin.id, typeof note === "string" ? note : undefined);
    await logAdminActivity(session.admin.id, "guidance_published", `${what} published as version ${v}`, ip);
    return NextResponse.json({ version: v });
  }
  if (action === "unpublish" || action === "archive") {
    await setGuidanceStatus(singular(kind), id, action === "archive" ? "archived" : "draft");
    await logAdminActivity(session.admin.id, `guidance_${action}d`, `${what} ${action === "archive" ? "archived" : "unpublished"}`, ip);
    return NextResponse.json({ ok: true });
  }
  if (action === "restore") {
    const v = await db.guidanceVersion.findFirst({ where: { kind: singular(kind), entityId: id, version: Number(version) } });
    if (!v) return NextResponse.json({ error: "Version not found" }, { status: 404 });
    const data = { draft: v.snapshot, dirty: true, updatedBy: session.admin.id };
    if (kind === "tours") await db.guidanceTour.update({ where: { id }, data }); else await db.guidanceDoc.update({ where: { id }, data });
    await logAdminActivity(session.admin.id, "guidance_restored", `${what}: version ${v.version} loaded into the draft`, ip);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
