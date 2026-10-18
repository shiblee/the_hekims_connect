import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  primary: "bg-primary/10 text-primary",
  danger: "bg-destructive/15 text-destructive",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
} as const;

/**
 * The one section heading used across the patient pages (Registration,
 * Clinical Record, the clinical stages): tinted icon tile + serif title,
 * with anything on the right (badges, status, actions) via `right`.
 */
export function SectionHeading({ icon: Icon, title, tone = "primary", right, className }: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  tone?: keyof typeof TONES;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between flex-wrap gap-2", className)}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", TONES[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <h2 className="font-serif text-lg font-semibold leading-tight">{title}</h2>
      </div>
      {right}
    </div>
  );
}
