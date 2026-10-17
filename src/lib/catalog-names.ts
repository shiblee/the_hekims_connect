const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Collapses whitespace so stored labels are tidy and comparable. */
export const cleanLabel = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * Every name a catalog label could be known by — "Black Seed (Kalonji)"
 * yields "black seed (kalonji)", "black seed" and "kalonji" — so a suggestion
 * that is the same substance under its other name still counts as a
 * duplicate. Shared by the catalog assistants (allergies, supplements/herbs).
 */
export function nameKeys(label: string): string[] {
  const keys = [norm(label)];
  const m = label.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (m) {
    if (m[1].trim()) keys.push(norm(m[1]));
    if (m[2].trim()) keys.push(norm(m[2]));
  }
  return keys;
}
