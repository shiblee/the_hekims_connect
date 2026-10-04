"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  placeholder = "Select",
  error,
  emptyText = "No matches.",
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  error?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = `${id || label.replace(/\s+/g, "-").toLowerCase()}-listbox`;

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className={cn(
              "!h-14 w-full flex items-center justify-between gap-2 rounded-lg border bg-transparent px-3.5 text-base font-medium text-left transition-colors",
              error ? "border-destructive" : "border-input"
            )}
          >
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent id={listId} className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o} value={o} onSelect={() => { onValueChange(o); setOpen(false); }}>
                    <Check className={cn("h-4 w-4", value === o ? "opacity-100" : "opacity-0")} />
                    {o}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <label
        className={cn(
          "pointer-events-none absolute -top-2.5 left-3 z-10 whitespace-nowrap bg-card px-1.5 text-sm font-semibold",
          error ? "text-destructive" : "text-primary"
        )}
      >
        {label}
      </label>
    </div>
  );
}
