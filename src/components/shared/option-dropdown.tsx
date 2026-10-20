"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, ChevronsUpDown, Circle, Sparkles, Square, SquareCheck } from "lucide-react";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** A, B, C … then numbers once the alphabet runs out. */
export const optionLetter = (i: number) => LETTERS[i] ?? String(i + 1);

export interface OptionCardItem { label: string; description?: string | null }

/**
 * The answer cards (letter, title, description, "Suggested" hint, tick) — shown inside an
 * OptionDropdown, or on the page where every option should stay visible (Admin preview).
 */
export function OptionCards({ options, selected, multiple, onToggle, hints, twoColumns }: {
  options: OptionCardItem[]; selected: string[]; multiple?: boolean; onToggle: (label: string) => void;
  /** option label → recorded finding that suggests it. */
  hints?: Record<string, string>;
  /** Two columns on wider screens (on the page); otherwise one under another, A → Z. */
  twoColumns?: boolean;
}) {
  const t = useTranslations("clinic.asbab");
  return (
    <div className={cn("grid gap-2", twoColumns && "sm:grid-cols-2")}>
      {options.map((o, i) => {
        const on = selected.includes(o.label);
        const hint = hints?.[o.label];
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => onToggle(o.label)}
            aria-pressed={on}
            title={hint ? t("suggested_title", { hint }) : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-2 text-start transition-colors",
              on ? "border-emerald-500/40 bg-emerald-500/10" : hint ? "border-dashed border-primary/50 bg-primary/5 hover:border-primary" : "border-border/50 bg-background/40 hover:border-primary/30",
            )}
          >
            <span className={cn(
              "h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-xs font-semibold",
              on ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
            )}>{optionLetter(i)}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium">{o.label}</span>
              {o.description && <span className="block text-[13px] text-muted-foreground leading-snug">{o.description}</span>}
              {hint && !on && (
                <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3 w-3 shrink-0" /> <span className="truncate">{t("suggested", { hint })}</span>
                </span>
              )}
            </span>
            {multiple
              ? (on ? <SquareCheck className="h-5 w-5 text-emerald-500 shrink-0" /> : <Square className="h-5 w-5 text-muted-foreground/40 shrink-0" />)
              : (on ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A compact answer box: shows what's chosen ("B · Shita") or the suggestion, and opens the
 * answer cards in a pop-up. Single choice closes on pick; multiple stays open.
 */
export function OptionDropdown({ id, options, value, onChange, multiple, hints, placeholder }: {
  id: string; options: OptionCardItem[]; value: string[]; onChange: (v: string[]) => void;
  multiple?: boolean; hints?: Record<string, string>; placeholder?: string;
}) {
  const t = useTranslations("clinic.asbab");
  const [open, setOpen] = useState(false);
  const toggle = (label: string) => {
    if (multiple) onChange(value.includes(label) ? value.filter((l) => l !== label) : [...value, label]);
    else { onChange(value.includes(label) ? [] : [label]); setOpen(false); }
  };
  const letterOf = (label: string) => {
    const i = options.findIndex((o) => o.label === label);
    return i < 0 ? "" : optionLetter(i);
  };
  const firstHint = options.find((o) => hints?.[o.label]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button" aria-expanded={open} className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-3.5 py-2 text-start transition-colors",
          open ? "border-primary" : "border-input hover:border-primary/40",
        )}>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {value.length > 0 ? value.map((l) => (
              <span key={l} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                {letterOf(l) && <span className="flex h-5 min-w-5 items-center justify-center rounded bg-emerald-500 px-1 text-[11px] font-semibold text-white">{letterOf(l)}</span>}{l}
              </span>
            )) : firstHint ? (
              <span className="flex min-w-0 items-center gap-1 text-sm text-primary">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t("suggested_pick", { option: `${letterOf(firstHint.label)} · ${firstHint.label}` })}</span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{placeholder ?? (multiple ? t("choose_many") : t("choose_one"))}</span>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[60vh] w-[max(var(--radix-popover-trigger-width),20rem)] max-w-[calc(100vw-2rem)] overflow-y-auto p-2">
        <OptionCards options={options} selected={value} multiple={multiple} onToggle={toggle} hints={hints} />
      </PopoverContent>
    </Popover>
  );
}

/** A question on the left and its answer on the right (stacked on phones). */
export function QuestionRow({ question, children, className }: { question: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start gap-3", className)}>
      <div className="min-w-[12rem] flex-1">{question}</div>
      <div className="w-full sm:w-[60%] sm:shrink-0">{children}</div>
    </div>
  );
}
