/** A photo sent from the upload dialog: a data-URL image up to ~1.5 MB, or null to remove it. */
export function isValidPhoto(p: unknown): p is string | null {
  return p === null || (typeof p === "string" && p.startsWith("data:image/") && p.length <= 2_000_000);
}
