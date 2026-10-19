// Guidance content shapes, translation status and text safety — shared by server and browser.
// Text is plain with a tiny formatting subset (see formatBlocks); it is never rendered as HTML.

export const GUIDE_LANGS = ["en", "hi", "ur", "ar", "fa"] as const;
export type GuideLang = (typeof GUIDE_LANGS)[number];
export const LANG_LABEL: Record<GuideLang, string> = { en: "English", hi: "Hindi", ur: "Urdu", ar: "Arabic", fa: "Farsi" };
export const RTL_LANGS: GuideLang[] = ["ur", "ar", "fa"];

/** Text in each language (missing language = not written yet). */
export type L10n = Partial<Record<GuideLang, string>>;

export interface TourStep {
  id: string;
  title: L10n;
  body: L10n;
  /** Page the step belongs to (the tour asks the user to open it; never navigates by itself). */
  route?: string;
  /** Stable data-tour marker on the page; missing on screen → shown as a centred card. */
  target?: string;
  placement?: "auto" | "top" | "bottom" | "left" | "right";
  active: boolean;
}
export interface TourContent { title: L10n; steps: TourStep[]; reviewed: Partial<Record<GuideLang, boolean>> }

export const DOC_SECTIONS = [
  ["overview", "Overview"],
  ["purpose", "Purpose"],
  ["access", "Who can use it"],
  ["permissions", "Permissions needed"],
  ["controls", "Sections & controls"],
  ["workflow", "Step-by-step workflow"],
  ["fields", "Fields and what they mean"],
  ["tasks", "Common tasks"],
  ["behaviour", "What happens next"],
  ["validation", "Rules & common errors"],
  ["troubleshooting", "Troubleshooting"],
  ["security", "Privacy & security"],
  ["next", "Related modules & next steps"],
] as const;
export type DocSectionKey = (typeof DOC_SECTIONS)[number][0];
export interface DocFaq { id: string; q: L10n; a: L10n }
export interface DocContent { title: L10n; sections: Partial<Record<DocSectionKey, L10n>>; faqs: DocFaq[]; reviewed: Partial<Record<GuideLang, boolean>> }

export const emptyTour = (title = ""): TourContent => ({ title: { en: title }, steps: [], reviewed: { en: true } });
export const emptyDoc = (title = ""): DocContent => ({ title: { en: title }, sections: {}, faqs: [], reviewed: { en: true } });

// ── Translation status ───────────────────────────────────────────────────────
export type TranslationState = "complete" | "review" | "partial" | "missing";
export const STATE_LABEL: Record<TranslationState, string> = { complete: "Complete", review: "Awaiting review", partial: "Partially translated", missing: "Missing" };

/** Every text that must exist in each language (only fields the English version fills in). */
function requiredTexts(c: TourContent | DocContent): L10n[] {
  // Nothing to show yet (no steps / no sections) = not publishable in any language.
  if ("steps" in c ? !c.steps.some((s) => s.active && s.title.en?.trim() && s.body.en?.trim()) : !Object.values(c.sections).some((x) => x?.en?.trim())) return [];
  if ("steps" in c) return [c.title, ...c.steps.filter((s) => s.active).flatMap((s) => [s.title, s.body])].filter((t) => t.en?.trim());
  return [c.title, ...Object.values(c.sections), ...c.faqs.flatMap((f) => [f.q, f.a])].filter((t): t is L10n => !!t?.en?.trim());
}

export function translationState(c: TourContent | DocContent, lang: GuideLang): TranslationState {
  const req = requiredTexts(c);
  if (!req.length) return "missing";
  const filled = req.filter((t) => t[lang]?.trim()).length;
  if (filled === 0) return "missing";
  if (filled < req.length) return "partial";
  return lang === "en" || c.reviewed[lang] ? "complete" : "review";
}

/** The language to show: the user's, if complete; else the fallback, if complete; else English. */
export function pickLang(c: TourContent | DocContent, wanted: string, fallback: string): { lang: GuideLang; isFallback: boolean } {
  const ok = (l: string): l is GuideLang => (GUIDE_LANGS as readonly string[]).includes(l) && translationState(c, l as GuideLang) === "complete";
  if (ok(wanted)) return { lang: wanted, isFallback: false };
  if (ok(fallback)) return { lang: fallback, isFallback: wanted !== fallback };
  return { lang: "en", isFallback: wanted !== "en" };
}
export const t = (x: L10n | undefined, lang: GuideLang) => x?.[lang]?.trim() || x?.en?.trim() || "";

