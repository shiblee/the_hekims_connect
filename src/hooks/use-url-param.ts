"use client";

import { useCallback, useSyncExternalStore } from "react";

// Keeps a piece of UI state (the open tab, section or list) in the page URL as
// a query parameter, so every tab has its own address: it can be bookmarked,
// shared, reloaded, and the browser Back button steps through tabs.
// Reads window.location directly (no Suspense boundary needed).

const EVENT = "url-param-change";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => { window.removeEventListener("popstate", cb); window.removeEventListener(EVENT, cb); };
}

/** [value, setValue] for `?name=` — `fallback` when absent or not one of `allowed`. */
export function useUrlParam<T extends string>(name: string, fallback: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
  const value = (raw && (!allowed || allowed.includes(raw as T)) ? raw : fallback) as T;
  const setValue = useCallback((v: T) => {
    const url = new URL(window.location.href);
    if (v === fallback) url.searchParams.delete(name); else url.searchParams.set(name, v);
    if (url.href === window.location.href) return;
    window.history.pushState(window.history.state, "", url);
    window.dispatchEvent(new Event(EVENT));
  }, [name, fallback]);
  return [value, setValue];
}
