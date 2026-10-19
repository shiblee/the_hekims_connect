import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Dates follow the page's language (set on <html lang>), with Western digits; English is unchanged. */
function dateLocale(): string {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "en";
  return !lang || lang === "en" ? "en-US" : `${lang}-u-nu-latn`;
}

/** Readable date only, e.g. "Sep 28, 2026". */
export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
}

/** Readable date + 12-hour time, e.g. "Sep 28, 2026, 11:12 PM". */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString(dateLocale(), {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
