import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { parseQuestionBody, parseSelectionMeta } from "@/lib/asbab-validate";

/** Body: { pillarId, label, labelLocal, helpText, type, required, weight, showIfQuestionId, showIfOption, options: [...] } */
export async function POST(req: NextRequest) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const pillar = typeof b.pillarId === "string" ? await db.asbabPillar.findUnique({ where: { id: b.pillarId } }) : null;
  if (!pillar) return NextResponse.json({ error: "Choose a pillar" }, { status: 400 });
  const parsed = parseQuestionBody(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const max = await db.asbabQuestion.aggregate({ where: { pillarId: pillar.id }, _max: { sortOrder: true } });
  const question = await db.asbabQuestion.create({
    data: {
      ...parsed.data, pillarId: pillar.id, sortOrder: (max._max.sortOrder ?? -1) + 1,
      // New Dala'il questions start as drafts unless the admin sets a status; Asbab questions are live.
      reviewStatus: pillar.framework === "dalail" ? "draft" : "approved",
      ...parseSelectionMeta(b),
      options: { create: (parsed.options || []).map((o, i) => ({ ...o, sortOrder: i })) },
    },
  });
  await logAdminActivity(session.admin.id, "asbab_config_updated", `Added Asbab-e-Sittah question "${question.label}" to ${pillar.label}`, getClientIp(req));
  return NextResponse.json({ question });
}
