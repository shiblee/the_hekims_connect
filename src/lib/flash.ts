"use client";

import type { NoticeTone } from "@/components/shared/inline-notice";

// One-shot message carried across a navigation (e.g. "Patient registered" on
// the page you land on) — shown inline by <FlashNotice/> instead of a pop-up.
const KEY = "hekims-flash";

export interface Flash { tone: NoticeTone; title: string; detail?: string }

export function setFlash(f: Flash) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...f, at: Date.now() })); } catch { /* storage unavailable */ }
}

export function takeFlash(): Flash | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const f = JSON.parse(raw) as Flash & { at: number };
    return Date.now() - f.at < 60_000 ? f : null; // stale messages are dropped
  } catch {
    return null;
  }
}

/** "Saved at 10:42" — detail line for an in-place save confirmation. */
export function savedAt(d = new Date()) {
  return `Saved at ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
}
