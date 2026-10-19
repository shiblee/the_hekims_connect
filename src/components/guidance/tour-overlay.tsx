"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GuideText } from "./guide-text";
import { guideUi } from "@/lib/guidance/ui-strings";
import type { TourPayload } from "@/lib/guidance/viewer-content";

const PAD = 6, GAP = 12, CARD_W = 360;

function findTarget(id?: string): HTMLElement | null {
  if (!id) return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`));
  return all.find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; }) ?? null;
}
const onRoute = (path: string, route?: string) => !route || path === route || path.startsWith(`${route}/`);

/**
 * One step of a guided tour: a spotlight around the step's marked element (if it's on screen)
 * and a card with the explanation. The page underneath stays fully usable — the tour never
 * clicks, types or navigates by itself.
 */
export function TourOverlay({ tour, step, routeName, hasDoc, onStep, onClose, onSkip, onFinish, onOpenDoc }: {
  tour: TourPayload; step: number; routeName: (route: string) => string; hasDoc: boolean;
  onStep: (n: number) => void; onClose: () => void; onSkip: () => void; onFinish: () => void; onOpenDoc: () => void;
}) {
  const path = usePathname() || "/";
  const router = useRouter();
  const s = tour.steps[Math.min(step, tour.steps.length - 1)];
  const ui = guideUi(tour.lang);
  const last = step >= tour.steps.length - 1;
  const elsewhere = !onRoute(path, s.route);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [card, setCard] = useState<{ w: number; h: number }>({ w: CARD_W, h: 220 });
  const [vw, setVw] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Find the step's element (it may render late), bring it into view, then follow it on scroll / resize.
  useEffect(() => {
    if (elsewhere) { setRect(null); return; }
    let el: HTMLElement | null = null, tries = 0, raf = 0;
    const measure = () => { setRect(el ? el.getBoundingClientRect() : null); setVw(window.innerWidth); };
    const look = setInterval(() => {
      el = findTarget(s.target);
      if (el || ++tries > 12) {
        clearInterval(look);
        if (el) el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        measure();
      }
    }, 120);
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    const tick = setInterval(measure, 400);
    setVw(window.innerWidth);
    return () => { clearInterval(look); clearInterval(tick); cancelAnimationFrame(raf); window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [s.target, s.id, elsewhere]);

  useLayoutEffect(() => {
    if (cardRef.current) { const r = cardRef.current.getBoundingClientRect(); setCard({ w: r.width, h: r.height }); }
  }, [s.id, rect, elsewhere]);
  useEffect(() => { cardRef.current?.focus({ preventScroll: true }); }, [s.id]);

  const keys = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if ((e.key === "ArrowRight" && !tour.rtl) || (e.key === "ArrowLeft" && tour.rtl)) { if (!last) onStep(step + 1); }
    else if ((e.key === "ArrowLeft" && !tour.rtl) || (e.key === "ArrowRight" && tour.rtl)) { if (step > 0) onStep(step - 1); }
  }, [onClose, onStep, step, last, tour.rtl]);
  useEffect(() => { window.addEventListener("keydown", keys); return () => window.removeEventListener("keydown", keys); }, [keys]);

  // Card position: next to the element (placement, mirrored for right-to-left), clamped to the screen.
  const mobile = vw > 0 && vw < 640;
  let style: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect && !mobile) {
    const H = window.innerHeight, W = window.innerWidth;
    let place = s.placement && s.placement !== "auto" ? s.placement : rect.bottom + GAP + card.h < H ? "bottom" : rect.top - GAP - card.h > 0 ? "top" : "right";
    if (tour.rtl && (place === "left" || place === "right")) place = place === "left" ? "right" : "left";
    let left = rect.left + rect.width / 2 - card.w / 2, top = rect.bottom + PAD + GAP;
    if (place === "top") top = rect.top - PAD - GAP - card.h;
    if (place === "right") { left = rect.right + PAD + GAP; top = rect.top + rect.height / 2 - card.h / 2; }
    if (place === "left") { left = rect.left - PAD - GAP - card.w; top = rect.top + rect.height / 2 - card.h / 2; }
    left = Math.max(12, Math.min(left, W - card.w - 12)); top = Math.max(12, Math.min(top, H - card.h - 12));
    style = { left, top };
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {rect ? (
        <div
          className="absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{ left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)" }}
        />
      ) : <div className="absolute inset-0 bg-slate-900/30" />}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-step-title"
        tabIndex={-1}
        dir={tour.rtl ? "rtl" : "ltr"}
        lang={tour.lang}
        className={cn(
          "pointer-events-auto absolute rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl outline-none",
          mobile ? "!inset-x-2 !bottom-2 !left-2 !right-2 !top-auto !translate-x-0 !translate-y-0" : "w-[min(360px,calc(100vw-24px))]",
        )}
        style={mobile ? undefined : style}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{tour.title} · {ui.stepOf(step + 1, tour.steps.length)}</p>
          <button type="button" onClick={onClose} aria-label={ui.close} title={ui.closeHint} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-3 flex gap-1" aria-hidden>
          {tour.steps.map((x, i) => <span key={x.id} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />)}
        </div>
        <h2 id="tour-step-title" className="mb-1 font-semibold leading-snug">{s.title}</h2>
        <GuideText text={s.body} className="text-muted-foreground" />
        {elsewhere && s.route && (
          <div className="mt-3 rounded-lg bg-primary/5 p-2.5 text-sm">
            <p>{ui.onOtherPage(routeName(s.route))}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => router.push(s.route!)}><ExternalLink className="h-3.5 w-3.5" /> {ui.openPage(routeName(s.route))}</Button>
          </div>
        )}
        {!elsewhere && s.target && !rect && <p className="mt-2 text-xs text-muted-foreground">{ui.notOnScreen}</p>}
        {tour.isFallback && <p className="mt-2 text-[11px] text-muted-foreground">{ui.fallback}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={onSkip} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">{ui.skip}</button>
            {hasDoc && <button type="button" onClick={onOpenDoc} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10"><BookOpen className="h-3.5 w-3.5" />{ui.fullTutorial}</button>}
          </div>
          <div className="flex gap-2">
            {step > 0 && <Button size="sm" variant="outline" onClick={() => onStep(step - 1)}><ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" /> {ui.previous}</Button>}
            {last
              ? <Button size="sm" onClick={onFinish}><Check className="h-3.5 w-3.5" /> {ui.finish}</Button>
              : <Button size="sm" onClick={() => onStep(step + 1)}>{ui.next} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
