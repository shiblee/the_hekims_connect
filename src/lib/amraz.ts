// Amraz catalogue on the server: loading it for the differential engine, and seeding the drafted
// starting entries (add-only by key — never touches an entry an admin has edited or reviewed).
import { db } from "@/lib/db";
import { AMRAZ, MARZ_SOURCES } from "@/lib/amraz-seed";
import type { BankQ, CatalogueEntry } from "@/lib/differential-engine";

const parse = <T,>(raw: string | null | undefined, fb: T): T => { try { return raw ? (JSON.parse(raw) as T) : fb; } catch { return fb; } };

/** Active entries that haven't been rejected (unverified drafts included — they're labelled). */
export async function loadCatalogue(): Promise<CatalogueEntry[]> {
  const rows = await db.marzEntry.findMany({ where: { active: true, reviewStatus: { not: "rejected" } }, orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    id: r.id, key: r.key, label: r.label, localName: r.localName, category: r.category, icd: r.icd,
    organs: parse(r.organs, []), mizaj: parse(r.mizaj, []), suMizajType: r.suMizajType, sabab: parse(r.sabab, []),
    appliesTo: parse(r.appliesTo, {}), signs: parse(r.signs, []), against: parse(r.against, []),
    dontMiss: parse(r.dontMiss, []), investigations: parse(r.investigations, []), reviewStatus: r.reviewStatus,
  }));
}

/** Approved Dala'il questions, for "next questions to ask". */
export async function loadDalailQuestions(): Promise<BankQ[]> {
  const qs = await db.asbabQuestion.findMany({
    where: { active: true, reviewStatus: "approved", pillar: { framework: "dalail", active: true } },
    select: { id: true, label: true, pillar: { select: { key: true, label: true } }, options: { select: { label: true } } },
  });
  return qs.map((q) => ({ id: q.id, section: q.pillar.key, sectionLabel: q.pillar.label, label: q.label, options: q.options.map((o) => o.label) }));
}

/** Adds the drafted starting catalogue (unverified). Returns how many entries were added. */
export async function seedAmraz(): Promise<number> {
  const existing = new Set((await db.marzEntry.findMany({ select: { key: true } })).map((x) => x.key));
  let added = 0;
  for (const [i, m] of AMRAZ.entries()) {
    if (existing.has(m.key)) continue;
    await db.marzEntry.create({
      data: {
        key: m.key, label: m.label, localName: m.localName ?? null, category: m.category, description: m.description ?? null, icd: m.icd ?? null,
        organs: JSON.stringify(m.organs), mizaj: JSON.stringify(m.mizaj), suMizajType: m.type ?? null, sabab: JSON.stringify(m.sabab),
        appliesTo: JSON.stringify(m.appliesTo), signs: JSON.stringify(m.signs), against: JSON.stringify(m.against ?? []),
        dontMiss: JSON.stringify(m.dontMiss ?? []), investigations: JSON.stringify(m.investigations ?? []), sources: JSON.stringify(MARZ_SOURCES),
        reviewStatus: "draft", sortOrder: i,
      },
    });
    added++;
  }
  return added;
}
