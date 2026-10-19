// One rule for every option list in the portal: A–Z (case-insensitive, numbers in
// natural order), with catch-all choices like "Other" / "None" kept at the end and
// "Self" (relationship) kept first. Ordered scales (severity, grades, days, units)
// are not option catalogues and should not be passed through this.

const LAST = /^(other|others|none|none of the above|not sure|unknown|prefer not to say|not applicable|n\/a)(\s*[(/:–-].*)?$/i;
const FIRST = /^self$/i;

const rank = (s: string) => (FIRST.test(s.trim()) ? 0 : LAST.test(s.trim()) ? 2 : 1);

export function compareLabels(a: string, b: string): number {
  const ra = rank(a), rb = rank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b, "en", { sensitivity: "base", numeric: true });
}

/** A sorted copy; `label` picks the text to sort by (defaults to `.label`). */
export function sortByLabel<T>(items: readonly T[], label: (item: T) => string = (item) => (item as { label: string }).label): T[] {
  return [...items].sort((a, b) => compareLabels(label(a) ?? "", label(b) ?? ""));
}

export const sortLabels = (labels: readonly string[]) => sortByLabel(labels, (s) => s);

/** Search results: A–Z, but labels that start with what was typed come first (so Enter picks the closest match). */
export function sortSearchResults<T>(items: readonly T[], query: string, label: (item: T) => string = (item) => (item as { label: string }).label): T[] {
  const sorted = sortByLabel(items, label);
  const q = query.trim().toLowerCase();
  if (!q) return sorted;
  return [...sorted.filter((i) => label(i).toLowerCase().startsWith(q)), ...sorted.filter((i) => !label(i).toLowerCase().startsWith(q))];
}
