"use client";

import { useRef, useState, type ComponentType, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-destructive">
      <AlertCircle className="h-4 w-4 shrink-0" /> {message}
    </p>
  );
}

/**
 * A text field whose label sits inside the box by default and floats up
 * onto the border on focus or once it has a value (the same field format
 * used across the site — admin login, Facility/Patient auth screens, etc).
 */
export function FloatingField({
  id,
  label,
  icon: Icon,
  error,
  required,
  endAdornment,
  className,
  ...inputProps
}: {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  error?: boolean;
  required?: boolean;
  endAdornment?: ReactNode;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />}
      <input
        id={id}
        placeholder=" "
        className={cn(
          "peer h-14 w-full rounded-lg border bg-transparent pr-3.5 text-base font-medium text-foreground outline-none transition-colors",
          Icon ? "pl-10" : "pl-3.5",
          endAdornment && "pr-11",
          error ? "border-destructive" : "border-input focus:border-primary",
          className
        )}
        {...inputProps}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap bg-card px-1.5 text-base font-medium text-muted-foreground transition-all duration-150",
          Icon ? "left-10" : "left-3.5",
          "peer-focus:top-0 peer-focus:left-3 peer-focus:text-sm peer-focus:font-semibold",
          "peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:left-3 peer-[&:not(:placeholder-shown)]:text-sm peer-[&:not(:placeholder-shown)]:font-semibold",
          error ? "text-destructive" : "peer-focus:text-primary"
        )}
      >
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
      {endAdornment}
    </div>
  );
}

/**
 * A Select dropdown styled to match FloatingField (icon-prefixed box, label
 * floated onto the border) so dropdowns and text fields read as one system.
 */
