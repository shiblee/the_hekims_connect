import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, logAdminActivity } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request-info";
import { isMissingAnthropicCredentials, translateGuideText } from "@/lib/i18n/ai-translate";
import { cleanText, DOC_SECTIONS, type DocContent, type GuideLang, type L10n, type TourContent } from "@/lib/guidance/content";
import { findRow, isKind, langStates, parseContent } from "@/lib/guidance/admin-kind";

export const maxDuration = 300;
const TARGETS: GuideLang[] = ["hi", "ur", "ar", "fa"];

/**
 * Body { langs?: string[] } — fills EMPTY fields of the draft in those languages from the English text.
 * Never overwrites existing wording; the languages stay "awaiting review" until an admin ticks them reviewed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { kind, id } = await params;
  if (!isKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = await findRow(kind, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const langs = TARGETS.filter((l) => !Array.isArray(body.langs) || body.langs.includes(l));

  const draft = parseContent(kind, row.draft);
  // Every text that has English, labelled with where it appears (helps the translation).
  const fields: { ref: L10n; where: string }[] = [{ ref: draft.title, where: "Title" }];
  if ("steps" in draft) (draft as TourContent).steps.forEach((s, i) => { fields.push({ ref: s.title, where: `Tour step ${i + 1} title` }, { ref: s.body, where: `Tour step ${i + 1} explanation` }); });
  else {
    const d = draft as DocContent;
    for (const [k, label] of DOC_SECTIONS) if (d.sections[k]) fields.push({ ref: d.sections[k]!, where: `Tutorial section "${label}"` });
    d.faqs.forEach((f, i) => { fields.push({ ref: f.q, where: `FAQ ${i + 1} question` }, { ref: f.a, where: `FAQ ${i + 1} answer` }); });
  }
  const jobs = fields.flatMap((f) => langs.filter((l) => f.ref.en?.trim() && !f.ref[l]?.trim()).map((l) => ({ ...f, lang: l })));

  let done = 0;
  try {
    for (let i = 0; i < jobs.length; i += 6) {
      await Promise.all(jobs.slice(i, i + 6).map(async (j) => {
        j.ref[j.lang] = cleanText(await translateGuideText(j.ref.en!, j.lang, j.where));
        done++;
      }));
    }
  } catch (e) {
    if (done === 0) {
      const { geminiQuotaRecentlyHit, geminiStatus } = await import("@/lib/gemini");
      const off = (await geminiStatus()) !== "on";
      const msg = off
        ? "The AI service is switched off (Admin → Settings → AI service). Turn it on to draft translations, or type them in by hand."
        : geminiQuotaRecentlyHit()
        ? "The translation service (Gemini) has run out of credits — top up in Google AI Studio, then try again. You can also type translations in by hand."
        : isMissingAnthropicCredentials(e) ? "No translation service is set up on this server — you can type translations in by hand." : "Translation failed — try again in a moment.";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }
  for (const l of langs) draft.reviewed[l] = false;
  const data = { draft: JSON.stringify(draft), dirty: true, updatedBy: session.admin.id };
  const saved = kind === "tours" ? await db.guidanceTour.update({ where: { id }, data }) : await db.guidanceDoc.update({ where: { id }, data });
  await logAdminActivity(session.admin.id, "guidance_translated", `Draft translations for "${row.name}": ${done} text${done === 1 ? "" : "s"} (${langs.join(", ")}) — awaiting review`, getClientIp(req));
  return NextResponse.json({ translated: done, remaining: jobs.length - done, updatedAt: saved.updatedAt, languages: langStates(draft) });
}
