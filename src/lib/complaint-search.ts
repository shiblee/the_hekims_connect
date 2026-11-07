/**
 * Search for master-list terms (chief complaints first) that copes with how
 * people actually type at a busy front desk:
 *  - English name, the classical Unani name in brackets ("Headache (Suda'a)"),
 *    the local-script name, synonyms (lay / Roman-Urdu / Hindi words) and category
 *  - apostrophes, hyphens and accents ignored ("suda", "su-e-hazm", "suaal")
 *  - word starts rank above partial matches, small typos still match ("headche")
 * Pure and client-safe; no database access.
 */

/** Lower-case, strip accents, apostrophes and punctuation; collapse spaces. */
export function normalizeTerm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘`ʼʿʾ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Like normalizeTerm but drops the bracketed classical name — for duplicate checks. */
export function normalizeLabelCore(label: string): string {
  return normalizeTerm(label.replace(/\([^)]*\)/g, " "));
}

/** Parse a JSON string array safely (synonyms column). */
export function parseSynonyms(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string" && !!x.trim());
  if (typeof raw !== "string" || !raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
  } catch {
    return [];
  }
}

/** Every searchable form of an entry: the label, its bracketed name, local name and synonyms. */
export function termVariants(entry: { label: string; labelLocal?: string | null; synonyms?: unknown }): string[] {
  const out = [entry.label];
  const bracket = entry.label.match(/\(([^)]*)\)/g);
  if (bracket) out.push(...bracket.map((b) => b.slice(1, -1)));
  out.push(normalizeLabelCore(entry.label));
  if (entry.labelLocal) out.push(entry.labelLocal);
  out.push(...parseSynonyms(entry.synonyms));
  return out.map(normalizeTerm).filter(Boolean);
}

// Levenshtein distance, stopping early once it's past `max`.
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const typoAllowance = (len: number) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

/** How well one query word matches one variant (0 = no match). */
function wordScore(qw: string, variant: string): number {
  const words = variant.split(" ");
  if (variant === qw) return 100;
  if (words.includes(qw)) return 90;
  if (words.some((w) => w.startsWith(qw))) return 75;
  if (variant.includes(qw)) return 55;
  const allow = typoAllowance(qw.length);
  if (allow) {
    for (const w of words) {
      // Compare against the word, and against its start of the same length (typo while still typing).
      const d = Math.min(editDistance(qw, w, allow), w.length > qw.length ? editDistance(qw, w.slice(0, qw.length), allow) : allow + 1);
      if (d <= allow) return 40 - d * 10;
    }
  }
  return 0;
}

/**
 * Score an entry for a query; 0 means it doesn't match. Every query word must
 * match some variant. `fuzzy` is true when the match needed a typo allowance.
 */
export function scoreEntryDetailed(query: string, variants: string[], category?: string | null): { score: number; fuzzy: boolean } {
  const q = normalizeTerm(query);
  if (!q) return { score: 0, fuzzy: false };
  const qWords = q.split(" ");
  const cat = category ? normalizeTerm(category) : "";
  // A whole-phrase hit on any variant beats word-by-word matching; whole words beat word starts.
  let best = 0;
  for (const v of variants) {
    if (v === q) best = Math.max(best, 1000);
    else if (v.startsWith(`${q} `)) best = Math.max(best, 900);
    else if (` ${v} `.includes(` ${q} `)) best = Math.max(best, 850);
    else if (v.startsWith(q)) best = Math.max(best, 750);
    else if (` ${v}`.includes(` ${q}`)) best = Math.max(best, 700);
    else if (v.includes(q)) best = Math.max(best, 500);
  }
  let total = 0;
  let fuzzy = false;
  for (const qw of qWords) {
    let w = 0;
    for (const v of variants) w = Math.max(w, wordScore(qw, v));
    if (!w && cat && wordScore(qw, cat) >= 55) w = 20; // category words count, but weakly
    if (!w) return { score: best, fuzzy: false }; // a word that matches nothing — only a phrase hit can still count
    if (w < 55) fuzzy = true;
    total += w;
  }
  return best >= total ? { score: best, fuzzy: false } : { score: total, fuzzy };
}

export function scoreEntry(query: string, variants: string[], category?: string | null): number {
  return scoreEntryDetailed(query, variants, category).score;
}

export interface SearchableEntry { id: string; label: string; labelLocal?: string | null; synonyms?: unknown; category?: string | null }

/**
 * Rank entries for a query, best first. Typo-tolerant matches are only offered
 * when nothing matches properly, so "suda" doesn't drag in look-alikes.
 */
export function searchEntries<T extends SearchableEntry>(entries: T[], query: string, limit = 10): T[] {
  if (!normalizeTerm(query)) return [];
  const scored: { e: T; s: number; fuzzy: boolean }[] = [];
  for (const e of entries) {
    const r = scoreEntryDetailed(query, variantsOf(e), e.category);
    if (r.score > 0) scored.push({ e, s: r.score, fuzzy: r.fuzzy });
  }
  const anyExact = scored.some((x) => !x.fuzzy);
  const kept = anyExact ? scored.filter((x) => !x.fuzzy) : scored;
  // Equal scores: the shorter (more general) name first — "Fever" before "Intermittent Fever".
  kept.sort((a, b) => b.s - a.s || a.e.label.length - b.e.label.length || a.e.label.localeCompare(b.e.label));
  return kept.slice(0, limit).map((x) => x.e);
}

const cache = new WeakMap<object, string[]>();
function variantsOf(e: SearchableEntry): string[] {
  let v = cache.get(e);
  if (!v) { v = termVariants(e); cache.set(e, v); }
  return v;
}

/** Which synonym/local name produced the match — shown under a result so staff see why it matched. */
export function matchedAlias(entry: SearchableEntry, query: string): string | null {
  const q = normalizeTerm(query);
  if (!q) return null;
  const inLabel = normalizeTerm(entry.label);
  if (inLabel.includes(q) || q.split(" ").every((w) => inLabel.includes(w))) return null;
  const aliases = [...(entry.labelLocal ? [entry.labelLocal] : []), ...parseSynonyms(entry.synonyms)];
  let best: { a: string; s: number } | null = null;
  for (const a of aliases) {
    const s = scoreEntry(q, [normalizeTerm(a)]);
    if (s > 0 && (!best || s > best.s)) best = { a, s };
  }
  return best?.a ?? null;
}

/** True when `term` is the same as an entry's name, bracketed name, local name or a synonym. */
export function isSameTerm(term: string, entry: { label: string; labelLocal?: string | null; synonyms?: unknown }): boolean {
  const n = normalizeTerm(term);
  return !!n && termVariants(entry).includes(n);
}
