import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Readable date only, e.g. "Sep 28, 2026". */
export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Readable date + 12-hour time, e.g. "Sep 28, 2026, 11:12 PM". */
export function formatDateTime(iso: string | Date): string {
  return new Date(iso).toLocaleString("en-US", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}
