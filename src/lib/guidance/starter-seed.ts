// Seeds the starter tours / tutorials once (by module + name), publishes version 1, and attaches the
// Hindi / Urdu / Arabic / Farsi drafts as "awaiting review" — users see English until an admin reviews them.
import type { PrismaClient } from "@prisma/client";
import { cleanDoc, cleanTour, type L10n } from "./content";
import { syncGuidanceModules } from "./registry";
import { publishGuidance } from "./server";
import { STARTER_DOCS as CORE_DOCS, STARTER_TOURS as CORE_TOURS } from "./starter-content";
import { STAGE_DOCS, STAGE_TOURS } from "./starter-content-stages";
import { ADMIN_DOCS, ADMIN_TOURS } from "./starter-content-admin";
import { MORE_DOCS } from "./starter-content-more";
import { HI } from "./starter-tr-hi";
import { UR } from "./starter-tr-ur";
import { AR } from "./starter-tr-ar";
import { FA } from "./starter-tr-fa";
import { HI2 } from "./starter-tr2-hi";
import { UR2 } from "./starter-tr2-ur";
import { AR2 } from "./starter-tr2-ar";
import { FA2 } from "./starter-tr2-fa";
import { HI3 } from "./starter-tr3-hi";
import { UR3 } from "./starter-tr3-ur";
import { AR3 } from "./starter-tr3-ar";
import { FA3 } from "./starter-tr3-fa";

export const STARTER_TOURS = [...CORE_TOURS, ...STAGE_TOURS, ...ADMIN_TOURS];
export const STARTER_DOCS = [...CORE_DOCS, ...STAGE_DOCS, ...ADMIN_DOCS, ...MORE_DOCS];

export const STARTER_TRANSLATIONS = { hi: { ...HI, ...HI2, ...HI3 }, ur: { ...UR, ...UR2, ...UR3 }, ar: { ...AR, ...AR2, ...AR3 }, fa: { ...FA, ...FA2, ...FA3 } } as const;

const l10n = (key: string, en: string): L10n => {
  const out: L10n = { en };
  for (const [lang, map] of Object.entries(STARTER_TRANSLATIONS)) if (map[key]) out[lang as keyof L10n] = map[key];
  return out;
};

/** Every translation key the starter content needs (for completeness checks). */
export function starterKeys(): string[] {
  const keys: string[] = [];
  for (const t of STARTER_TOURS) { keys.push(`tour:${t.key}:title`); for (const s of t.steps) keys.push(`tour:${t.key}:${s.id}:title`, `tour:${t.key}:${s.id}:body`); }
  for (const d of STARTER_DOCS) { keys.push(`doc:${d.key}:title`); for (const k of Object.keys(d.sections)) keys.push(`doc:${d.key}:${k}`); for (const f of d.faqs) keys.push(`doc:${d.key}:faq:${f.id}:q`, `doc:${d.key}:faq:${f.id}:a`); }
  return keys;
}

/** English text for a starter key (for checks). */
export function starterEnglish(key: string): string | undefined {
  const [kind, k, a, b, c] = key.split(":");
  if (kind === "tour") { const t = STARTER_TOURS.find((x) => x.key === k); if (!t) return; if (a === "title") return t.title; const s = t.steps.find((x) => x.id === a); return b === "title" ? s?.title : s?.body; }
  const d = STARTER_DOCS.find((x) => x.key === k); if (!d) return;
  if (a === "title") return d.title;
  if (a === "faq") { const f = d.faqs.find((x) => x.id === b); return c === "q" ? f?.q : f?.a; }
  return d.sections[a as keyof typeof d.sections];
}

export async function seedStarterGuidance(db: PrismaClient, by = "system") {
  await syncGuidanceModules(db);
  let tours = 0, docs = 0;
  for (const t of STARTER_TOURS) {
    if (await db.guidanceTour.findFirst({ where: { moduleKey: t.moduleKey, name: t.name }, select: { id: true } })) continue;
    const draft = cleanTour({
      title: l10n(`tour:${t.key}:title`, t.title), reviewed: { en: true },
      steps: t.steps.map((s) => ({ id: s.id, route: s.route, target: s.target, placement: s.placement ?? "auto", active: true, title: l10n(`tour:${t.key}:${s.id}:title`, s.title), body: l10n(`tour:${t.key}:${s.id}:body`, s.body) })),
    });
    const row = await db.guidanceTour.create({ data: { moduleKey: t.moduleKey, name: t.name, audience: JSON.stringify(t.audience), trigger: t.trigger, draft: JSON.stringify(draft), updatedBy: by } });
    await publishGuidance("tour", row.id, by, "Starter content (English). Other languages awaiting review.");
    tours++;
  }
  for (const d of STARTER_DOCS) {
    if (await db.guidanceDoc.findFirst({ where: { moduleKey: d.moduleKey, name: d.name }, select: { id: true } })) continue;
    const draft = cleanDoc({
      title: l10n(`doc:${d.key}:title`, d.title), reviewed: { en: true },
      sections: Object.fromEntries(Object.entries(d.sections).map(([k, v]) => [k, l10n(`doc:${d.key}:${k}`, v!)])),
      faqs: d.faqs.map((f) => ({ id: f.id, q: l10n(`doc:${d.key}:faq:${f.id}:q`, f.q), a: l10n(`doc:${d.key}:faq:${f.id}:a`, f.a) })),
    });
    const row = await db.guidanceDoc.create({ data: { moduleKey: d.moduleKey, name: d.name, audience: d.moduleKey.startsWith("admin.") ? '["admin"]' : "[]", draft: JSON.stringify(draft), updatedBy: by } });
    await publishGuidance("doc", row.id, by, "Starter content (English). Other languages awaiting review.");
    docs++;
  }
  return { tours, docs };
}
