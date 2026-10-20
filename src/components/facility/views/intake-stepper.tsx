"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

export type IntakeStep = "vitals" | "mizaj" | "handover";

export const INTAKE_STEPS: { key: IntakeStep }[] = [{ key: "vitals" }, { key: "mizaj" }, { key: "handover" }];

export function IntakeStepper({
  step, onStepChange, completedSteps,
}: {
  step: IntakeStep;
  onStepChange: (s: IntakeStep) => void;
  completedSteps: IntakeStep[];
}) {
  const tv = useTranslations("clinic.visit");
  return (
    <div className="flex items-center flex-wrap gap-2 mb-5">
      {INTAKE_STEPS.map((s, i) => {
        const isActive = s.key === step;
        const isDone = completedSteps.includes(s.key);
        return (
          <div key={s.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepChange(s.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : isDone
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-background/60 border-border/50 text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold shrink-0",
                isActive ? "bg-primary-foreground/20" : isDone ? "bg-emerald-500/20" : "bg-muted"
              )}>
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {tv(`step_${s.key}`)}
            </button>
            {i < INTAKE_STEPS.length - 1 && <div className="h-px w-4 bg-border shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
