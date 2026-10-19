"use client";

import { useRef, useState, type ComponentType, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sortSearchResults } from "@/lib/sort-options";

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
      {Icon && <Icon className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />}
      <input
        id={id}
        placeholder=" "
        className={cn(
          "peer h-14 w-full rounded-lg border bg-transparent pe-3.5 text-base font-medium text-foreground outline-none transition-colors",
          Icon ? "ps-10" : "ps-3.5",
          endAdornment && "pe-11",
          error ? "border-destructive" : "border-input focus:border-primary",
          className
        )}
        {...inputProps}
      />
      <label
        htmlFor={id}
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap bg-card px-1.5 text-base font-medium text-muted-foreground transition-all duration-150",
          Icon ? "start-10" : "start-3.5",
          "peer-focus:top-0 peer-focus:start-3 peer-focus:text-sm peer-focus:font-semibold",
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
      {Icon && <Icon className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" />}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          id={id}
          className={cn(
            "!h-14 w-full rounded-lg border bg-transparent text-base font-medium",
            Icon ? "ps-10" : "ps-3.5",
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
          Icon ? "start-10" : "start-3",
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
          selectPosition === "left" ? "rounded-s-lg border-e border-input" : "rounded-e-lg border-s border-input",
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
        selectPosition === "left" ? "rounded-e-lg" : "rounded-s-lg",
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
          "pointer-events-none absolute -top-2.5 start-3 z-10 whitespace-nowrap bg-card px-1.5 text-sm font-semibold",
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
  "pointer-events-none absolute start-3 z-10 whitespace-nowrap bg-card px-1.5 transition-all duration-150",
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
  onCreate, createLabel, createOptions, tone = "primary", labelIcon: LabelIcon, itemIcon: ItemIcon,
  renderIcon, chipClassName, placeholder, openOnFocus, describe, emptyHint, keepOrder, inlineList,
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
  /** Several ways to add the typed text (e.g. as a herb or as a medication); overrides onCreate. */
  createOptions?: (q: string) => { key: string; label: string; icon?: ReactNode; onCreate: () => void }[];
  tone?: keyof typeof TONES;
  /** Per-item icon for chips and suggestions (e.g. by kind); overrides itemIcon. */
  renderIcon?: (item: T) => ReactNode;
  chipClassName?: (item: T) => string | undefined;
  /** Show suggestions as soon as the box is focused (caller passes them for an empty query). */
  openOnFocus?: boolean;
  /** Secondary line under a suggestion, e.g. its description. */
  describe?: (item: T) => string | null | undefined;
  /** Line at the top of the list while nothing is typed yet. */
  emptyHint?: ReactNode;
  labelIcon?: ComponentType<{ className?: string }>;
  itemIcon?: ComponentType<{ className?: string }>;
  placeholder?: string;
  /** Show results in the given order instead of A–Z (closest matches first). */
  keepOrder?: boolean;
  /** Open the list inside the page flow (pushes content down) — for dialogs, where a floating list gets cut off. */
  inlineList?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = TONES[tone];
  const tc = useTranslations("common");
  createLabel ??= (text: string) => tc("add_quoted", { text });
  placeholder ??= tc("type_to_search_eg");
  const floated = focused || !!query || selected.length > 0;
  const q = query.trim();
  results = keepOrder ? results : sortSearchResults(results, q);
  // Offer the typed text as a new entry unless it's already listed or chosen.
  const exists = results.some((r) => r.label.toLowerCase() === q.toLowerCase())
    || selected.some((s) => s.label.toLowerCase() === q.toLowerCase());
  const creates = !q || exists ? []
    : createOptions ? createOptions(q)
      : onCreate ? [{ key: "create", label: createLabel(q), icon: undefined as ReactNode, onCreate: () => onCreate(q) }] : [];
  const canCreate = creates.length > 0;
  const allowsCreate = !!(createOptions || onCreate);
  const pick = (itemId: string) => { onPick(itemId); onQueryChange(""); inputRef.current?.focus(); };
  const create = (c = creates[0]) => { c?.onCreate(); onQueryChange(""); inputRef.current?.focus(); };
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
          <span key={s.id} className={cn("inline-flex items-center gap-1 rounded-full border ps-2.5 pe-1.5 py-0.5 text-sm", chipClassName?.(s) ?? t.chip)}>
            {renderIcon?.(s)}
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
              if (!q) return;
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

      {(q || (openOnFocus && focused)) && (results.length > 0 || canCreate || (!allowsCreate && !!q)) && (
        <div className={cn("mt-1 rounded-lg border border-border/60 bg-card max-h-56 overflow-y-auto overscroll-contain py-1", inlineList ? "relative" : "absolute start-0 end-0 top-full z-20 shadow-lg")}>
          {!q && emptyHint && <p className="px-3 pt-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{emptyHint}</p>}
          {results.length === 0 && !canCreate ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches for &quot;{query}&quot;.</p>
          ) : results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={(e) => e.preventDefault() /* keep focus in the box */}
              onClick={() => pick(r.id)}
              className={cn("w-full text-start px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-1.5", i === 0 && q && "bg-muted/40")}
            >
              {renderIcon ? renderIcon(r) : <ItemGlyph className={cn("h-3 w-3 shrink-0", tone === "primary" ? "text-muted-foreground" : t.label)} />}
              <span className="min-w-0">
                <span className="block">{r.label}</span>
                {describe?.(r) && <span className="block text-[11px] text-muted-foreground leading-snug">{describe(r)}</span>}
              </span>
              {i === 0 && q && <span className="ms-auto text-[10px] text-muted-foreground shrink-0">{tc("enter_key")}</span>}
            </button>
          ))}
          {creates.map((c, i) => (
            <button
              key={c.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => create(c)}
              className={cn("w-full text-start px-3 py-2 text-sm hover:bg-muted/60 transition-colors flex items-center gap-1.5", i === 0 && "border-t border-border/40", !results.length && i === 0 && "bg-muted/40")}
            >
              {c.icon ?? <Plus className="h-3 w-3 text-muted-foreground shrink-0" />} {c.label}
              {!results.length && i === 0 && <span className="ms-auto text-[10px] text-muted-foreground">{tc("enter_key")}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** A textarea with the same floating label as FloatingField. */
export function FloatingTextarea({ id, label, required, error, className, maxLength = TEXT_LIMIT, ...props }: {
  id: string;
  label: string;
  required?: boolean;
  error?: boolean;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false);
  const floated = focused || !!props.value;
  const length = typeof props.value === "string" ? props.value.length : 0;
  return (
    // The border lives on this wrapper (with top padding) so scrolled text
    // stays below the floating label instead of sliding up behind it.
    <div className={cn(
      "relative rounded-lg border pt-4 pb-1 transition-colors",
      error ? "border-destructive" : focused ? "border-primary" : "border-input",
    )}>
      <textarea
        id={id}
        maxLength={maxLength}
        {...props}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        className={cn(
          "block w-full min-h-20 bg-transparent px-3.5 pt-1 pb-1 text-base font-medium text-foreground outline-none resize-y",
          className,
        )}
      />
      <CharCount length={length} max={maxLength} className="px-3.5" />
      <label htmlFor={id} className={cn(floatLabel(floated, error, focused), !floated && "top-4")}>
        {label}{required && <span className="text-destructive"> *</span>}
      </label>
    </div>
  );
}

/** Default length for free-text boxes on the patient pages. */
export const TEXT_LIMIT = 500;

/** "120 / 500" under a text box — turns amber near the limit and red at it. */
export function CharCount({ length, max, className }: { length: number; max?: number; className?: string }) {
  if (!max) return null;
  return (
    <p className={cn(
      "text-end text-[11px] tabular-nums",
      length >= max ? "text-destructive font-medium" : length >= max * 0.9 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      className,
    )}>
      {length} / {max}
    </p>
  );
}
