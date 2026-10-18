"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Check, ChevronRight, Lock, TriangleAlert } from "lucide-react";

export interface StageTrackerStep {
  key: string;
  label: string;
  // Short line under the label — the Unani term / what the step covers.
  subtitle?: string;
  // Shown on hover/focus: what happens at this step, in plain words.
  description?: string;
  href?: string;
  // Overrides the computed complete/active/pending state for this one step —
  // used for a step with its own local unsaved-edits state (e.g. the
  // registration editor flagging itself "Unsaved changes" in amber) that the
  // complete/active/pending data passed in from the parent can't see.
  variant?: "complete" | "active" | "pending" | "warning";
  variantLabel?: string;
}

/**
 * The patient's journey across this visit, as a connected stepper: a line
 * that fills as steps are completed, plain-language step names with the Unani
 * term underneath, and a hover card explaining each step. Shared across the
 * pages that make up that journey; each step's complete/active state is
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
  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === activeKey));
  const go = (href: string) => (onNavigate ? onNavigate(href) : router.push(href));

  return (
    <nav aria-label="Visit progress" className="mb-5 rounded-xl border border-border/50 bg-card/60 px-3 py-2">
      <ol className="flex items-center">
        {steps.map((s, i) => {
          const isComplete = completedKeys.includes(s.key);
          const variant = s.variant ?? (isComplete ? "complete" : s.key === activeKey ? "active" : "pending");
          const isNext = variant === "pending" && i === activeIndex + 1;
          const status = s.variantLabel
            ?? (variant === "complete" ? "Done" : variant === "active" ? "You are here" : variant === "warning" ? "Needs attention" : isNext ? "Up next" : "Later");
          const clickable = !!s.href && variant !== "active";
          const hint = clickable ? "Click to open this step" : variant === "active" ? "You're working on this step" : variant === "pending" ? "Opens once the earlier steps are done" : null;
          const last = i === steps.length - 1;

          return (
            <li key={s.key} className={cn("flex items-center", !last && "flex-1")}>
              <button
                type="button"
                aria-current={variant === "active" ? "step" : undefined}
                aria-disabled={!clickable}
                aria-label={`${s.label} — ${status}`}
                onClick={() => { if (clickable && s.href) go(s.href); }}
                className={cn(
                  "group relative flex items-center gap-2 rounded-full p-0.5 sm:pr-2.5 outline-none transition-colors shrink-0 whitespace-nowrap",
                  clickable ? "cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/60" : "cursor-default",
                  variant === "active" && "bg-emerald-500/10",
                  variant === "warning" && "bg-amber-500/10",
                )}
              >
                <span className={cn(
                  "relative h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform",
                  variant === "complete" && "bg-emerald-500 text-white",
                  variant === "active" && "bg-emerald-500 text-white",
                  variant === "warning" && "bg-amber-500 text-white",
                  variant === "pending" && (isNext ? "bg-card border-2 border-emerald-500/60 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"),
                  clickable && "group-hover:scale-110",
                )}>
                  {variant === "active" && <span aria-hidden className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping [animation-duration:2.4s]" />}
                  <span className="relative">
                    {variant === "complete" ? <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      : variant === "warning" ? <TriangleAlert className="h-3.5 w-3.5" />
                        : variant === "pending" && !isNext ? <Lock className="h-3 w-3" /> : i + 1}
                  </span>
                </span>
                <span className={cn(
                  "text-sm font-semibold",
                  // Only the current step is always named; the rest show their names once there's room.
                  variant !== "active" ? "hidden xl:inline" : "hidden sm:inline",
                  variant === "active" ? "text-emerald-700 dark:text-emerald-400" : variant === "warning" ? "text-amber-700 dark:text-amber-400" : variant === "pending" ? "text-muted-foreground" : "text-foreground",
                  clickable && "group-hover:text-primary",
                )}>
                  {s.label}
                </span>

                {/* Hover / keyboard-focus card: what this step is for. */}
                <span
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute top-full z-30 mt-2 w-64 rounded-xl border border-border/60 bg-popover p-3 text-left shadow-lg",
                    "opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0 group-focus-visible:opacity-100 group-focus-visible:translate-y-0",
                    i === 0 ? "left-0" : last ? "right-0" : "left-1/2 -translate-x-1/2",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">Step {i + 1} · {s.label}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">{status}</span>
                  </span>
                  {s.subtitle && <span className="block text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">{s.subtitle}</span>}
                  {s.description && <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{s.description}</span>}
                  {hint && (
                    <span className={cn("mt-2 flex items-center gap-1 text-[11px] font-medium", clickable ? "text-primary" : "text-muted-foreground")}>
                      {clickable && <ChevronRight className="h-3 w-3" />}{hint}
                    </span>
                  )}
                </span>
              </button>

              {!last && (
                <span aria-hidden className="flex-1 min-w-4 h-0.5 mx-1.5 rounded-full bg-border overflow-hidden">
                  <span className={cn(
                    "block h-full transition-all duration-500",
                    isComplete || variant === "complete" ? "w-full bg-emerald-500" : variant === "active" ? "w-1/2 bg-emerald-500/50" : "w-0",
                  )} />
                </span>
              )}
            </li>
          );
        })}
        <li className="hidden lg:block shrink-0 pl-3 ml-1 border-l border-border/60 text-xs text-muted-foreground whitespace-nowrap">
          Step <span className="font-semibold text-foreground">{activeIndex + 1}</span>/{steps.length}
        </li>
      </ol>
    </nav>
  );
}

export const PATIENT_JOURNEY_STEPS: StageTrackerStep[] = [
  {
    key: "registration", label: "Registration", subtitle: "Patient details",
    description: "Who the patient is, how to reach them, and why they've come in today — filled in at the front desk.",
  },
  {
    key: "vitals", label: "Vitals & Triage", subtitle: "Health check",
    description: "Vital signs, the red-flag safety screen and the patient's main complaints.",
  },
  {
    key: "mizaj", label: "Temperament", subtitle: "Mizaj assessment",
    description: "The doctor's assessment of temperament (Mizaj), affected body regions, and when and how the complaints began.",
  },
  {
    key: "asbab", label: "Lifestyle Factors", subtitle: "Asbab-e-Sittah",
    description: "The six essential factors: air, food & drink, physical activity & rest, sleep & wakefulness, retention & elimination, and emotions.",
  },
  {
    key: "handover", label: "Diagnosis & Plan", subtitle: "Tashkhees & handover",
    description: "The diagnosis (Tashkhees), the treatment plan of diet, medicine and regimen, and the handover to the next carer.",
  },
];
