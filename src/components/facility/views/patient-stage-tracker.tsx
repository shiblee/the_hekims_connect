"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface StageTrackerStep {
  key: string;
  label: string;
  // Fixed descriptive text (e.g. "6 Pillars") that overrides the computed
  // Pending/In Progress/Complete status text — used for steps whose box is
  // more useful describing *what* the step covers than its live status.
  subtitle?: string;
  href?: string;
  // Overrides the computed complete/active/pending color + subtitle text for
  // this one step — used for a step with its own local unsaved-edits state
  // (e.g. the registration editor flagging itself "Unsaved Changes" in amber)
  // that the complete/active/pending data passed in from the parent can't see.
  variant?: "complete" | "active" | "pending" | "warning";
  variantLabel?: string;
}

/**
 * The patient's journey across this visit — Registration → Vitals & Intake →
 * Mizaj & Morphometry → Asbab-e-Sittah Review → Provisional Handover. Shared
 * across the pages that make up that journey so the same tracker follows the
 * patient from one page to the next; each step's complete/active state is
 * passed in by the caller from real data, never decorative.
 */
export function PatientStageTracker({
  steps, activeKey, completedKeys, onNavigate,
}: {
  steps: StageTrackerStep[];
  activeKey: string;
  completedKeys: string[];
  // When provided, a click navigates through this instead of router.push
  // directly — lets a page with its own unsaved-edits state (the
  // registration editor) intercept and confirm before leaving.
  onNavigate?: (href: string) => void;
}) {
  const router = useRouter();

  return (
    <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s, i) => {
        const isActive = s.key === activeKey;
        const isComplete = completedKeys.includes(s.key);
        const variant = s.variant ?? (isComplete ? "complete" : isActive ? "active" : "pending");
        const subtitle = s.variantLabel || s.subtitle || (
          variant === "complete" ? "Complete" : variant === "active" ? "In Progress" : variant === "warning" ? "Attention" : "Pending"
        );
        const clickable = !!s.href && !isActive;

        return (
          <button
            key={s.key}
            type="button"
            disabled={!clickable}
            onClick={() => {
              if (!s.href) return;
              if (onNavigate) onNavigate(s.href);
              else router.push(s.href);
            }}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors min-w-0",
              variant === "active"
                ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_0_1px_oklch(0.72_0.13_175/0.25)]"
                : variant === "warning"
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-border/50 bg-card/60",
              clickable && "hover:border-primary/40 cursor-pointer",
              !clickable && "cursor-default"
            )}
          >
            <span className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
              variant === "complete" ? "bg-emerald-500 text-white"
                : variant === "active" ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : variant === "warning" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                : "bg-muted text-muted-foreground"
            )}>
              {variant === "complete" ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cn(
                "text-sm font-semibold truncate",
                variant === "active" ? "text-emerald-700 dark:text-emerald-400" : variant === "warning" ? "text-amber-700 dark:text-amber-400" : "text-foreground"
              )}>
                {s.label}
              </p>
              <p className={cn(
                "text-[10px] font-semibold uppercase tracking-wide truncate",
                variant === "active" ? "text-emerald-600 dark:text-emerald-400"
                  : variant === "warning" ? "text-amber-600 dark:text-amber-400"
                  : variant === "complete" ? "text-emerald-600/80 dark:text-emerald-400/80"
                  : "text-muted-foreground"
              )}>
                {subtitle}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const PATIENT_JOURNEY_STEPS: StageTrackerStep[] = [
  { key: "registration", label: "Patient Registration" },
  { key: "vitals", label: "Acute Vitals & Intake" },
  { key: "mizaj", label: "Mizaj & Morphometry" },
  { key: "asbab", label: "Asbab-e-Sittah Review", subtitle: "6 Pillars" },
  { key: "handover", label: "Provisional Handover", subtitle: "Doctor Review" },
];