export function FloatingSelect({
  id,
  label,
  icon: Icon,
  error,
  required,
  value,
  onValueChange,
  placeholder,
  children,
}: {
  id?: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  error?: boolean;
  required?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className={cn(
            "!h-14 w-full rounded-lg border bg-transparent text-base font-medium",
            Icon ? "pl-10" : "pl-3.5",
            error ? "border-destructive" : "border-input"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      <label
        className={cn(
          "pointer-events-none absolute -top-2.5 z-10 whitespace-nowrap bg-card px-1.5 text-sm font-semibold",
          Icon ? "left-10" : "left-3",
          error ? "text-destructive" : "text-primary"
        )}
      >
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
    </div>
  );
}

/**
 * A short Select fused to the left edge of a text input inside one shared
 * border, for pairs that are really one piece of information split across
 * two controls (e.g. a title prefix + a name) — filling them reads as a
 * single field rather than two separate ones.
 */
export function FloatingSplitField({
  label,
  selectPosition = "left",
  selectValue,
  onSelectChange,
  selectOptions,
  selectPlaceholder = "—",
  selectWidthClassName = "w-24",
  inputId,
  error,
  required,
  className,
  ...inputProps
}: {
  label: string;
  selectPosition?: "left" | "right";
  selectValue: string;
  onSelectChange: (value: string) => void;
  selectOptions: string[];
  selectPlaceholder?: string;
  selectWidthClassName?: string;
  inputId: string;
  error?: boolean;
  required?: boolean;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const select = (
    <Select value={selectValue} onValueChange={onSelectChange}>
      <SelectTrigger
        className={cn(
          "!h-full shrink-0 rounded-none border-0 bg-transparent px-3 text-base font-medium shadow-none focus-visible:ring-0",
          selectPosition === "left" ? "rounded-l-lg border-r border-input" : "rounded-r-lg border-l border-input",
          selectWidthClassName
        )}
      >
        <SelectValue placeholder={selectPlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {selectOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
  const input = (
    <input
      id={inputId}
      placeholder=" "
      className={cn(
        "h-full min-w-0 flex-1 bg-transparent px-3.5 text-base font-medium text-foreground outline-none",
        selectPosition === "left" ? "rounded-r-lg" : "rounded-l-lg",
        className
      )}
      {...inputProps}
    />
  );

  return (
    <div className="relative">
      <div
        className={cn(
          "flex h-14 w-full items-stretch rounded-lg border bg-transparent transition-colors has-[input:focus]:border-primary",
          error ? "border-destructive" : "border-input"
        )}
      >
        {selectPosition === "left" ? <>{select}{input}</> : <>{input}{select}</>}
      </div>
      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute -top-2.5 left-3 z-10 whitespace-nowrap bg-card px-1.5 text-sm font-semibold",
          error ? "text-destructive" : "text-primary"
        )}
      >
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
    </div>
  );
}

// Shared label look for the floating fields below — inside the box at rest,
// up on the border (smaller, primary) once focused or filled.
const floatLabel = (floated: boolean, error?: boolean, focused?: boolean) => cn(
  "pointer-events-none absolute left-3 z-10 whitespace-nowrap bg-card px-1.5 transition-all duration-150",
  floated ? "top-0 -translate-y-1/2 text-sm font-semibold" : "text-base font-medium",
  error ? "text-destructive" : floated && focused ? "text-primary" : "text-muted-foreground",
);

const TONES = {
  primary: { chip: "bg-primary/15 border-primary/40 text-primary", chipBtn: "hover:bg-primary/15", focus: "border-primary", rest: "border-input", label: "text-primary", restLabel: "text-muted-foreground" },
  destructive: { chip: "bg-destructive/10 border-destructive/30 text-destructive", chipBtn: "hover:bg-destructive/15", focus: "border-destructive", rest: "border-destructive/30", label: "text-destructive", restLabel: "text-destructive/80" },
};

/**
 * Multi-select with the same floating label as FloatingField: chosen items
 * sit as chips inside the box, and typing filters the options shown in a
 * list right under it. Enter adds the top match (or, with `onCreate`, what
 * was typed when nothing matches); Backspace on an empty box removes the
 * last chip.
 */
export function FloatingMultiSelect<T extends { id: string; label: string }>({
  id, label, required, error, selected, onRemove, query, onQueryChange, results, onPick,
  onCreate, createLabel = (q) => `Add "${q}"`, tone = "primary", labelIcon: LabelIcon, itemIcon: ItemIcon, placeholder = "Type a symptom to search…",
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: boolean;
  selected: T[];
  onRemove: (id: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: T[];
  onPick: (id: string) => void;
  /** Lets the user add free text that isn't in the list. */
  onCreate?: (text: string) => void;
  createLabel?: (q: string) => string;
  tone?: keyof typeof TONES;
  labelIcon?: ComponentType<{ className?: string }>;
  itemIcon?: ComponentType<{ className?: string }>;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = TONES[tone];
  const floated = focused || !!query || selected.length > 0;
  const q = query.trim();
  // Offer the typed text as a new entry unless it's already listed or chosen.
  const canCreate = !!onCreate && !!q
    && !results.some((r) => r.label.toLowerCase() === q.toLowerCase())
    && !selected.some((s) => s.label.toLowerCase() === q.toLowerCase());
  const pick = (itemId: string) => { onPick(itemId); onQueryChange(""); inputRef.current?.focus(); };
  const create = () => { onCreate?.(q); onQueryChange(""); inputRef.current?.focus(); };
  const ItemGlyph = ItemIcon ?? Plus;

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "min-h-14 w-full rounded-lg border bg-transparent px-3 py-2.5 flex flex-wrap items-center gap-1.5 cursor-text transition-colors",
          error ? "border-destructive" : focused ? t.focus : t.rest,
        )}
      >
        {selected.map((s) => (
          <span key={s.id} className={cn("inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1.5 py-0.5 text-sm", t.chip)}>
            {s.label}
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(s.id); }} aria-label={`Remove ${s.label}`} className={cn("rounded-full p-0.5", t.chipBtn)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) pick(results[0].id);
              else if (canCreate) create();
            }
            if (e.key === "Backspace" && !query && selected.length) onRemove(selected[selected.length - 1].id);
            if (e.key === "Escape") onQueryChange("");
          }}
          placeholder={floated && !selected.length ? placeholder : ""}
          autoComplete="off"
          className="flex-1 min-w-24 bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground/60 placeholder:font-normal"
        />
      </div>
      <label
        htmlFor={id}
        className={cn(
          floatLabel(floated, error, focused), !floated && "top-1/2 -translate-y-1/2",
          tone !== "primary" && !error && (floated && focused ? t.label : t.restLabel),
          LabelIcon && "inline-flex items-center gap-1.5",
        )}
      >
        {LabelIcon && <LabelIcon className="h-3.5 w-3.5" />}
        {label}{required && <span className="text-destructive"> *</span>}
      </label>

      {q && (results.length > 0 || canCreate || !onCreate) && (
        <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border border-border/60 bg-card shadow-lg max-h-56 overflow-y-auto py-1">
          {results.length === 0 && !canCreate ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches for &quot;{query}&quot;.</p>
          ) : results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault() /* keep focus in the box */}
              onClick={() => pick(r.id)}
              className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-1.5", i === 0 && "bg-muted/40")}
            >
              <ItemGlyph className={cn("h-3 w-3 shrink-0", tone === "primary" ? "text-muted-foreground" : t.label)} /> {r.label}
              {i === 0 && <span className="ml-auto text-[10px] text-muted-foreground">Enter</span>}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={create}
              className={cn("w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-1.5 border-t border-border/40", !results.length && "bg-muted/40")}
            >
              <Plus className="h-3 w-3 text-muted-foreground shrink-0" /> {createLabel(q)}
              {!results.length && <span className="ml-auto text-[10px] text-muted-foreground">Enter</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A textarea with the same floating label as FloatingField. */
export function FloatingTextarea({ id, label, required, error, className, ...props }: {
  id: string;
  label: string;
  required?: boolean;
  error?: boolean;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false);
  const floated = focused || !!props.value;
  return (
    <div className="relative">
      <textarea
        id={id}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        className={cn(
          "w-full min-h-24 rounded-lg border bg-transparent px-3.5 pt-4 pb-2 text-base font-medium text-foreground outline-none transition-colors resize-y",
          error ? "border-destructive" : "border-input focus:border-primary",
          className,
        )}
      />
      <label htmlFor={id} className={cn(floatLabel(floated, error, focused), !floated && "top-4")}>
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
    </div>
  );
}
