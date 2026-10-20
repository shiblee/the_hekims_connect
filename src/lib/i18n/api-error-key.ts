/**
 * Translation key of a server error sentence: "e_" + a short stable hash of the
 * exact English text. The server keeps sending English; the clinic, staff and
 * patient apps look the sentence up by this key (see app-strings/api-errors.ts).
 */
export function apiErrorKey(english: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < english.length; i++) {
    h ^= english.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `e_${h.toString(36)}`;
}
