"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, RotateCw, TriangleAlert, X } from "lucide-react";
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
      {/* The action sits beside the text when there's room, and wraps under it in narrow spaces. */}
      <div className="flex-1 min-w-0 flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="flex-1 min-w-[13rem]">
          <p className="text-sm font-semibold">{title}</p>
          {detail && <div className="text-sm text-foreground/80 mt-0.5">{detail}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export interface NoticeOptions { retry?: () => void; retryLabel?: string }
type HeldNotice = Notice & NoticeOptions & { id: number };

/**
 * Per-panel message state for <NoticeSlot/>. Errors and warnings stay until
 * dismissed or replaced; success confirmations clear themselves after a few
 * seconds since they need no action.
 */
export function useNotice(successMs = 6000) {
  const [notice, setNotice] = useState<HeldNotice | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (!notice || notice.tone !== "success" || !successMs) return;
    const t = setTimeout(() => setNotice((n) => (n?.id === notice.id ? null : n)), successMs);
    return () => clearTimeout(t);
  }, [notice, successMs]);

  return useMemo(() => {
    const show = (tone: NoticeTone) => (title: string, detail?: ReactNode, opts?: NoticeOptions) =>
      setNotice({ tone, title, detail, ...opts, id: ++seq.current });
    return {
      notice,
      error: show("error"),
      warning: show("warning"),
      success: show("success"),
      info: show("info"),
      clear: () => setNotice(null),
    };
  }, [notice]);
}

export type NoticeState = ReturnType<typeof useNotice>;

/** Renders the current message of a useNotice() state in place (nothing when empty). */
export function NoticeSlot({ state, className }: { state: NoticeState; className?: string }) {
  const n = state.notice;
  if (!n) return null;
  return (
    <InlineNotice
      tone={n.tone}
      title={n.title}
      detail={n.detail}
      className={cn("animate-in fade-in slide-in-from-top-1 duration-200", className)}
      onDismiss={state.clear}
      action={n.retry && (
        <button
          type="button"
          onClick={() => { state.clear(); n.retry?.(); }}
          className="inline-flex items-center gap-1.5 rounded-md border border-current/30 px-2.5 py-1 text-xs font-medium hover:bg-current/10 transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" /> {n.retryLabel ?? "Try again"}
        </button>
      )}
    />
  );
}

/**
 * In-place message for a section whose data didn't load, with a retry —
 * replaces an endless spinner or an empty panel.
 */
export function LoadFailed({ what, detail, onRetry, className }: { what: string; detail?: string; onRetry?: () => void; className?: string }) {
  return (
    <InlineNotice
      tone="error"
      title={`Couldn't load ${what}`}
      detail={`${detail || "Network error"}. Nothing has been changed${onRetry ? " — try again" : " — reload the page to try again"}.`}
      className={className}
      action={
        <button
          type="button"
          onClick={onRetry ?? (() => window.location.reload())}
          className="inline-flex items-center gap-1.5 rounded-md border border-current/30 px-2.5 py-1 text-xs font-medium hover:bg-current/10 transition-colors"
        >
          <RotateCw className="h-3.5 w-3.5" /> {onRetry ? "Try again" : "Reload"}
        </button>
      }
    />
  );
}
