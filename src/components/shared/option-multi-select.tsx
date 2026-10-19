"use client";

import { useState, type ComponentType } from "react";
import { FloatingMultiSelect } from "@/components/shared/floating-field";

/**
 * Search-and-pick for a plain list of options (e.g. a Meta section): click or type to
 * see the options, chosen ones show as chips. Same field as allergies / services.
 */
export function OptionMultiSelect({ id, label, options, value, onChange, icon, placeholder = "Type to search…" }: {
  id: string;
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  icon?: ComponentType<{ className?: string }>;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = options.filter((o) => !value.includes(o) && (!q || o.toLowerCase().includes(q))).map((o) => ({ id: o, label: o }));
  return (
    <FloatingMultiSelect
      id={id}
      label={value.length ? `${label} · ${value.length} selected` : label}
      labelIcon={icon}
      selected={value.map((v) => ({ id: v, label: v }))}
      onRemove={(v) => onChange(value.filter((x) => x !== v))}
      query={query}
      onQueryChange={setQuery}
      results={results}
      onPick={(v) => { onChange([...value, v]); setQuery(""); }}
      openOnFocus
      inlineList
      emptyHint={results.length ? `${results.length} option${results.length === 1 ? "" : "s"} — type to narrow` : "All options chosen"}
      placeholder={placeholder}
    />
  );
}
