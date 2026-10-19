"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GUIDANCE_MODULES } from "@/lib/guidance/registry";
import type { TourPayload } from "@/lib/guidance/viewer-content";
import { TourOverlay } from "./tour-overlay";

interface Client { get: <T = unknown>(url: string) => Promise<T>; post: <T = unknown>(url: string, body?: unknown) => Promise<T>; patch: <T = unknown>(url: string, body?: unknown) => Promise<T> }
export interface PageTour { id: string; title: string; state: "new" | "in_progress" | "completed" | "skipped"; step: number; outdated: boolean }
export interface GuidanceState {
  on: boolean; toursOn?: boolean; docsOn?: boolean; lang?: string;
  module?: { key: string; name: string; hasDoc: boolean } | null;
  pageTours?: PageTour[]; autostart?: TourPayload | null;
}
interface Ctx {
  state: GuidanceState;
  client: Client;
  startTour: (id: string, resume?: boolean) => Promise<void>;
  /** Opens the tour's page first if needed, then starts (or resumes) it there. */
  openTour: (id: string, route: string, resume?: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  /** Module whose tutorial the help panel shows (null = the current page's). */
  helpModule: string | null;
  openHelp: (moduleKey?: string) => void;
  refresh: () => void;
}

const GuidanceContext = createContext<Ctx | null>(null);
/** Guidance for the current page; null outside the clinic app / admin panel. */
export const useGuidance = () => useContext(GuidanceContext);

const routeName = (route: string) => GUIDANCE_MODULES.find((m) => m.route === route)?.name ?? route;

/**
 * Loads guidance for each page, starts a first-sign-in / first-visit tour once (per tour version),
 * runs tours and records progress. Any failure simply means "no guidance" — the app is unaffected.
 */
export function GuidanceProvider({ client, children, renderHelp }: { client: Client; children: ReactNode; renderHelp?: () => ReactNode }) {
  const path = usePathname() || "/";
  const router = useRouter();
  const [state, setState] = useState<GuidanceState>({ on: false });
  const [active, setActive] = useState<{ tour: TourPayload; step: number } | null>(null);
  const [helpOpen, setHelpOpenRaw] = useState(false);
  const [helpModule, setHelpModule] = useState<string | null>(null);
  const setHelpOpen = useCallback((open: boolean) => { setHelpOpenRaw(open); if (!open) setHelpModule(null); }, []);
  const openHelp = useCallback((moduleKey?: string) => { setHelpModule(moduleKey ?? null); setHelpOpenRaw(true); }, []);
  const shown = useRef(new Set<string>());

  const load = useCallback(async () => {
    try { setState(await client.get<GuidanceState>(`/api/guidance/state?path=${encodeURIComponent(path)}`)); }
    catch { setState({ on: false }); }
  }, [client, path]);
  useEffect(() => {
    let stale = false;
    client.get<GuidanceState>(`/api/guidance/state?path=${encodeURIComponent(path)}`)
      .then((r) => { if (!stale) setState(r); })
      .catch(() => { if (!stale) setState({ on: false }); });
    return () => { stale = true; };
  }, [client, path]);

  const save = useCallback((tourId: string, st: string, step: number) => {
    client.post("/api/guidance/progress", { tourId, state: st, step }).catch(() => {});
  }, [client]);

  const begin = useCallback((tour: TourPayload, step: number) => {
    shown.current.add(tour.id);
    setHelpOpen(false);
    setActive({ tour, step });
    save(tour.id, "in_progress", step);
  }, [save]);

  // Automatic start: at most once per tour per browser session (the server also remembers it).
  useEffect(() => {
    const a = state.autostart;
    if (!a || active || shown.current.has(a.id)) return;
    const timer = setTimeout(() => begin(a, 0), 900);
    return () => clearTimeout(timer);
  }, [state.autostart, active, begin]);

  const startTour = useCallback(async (id: string, resume = false) => {
    try {
      const r = await client.get<{ tour: TourPayload | null; progress: { state: string; step: number } | null }>(`/api/guidance/tour/${id}`);
      if (r.tour) begin(r.tour, resume && r.progress?.state === "in_progress" ? Math.min(r.progress.step, r.tour.steps.length - 1) : 0);
    } catch { /* unavailable — nothing to show */ }
  }, [client, begin]);

  // A tour requested from another page arrives as ?guide=<id>[&resume=1].
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const id = sp.get("guide");
    if (!id) return;
    const resume = sp.get("resume") === "1";
    sp.delete("guide"); sp.delete("resume");
    window.history.replaceState(null, "", window.location.pathname + (sp.toString() ? `?${sp}` : ""));
    const timer = setTimeout(() => startTour(id, resume), 700);
    return () => clearTimeout(timer);
  }, [path, startTour]);

  const openTour = useCallback((id: string, route: string, resume = false) => {
    if (path === route || path.startsWith(`${route}/`)) startTour(id, resume);
    else router.push(`${route}?guide=${encodeURIComponent(id)}${resume ? "&resume=1" : ""}`);
  }, [path, router, startTour]);

  const end = (st: "in_progress" | "completed" | "skipped") => {
    if (!active) return;
    save(active.tour.id, st, active.step);
    setActive(null);
    setTimeout(load, 300);
  };

  return (
    <GuidanceContext.Provider value={{ state, client, startTour, openTour, helpOpen, setHelpOpen, helpModule, openHelp, refresh: load }}>
      {children}
      {state.on && renderHelp?.()}
      {active && (
        <TourOverlay
          tour={active.tour}
          step={active.step}
          routeName={routeName}
          hasDoc={!!state.docsOn && !!state.module?.hasDoc}
          onStep={(n) => { setActive({ ...active, step: n }); save(active.tour.id, "in_progress", n); }}
          onClose={() => end("in_progress")}
          onSkip={() => end("skipped")}
          onFinish={() => end("completed")}
          onOpenDoc={() => { end("in_progress"); setHelpOpen(true); }}
        />
      )}
    </GuidanceContext.Provider>
  );
}
