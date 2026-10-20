"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { sortByLabel } from "@/lib/sort-options";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

/**
 * A searchable single-select dropdown styled to match FloatingField/FloatingSelect
 * (same floating-label box), for Meta lists long enough that a plain dropdown
 * is unwieldy to scroll (e.g. relationships, cities).
 */
export function FloatingCombobox({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder,
  error,
  emptyText,
  keepOrder,
  required,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Plain labels, or { value, label } when the saved value differs from what is shown (e.g. an id). */
  options: (string | { value: string; label: string })[];
  placeholder?: string;
  error?: boolean;
  emptyText?: string;
  /** Show options in the given order instead of A–Z (for ordered scales). */
  keepOrder?: boolean;
  /** Marks the label with a red asterisk. */
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("common");
  const items = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const shown = keepOrder ? items : sortByLabel(items);
  const selectedLabel = items.find((i) => i.value === value)?.label ?? value;
  const listId = `${id || label.replace(/\s+/g, "-").toLowerCase()}-listbox`;

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen} modal /* own scroll handling, so the list scrolls inside dialogs */>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              "!h-14 w-full flex items-center justify-between gap-2 rounded-lg border bg-transparent px-3.5 text-base font-medium text-start transition-colors",
              error ? "border-destructive" : "border-input"
            )}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? selectedLabel : placeholder ?? t("select")}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent id={listId} className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command filter={(v, search) => (v.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
            <CommandInput placeholder={t("search_in", { what: label.toLowerCase() })} />
            <CommandList>
              <CommandEmpty>{emptyText ?? t("no_matches")}</CommandEmpty>
              <CommandGroup>
                {shown.map((o) => (
                  <CommandItem key={o.value} className="data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground" value={`${o.label} ${o.value}`} onSelect={() => { onValueChange(o.value); setOpen(false); }}>
                    <Check className={cn("h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <label
        className={cn(
          "pointer-events-none absolute -top-2.5 start-3 z-10 whitespace-nowrap bg-card px-1.5 text-sm font-semibold",
          error ? "text-destructive" : "text-primary"
        )}
      >
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
    </div>
  );
}
