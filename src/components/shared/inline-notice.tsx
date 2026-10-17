"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "error" | "warning" | "success" | "info";
export interface Notice { tone: NoticeTone; title: string; detail?: ReactNode }

const STYLES: Record<NoticeTone, { box: string; icon: typeof Info }> = {
  error: { box: "border-destructive/40 bg-destructive/5 text-destructive", icon: AlertCircle },
  warning: { box: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400", icon: TriangleAlert },
  success: { box: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
  info: { box: "border-primary/30 bg-primary/5 text-primary", icon: Info },
};

/**
 * A message shown in place, next to what it is about — used instead of
 * pop-up toasts so nothing important disappears before it's read. Errors are
 * announced to screen readers immediately (role="alert"); the rest politely.
 */
export function InlineNotice({ tone, title, detail, action, onDismiss, className }: Notice & {
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const s = STYLES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3", s.box, className)}>
      <s.icon className="h-4.5 w-4.5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {detail && <div className="text-sm text-foreground/80 mt-0.5">{detail}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