// ── Safety ───────────────────────────────────────────────────────────────────
const MAX = 8000;
/** Strips markup and control characters from admin-entered text. Rendering never uses HTML either. */
export function cleanText(v: unknown): string {
  return String(v ?? "")
    .replace(/<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .slice(0, MAX);
}
const cleanL10n = (x: unknown): L10n => {
  const out: L10n = {};
  if (x && typeof x === "object") for (const l of GUIDE_LANGS) { const v = (x as Record<string, unknown>)[l]; if (typeof v === "string" && v.trim()) out[l] = cleanText(v); }
  return out;
};
const cleanReviewed = (x: unknown) => {
  const out: Partial<Record<GuideLang, boolean>> = { en: true };
  if (x && typeof x === "object") for (const l of GUIDE_LANGS) if ((x as Record<string, unknown>)[l] === true) out[l] = true;
  return out;
};
const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const ROUTE = /^\/[a-z0-9/_\-[\]?=&.]*$/i;

export function cleanTour(x: unknown): TourContent {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const steps = Array.isArray(o.steps) ? o.steps.slice(0, 40) : [];
  return {
    title: cleanL10n(o.title),
    reviewed: cleanReviewed(o.reviewed),
    steps: steps.map((s, i) => {
      const st = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const id = typeof st.id === "string" && ID.test(st.id) ? st.id : `step-${i + 1}`;
      const target = typeof st.target === "string" && ID.test(st.target) ? st.target : undefined;
      const route = typeof st.route === "string" && ROUTE.test(st.route) ? st.route : undefined;
      const placement = ["auto", "top", "bottom", "left", "right"].includes(String(st.placement)) ? (st.placement as TourStep["placement"]) : "auto";
      return { id, title: cleanL10n(st.title), body: cleanL10n(st.body), target, route, placement, active: st.active !== false };
    }),
  };
}

export function cleanDoc(x: unknown): DocContent {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const sec = (o.sections && typeof o.sections === "object" ? o.sections : {}) as Record<string, unknown>;
  const sections: DocContent["sections"] = {};
  for (const [k] of DOC_SECTIONS) { const v = cleanL10n(sec[k]); if (Object.keys(v).length) sections[k] = v; }
  const faqs = Array.isArray(o.faqs) ? o.faqs.slice(0, 40) : [];
  return {
    title: cleanL10n(o.title),
    reviewed: cleanReviewed(o.reviewed),
    sections,
    faqs: faqs.map((f, i) => {
      const fo = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
      return { id: typeof fo.id === "string" && ID.test(fo.id) ? fo.id : `faq-${i + 1}`, q: cleanL10n(fo.q), a: cleanL10n(fo.a) };
    }),
  };
}

// ── Formatting subset ────────────────────────────────────────────────────────
// Paragraphs (blank line), "- " bullets, "1. " numbered steps, **bold**, and [label](/internal/path) links.
export type Inline = { text: string; bold?: boolean; href?: string };
export type Block = { kind: "p"; parts: Inline[] } | { kind: "ul" | "ol"; items: Inline[][] };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\/[^)\s]*)\)/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    if (m[1]) out.push({ text: m[1], bold: true }); else out.push({ text: m[2], href: m[3] });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

export function formatBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every((l) => /^[-•*]\s+/.test(l))) blocks.push({ kind: "ul", items: lines.map((l) => parseInline(l.replace(/^[-•*]\s+/, ""))) });
    else if (lines.every((l) => /^\d+[.)]\s+/.test(l))) blocks.push({ kind: "ol", items: lines.map((l) => parseInline(l.replace(/^\d+[.)]\s+/, ""))) });
    else blocks.push({ kind: "p", parts: parseInline(lines.join(" ")) });
  }
  return blocks;
}

// ── Audience ─────────────────────────────────────────────────────────────────
/** "owner" = clinic owner, "staff" = every staff member, "role:<name>" = staff with that role, "admin" = platform admin. */
export function parseAudience(json: string | null | undefined): string[] {
  try { const v = JSON.parse(json || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 40) : []; } catch { return []; }
}
