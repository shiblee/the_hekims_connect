"use client";

import { useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Multi-select filter for admin list pages: nothing ticked means "all".
 * Shows the single picked label, or "N selected"; long lists get a search box.
 */
export function FilterMultiSelect({
  label, value, onChange, options, allLabel, className, hideLabel,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: [string, string][];
  allLabel: string;
  className?: string;
  /** Inline filter bars without a caption above the box. */
  hideLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = q.trim() ? options.filter(([, l]) => l.toLowerCase().includes(q.trim().toLowerCase())) : options;
  const picked = options.filter(([v]) => value.includes(v));
  const summary = value.length === 0 ? allLabel : picked.length === 1 ? picked[0][1] : `${value.length} selected`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className={cn("min-w-0", className)}>
      {!hideLabel && <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>}
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={hideLabel ? label : undefined}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background/60 px-3 text-sm shadow-xs transition-colors hover:border-primary/40",
              value.length > 0 && "border-primary/50 text-primary"
            )}
          >
            <span className="truncate">{summary}</span>
            <span className="flex shrink-0 items-center gap-1">
              {value.length > 1 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{value.length}</span>}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-1">
          {options.length > 7 && (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm outline-none focus:border-primary/50" />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            <button type="button" onClick={() => onChange([])} className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted", value.length === 0 && "font-medium")}>
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border", value.length === 0 ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{value.length === 0 && <Check className="h-3 w-3" />}</span>
              {allLabel}
            </button>
            {shown.map(([v, l]) => {
              const on = value.includes(v);
              return (
                <button key={v} type="button" onClick={() => toggle(v)} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted">
                  <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border", on ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{on && <Check className="h-3 w-3" />}</span>
                  <span className="truncate">{l}</span>
                </button>
              );
            })}
            {shown.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No matches</p>}
          </div>
          {value.length > 0 && (
            <div className="mt-1 border-t border-border pt-1">
              <button type="button" onClick={() => onChange([])} className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Clear selection
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
