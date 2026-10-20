// Food photos in /public/foods have small square WebP thumbnails in /public/foods/thumb (128 px,
// ~3 KB) — the Stage 5 lists show photos at 44–64 px, and the full-size files are far heavier
// to send to clinics far from the server. Any other image URL is used as it is.
export function foodThumb(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/^\/foods\/([^/]+)\.(jpe?g|png|webp)$/i);
  return m ? `/foods/thumb/${m[1]}.webp` : url;
}
