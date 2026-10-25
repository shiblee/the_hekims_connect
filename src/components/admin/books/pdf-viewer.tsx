"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Maximize2, Minimize2, ZoomIn, ZoomOut, MoveHorizontal } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/**
 * Renders the original PDF one page at a time (pdf.js, canvas only — nothing
 * in the file is ever run as HTML). The page is controlled by the parent so
 * the English panel can follow it.
 */
export function PdfViewer({ data, page, onPageChange, onPageCount, className }: {
  data: ArrayBuffer | null;
  page: number;
  onPageChange: (page: number) => void;
  onPageCount?: (n: number) => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [width, setWidth] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // What is being typed into the page box; null = show the current page.
  const [typed, setTyped] = useState<string | null>(null);

  // Load the document.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setError(null); setDoc(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        loaded = await pdfjs.getDocument({ data: data.slice(0) }).promise;
        if (cancelled) { void loaded.destroy(); return; }
        setDoc(loaded);
        onPageCount?.(loaded.numPages);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("This PDF could not be displayed.");
      }
    })();
    return () => { cancelled = true; if (loaded) void loaded.destroy(); };
  }, [data]);

  // Track the available width for "fit to width".
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Render the current page.
  useEffect(() => {
    if (!doc || !canvasRef.current || !width) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    setRendering(true);
    (async () => {
      try {
        const p = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        const base = p.getViewport({ scale: 1 });
        const scale = zoom === "fit" ? Math.max(0.2, (width - 24) / base.width) : zoom;
        const viewport = p.getViewport({ scale });
        const ratio = window.devicePixelRatio || 1;
        const canvas = canvasRef.current!;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        task = p.render({ canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
        await task.promise;
      } catch (err: any) {
        if (!cancelled && err?.name !== "RenderingCancelledException") setError("This page could not be displayed.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, page, zoom, width]);

  const pages = doc?.numPages ?? 0;
  const go = (n: number) => { setTyped(null); if (pages) onPageChange(Math.min(Math.max(1, n), pages)); };
  const currentZoom = zoom === "fit" ? null : zoom;
  const stepZoom = (dir: 1 | -1) => {
    const now = currentZoom ?? 1;
    const next = dir > 0 ? ZOOMS.find((z) => z > now) : [...ZOOMS].reverse().find((z) => z < now);
    if (next) setZoom(next);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  };

  return (
    <div ref={wrapRef} className={cn("flex flex-col rounded-xl border border-border/60 bg-card/60 overflow-hidden", fullscreen && "bg-background", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
          <input
            aria-label="Page number"
            value={typed ?? String(page)}
            onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
            onBlur={() => typed !== null && go(parseInt(typed, 10) || page)}
            onKeyDown={(e) => { if (e.key === "Enter" && typed !== null) go(parseInt(typed, 10) || page); }}
            className="h-8 w-12 rounded-md border border-input bg-transparent text-center text-sm tabular-nums"
          />
          <span className="text-sm text-muted-foreground tabular-nums">of {pages || "…"}</span>
          <Button variant="ghost" size="icon" onClick={() => go(page + 1)} disabled={!pages || page >= pages} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => stepZoom(-1)} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
          <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">{currentZoom ? `${Math.round(currentZoom * 100)}%` : "Fit"}</span>
          <Button variant="ghost" size="icon" onClick={() => stepZoom(1)} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
          <Button variant={zoom === "fit" ? "secondary" : "ghost"} size="icon" onClick={() => setZoom("fit")} aria-label="Fit to width" title="Fit to width"><MoveHorizontal className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div ref={scrollRef} className={cn("relative flex-1 overflow-auto bg-muted/40 p-3", fullscreen ? "h-full" : "min-h-[60vh]")}>
        {error ? (
          <p className="p-6 text-sm text-destructive">{error}</p>
        ) : !doc ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading the PDF…</div>
        ) : null}
        <canvas ref={canvasRef} className={cn("mx-auto block bg-white shadow-sm", (!doc || error) && "hidden")} />
        {rendering && doc && <Loader2 className="absolute right-4 top-4 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
}
