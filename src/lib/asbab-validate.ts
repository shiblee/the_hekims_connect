const TYPES = new Set(["single_select", "multi_select", "numeric", "text"]);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.max(-10, Math.min(10, n)) : 0; };
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Validates an admin question payload. Returns [data, options] or an error message. */
export function parseQuestionBody(b: any): { error: string } | {
  data: { label: string; labelLocal: string | null; helpText: string | null; type: string; required: boolean; weight: number; showIfQuestionId: string | null; showIfOption: string | null };
  options: { label: string; description: string | null; safra: number; dam: number; balgham: number; sauda: number; active: boolean }[] | null;
} {
  const label = str(b.label);
  if (!label) return { error: "Question text is required" };
  if (!TYPES.has(b.type)) return { error: "Choose an answer type" };
  const isChoice = b.type === "single_select" || b.type === "multi_select";
  let options: { label: string; description: string | null; safra: number; dam: number; balgham: number; sauda: number; active: boolean }[] | null = null;
  if (Array.isArray(b.options)) {
    options = b.options
      .filter((o: any) => str(o?.label))
      .map((o: any) => ({
        label: str(o.label), description: str(o.description) || null,
        safra: num(o.safra), dam: num(o.dam), balgham: num(o.balgham), sauda: num(o.sauda), active: o.active !== false,
      }));
    const labels = options!.map((o) => o.label.toLowerCase());
    if (new Set(labels).size !== labels.length) return { error: "Two options have the same text" };
  }
  if (isChoice && (!options || options.filter((o) => o.active).length < 2)) return { error: "Add at least two active options" };
  const weight = Number(b.weight);
  return {
    data: {
      label, labelLocal: str(b.labelLocal) || null, helpText: str(b.helpText) || null, type: b.type,
      required: !!b.required, weight: Number.isFinite(weight) ? Math.max(0, Math.min(5, weight)) : 1,
      showIfQuestionId: str(b.showIfQuestionId) || null, showIfOption: str(b.showIfQuestionId) ? str(b.showIfOption) || null : null,
    },
    options: isChoice ? options : [],
  };
}

const REVIEW = new Set(["draft", "approved", "retired"]);
const strList = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()))].slice(0, 200) : []);

/** Adaptive-selection metadata (Dala'il). Returns only the fields present in the body. */
export function parseSelectionMeta(b: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (b.appliesTo && typeof b.appliesTo === "object") {
    const a = b.appliesTo;
    const clean: Record<string, unknown> = {};
    if (a.always) clean.always = true;
    for (const k of ["categories", "complaints", "symptoms", "regions"]) { const l = strList(a[k]); if (l.length) clean[k] = l; }
    if (a.sex === "male" || a.sex === "female") clean.sex = a.sex;
    for (const k of ["minAge", "maxAge"]) { const n = Number(a[k]); if (a[k] !== "" && a[k] != null && Number.isFinite(n) && n >= 0 && n <= 120) clean[k] = Math.round(n); }
    out.appliesTo = JSON.stringify(clean);
  }
  if (b.priority !== undefined) { const n = Number(b.priority); out.priority = Number.isFinite(n) ? Math.max(1, Math.min(5, Math.round(n))) : 3; }
  if (b.safetyCritical !== undefined) out.safetyCritical = !!b.safetyCritical;
  if (typeof b.reviewStatus === "string" && REVIEW.has(b.reviewStatus)) out.reviewStatus = b.reviewStatus;
  if (b.purpose !== undefined) out.purpose = str(b.purpose).slice(0, 200) || null;
  if (b.reference !== undefined) out.reference = str(b.reference).slice(0, 300) || null;
  return out;
}
