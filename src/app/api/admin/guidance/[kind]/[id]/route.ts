import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { cleanDoc, cleanText, cleanTour } from "@/lib/guidance/content";
import { GUIDANCE_MODULES, moduleDef } from "@/lib/guidance/registry";
import { findRow, isKind, langStates, parseContent, singular } from "@/lib/guidance/admin-kind";

const AUDIENCE = /^(owner|staff|admin|role:[^"]{1,60})$/;

/** Full draft + published copy + version history for the editor. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { kind, id } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await findRow(kind, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const draft = parseContent(kind, row.draft);
  const versions = await db.guidanceVersion.findMany({ where: { kind: singular(kind), entityId: id }, orderBy: { version: "desc" }, select: { version: true, publishedBy: true, note: true, createdAt: true } });
  const admins = await db.admin.findMany({ where: { id: { in: [...new Set(versions.map((v) => v.publishedBy).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
  const roles = await db.metadataOption.findMany({ where: { section: { key: "staff_role" }, active: true }, select: { label: true }, orderBy: { label: "asc" } });
  return NextResponse.json({
    item: { ...row, draft, published: row.published ? parseContent(kind, row.published) : null, languages: langStates(draft) },
    module: moduleDef(row.moduleKey),
    routes: GUIDANCE_MODULES.filter((m) => m.app === moduleDef(row.moduleKey)?.app).map((m) => ({ route: m.route, name: m.name, targets: m.targets })),
    staffRoles: roles.map((r) => r.label),
    versions: versions.map((v) => ({ ...v, publishedBy: admins.find((a) => a.id === v.publishedBy)?.name ?? "Admin" })),
  });
}

/** Save the draft (content, name, audience, trigger). Users keep seeing the published copy until Publish. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { kind, id } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await findRow(kind, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  // Optimistic lock: refuse to overwrite a draft someone else saved after this editor loaded it.
  if (body.updatedAt && new Date(body.updatedAt).getTime() !== row.updatedAt.getTime()) {
    return NextResponse.json({ error: "Someone else saved this in the meantime. Reload to see their changes, then edit again." }, { status: 409 });
  }
  const draft = JSON.stringify(kind === "tours" ? cleanTour(body.draft) : cleanDoc(body.draft));
  const data: Record<string, unknown> = { draft, dirty: true, updatedBy: session.admin.id };
  if (typeof body.name === "string" && cleanText(body.name).trim()) data.name = cleanText(body.name).trim().slice(0, 120);
  if (Array.isArray(body.audience)) data.audience = JSON.stringify(body.audience.filter((a: unknown) => typeof a === "string" && AUDIENCE.test(a)).slice(0, 40));
  if (kind === "tours") {
    if (["first_login", "first_visit", "manual"].includes(body.trigger)) data.trigger = body.trigger;
    if (typeof body.reoffer === "boolean") data.reoffer = body.reoffer;
  }
  const saved = kind === "tours" ? await db.guidanceTour.update({ where: { id }, data }) : await db.guidanceDoc.update({ where: { id }, data });
  return NextResponse.json({ updatedAt: saved.updatedAt, languages: langStates(parseContent(kind, saved.draft)) });
}

/** Delete — only something that was never published (published content is archived instead, keeping history). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { kind, id } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await findRow(kind, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.version > 0) return NextResponse.json({ error: "This has been published before — archive it instead so its history is kept." }, { status: 400 });
  if (kind === "tours") await db.guidanceTour.delete({ where: { id } }); else await db.guidanceDoc.delete({ where: { id } });
  await logAdminActivity(session.admin.id, "guidance_deleted", `Draft ${singular(kind)} "${row.name}" deleted`, getClientIp(req));
  return NextResponse.json({ ok: true });
}
