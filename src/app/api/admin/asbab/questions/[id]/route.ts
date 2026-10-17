import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { parseQuestionBody } from "@/lib/asbab-validate";

/**
 * Body { active } or { sortOrder } toggles/reorders; otherwise a full edit
 * (same shape as create). A wording/option change bumps `version` — saved
 * patient answers keep their own snapshot, so history is never reinterpreted.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { id } = await params;
  const existing = await db.asbabQuestion.findUnique({ where: { id }, include: { options: { orderBy: { sortOrder: "asc" } }, pillar: true } });
  if (!existing) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));

  if (b.active !== undefined && Object.keys(b).length === 1) {
    const q = await db.asbabQuestion.update({ where: { id }, data: { active: !!b.active } });
    await logAdminActivity(session.admin.id, "asbab_config_updated", `${q.active ? "Enabled" : "Disabled"} Asbab-e-Sittah question "${q.label}"`, getClientIp(req));
    return NextResponse.json({ question: q });
  }
  if (b.sortOrder !== undefined && Object.keys(b).length === 1) {
    return NextResponse.json({ question: await db.asbabQuestion.update({ where: { id }, data: { sortOrder: parseInt(b.sortOrder, 10) } }) });
  }

  const parsed = parseQuestionBody(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.data.showIfQuestionId === id) return NextResponse.json({ error: "A question can't depend on itself" }, { status: 400 });

  const sig = (opts: { label: string; description: string | null; safra: number; dam: number; balgham: number; sauda: number; active: boolean }[]) =>
    JSON.stringify(opts.map((o) => [o.label, o.description, o.safra, o.dam, o.balgham, o.sauda, o.active]));
  const changed = existing.label !== parsed.data.label || existing.type !== parsed.data.type || existing.weight !== parsed.data.weight
    || sig(existing.options) !== sig(parsed.options || []);

  const question = await db.$transaction(async (tx) => {
    await tx.asbabOption.deleteMany({ where: { questionId: id } });
    return tx.asbabQuestion.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(typeof b.active === "boolean" ? { active: b.active } : {}),
        version: changed ? existing.version + 1 : existing.version,
        options: { create: (parsed.options || []).map((o, i) => ({ ...o, sortOrder: i })) },
      },
    });
  });
  await logAdminActivity(session.admin.id, "asbab_config_updated", `Edited Asbab-e-Sittah question "${question.label}" (${existing.pillar.label})${changed ? ` — now version ${question.version}` : ""}`, getClientIp(req));
  return NextResponse.json({ question });
}
