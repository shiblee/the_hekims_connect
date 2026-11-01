"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Open/closed state for the stage pages' "Insights & notes" slide-over; Esc closes it. */
export function useInsightsDrawer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return { open, setOpen };
}

/** The "Insights & notes" button that opens the slide-over (sits above the stage content, right-aligned). */
export function InsightsButton({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  const t = useTranslations("clinic.record");
  return (
    <div className="mb-3 flex justify-end">
      <Button variant="outline" size="sm" onClick={onOpen} aria-expanded={open} aria-controls="stage-insights"
        className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
        <Sparkles className="h-4 w-4" /> {t("insights_btn")}
      </Button>
    </div>
  );
}

/**
 * Slide-over for a stage page's side cards (Hakeem Insight, notes, earlier findings…), drawn over
 * the content. Always mounted, so cards that save through refs keep working while it's closed.
 */
export function InsightsDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTranslations("clinic.record");
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />}
      <aside id="stage-insights" role="dialog" aria-modal={open} aria-label={t("insights_title")} aria-hidden={!open} inert={!open}
        className={cn("fixed inset-y-0 end-0 z-50 flex w-full max-w-[28rem] flex-col border-s border-border bg-background shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full")}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="flex items-center gap-2 font-serif text-lg font-semibold"><Sparkles className="h-4 w-4 text-primary" />{t("insights_title")}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label={t("insights_close")}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}
