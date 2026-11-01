"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FindingOption { id: string; label: string; description: string | null }
export interface FindingRow extends FindingOption { custom?: boolean }

/**
 * "Add …" button for a section heading: a searchable list of the admin's items, plus
 * "Add <typed text>" for one that isn't listed. Same pattern as Main Complaints.
 */
export function FindingAddButton({ label, options, onPick, onCreate, createLabel, searchPh, tone = "primary" }: {
  label: string; options: FindingOption[]; onPick: (id: string) => void; onCreate: (text: string) => void;
  createLabel: (q: string) => string; searchPh: string; tone?: "primary" | "destructive";
}) {
  const tf = useTranslations("common.findings");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const shown = options.filter((o) => !ql || o.label.toLowerCase().includes(ql) || (o.description || "").toLowerCase().includes(ql));
  const exact = options.some((o) => o.label.toLowerCase() === ql);
  const pick = (id: string) => { onPick(id); setQ(""); setOpen(false); };
  const create = () => { onCreate(q.trim()); setQ(""); setOpen(false); };
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm",
          tone === "destructive" ? "bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90")}>
          <Plus className="h-4 w-4" /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-1.5">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPh} className="mb-1.5 h-9 text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (shown[0]) pick(shown[0].id); else if (q.trim()) create(); } }} />
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {shown.slice(0, 80).map((o, i) => (
            <button key={o.id} type="button" onClick={() => pick(o.id)} className={cn("rounded-md px-2.5 py-1.5 text-start transition-colors hover:bg-muted/60", i === 0 && ql && "bg-muted/40")}>
              <span className="block text-sm">{o.label}</span>
              {o.description && <span className="block truncate text-xs text-muted-foreground">{o.description}</span>}
            </button>
          ))}
          {q.trim() && !exact && (
            <button type="button" onClick={create} className="rounded-md px-2.5 py-1.5 text-start text-sm text-primary transition-colors hover:bg-muted/60">
              <Plus className="me-1 inline h-3.5 w-3.5" />{createLabel(q.trim())}
            </button>
          )}
          {!shown.length && !q.trim() && <p className="px-2.5 py-1.5 text-sm text-muted-foreground">{tf("all_added")}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The chosen items as a table: # · name · what it means · source · remove. */
export function FindingTable({ rows, nameHeading, onRemove, empty, tone = "primary", icon: Icon }: {
  rows: FindingRow[]; nameHeading: string; onRemove?: (id: string) => void; empty: string;
  tone?: "primary" | "destructive"; icon?: typeof Plus;
}) {
  const tf = useTranslations("common.findings");
  const COLS = cn("md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.6fr)_8rem]", onRemove && "md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.6fr)_8rem_2rem]");
  if (!rows.length) return <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className={cn("overflow-hidden rounded-xl border", tone === "destructive" ? "border-destructive/30" : "border-border")}>
      <div className={cn("hidden gap-3 border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid", COLS,
        tone === "destructive" ? "border-destructive/20 bg-destructive/5" : "border-border bg-muted/40")}>
        <span className="text-end">#</span><span>{nameHeading}</span><span>{tf("col_meaning")}</span><span>{tf("col_source")}</span>{onRemove && <span />}
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => (
          <li key={r.id} className={cn("grid items-center gap-x-3 gap-y-0.5 px-3 py-2", COLS)}>
            <span className="hidden text-end text-xs tabular-nums text-muted-foreground md:block">{i + 1}</span>
            <p className={cn("flex items-center gap-1.5 text-sm font-semibold", tone === "destructive" && "text-destructive")}>
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}{r.label}
            </p>
            <p className="text-xs text-muted-foreground">{r.description || "—"}</p>
            <span className={cn("w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium", r.custom ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-border bg-muted/40 text-muted-foreground")}>
              {r.custom ? tf("src_staff") : tf("src_list")}
            </span>
            {onRemove && (
              <button type="button" onClick={() => onRemove(r.id)} aria-label={tf("remove", { label: r.label })} title={tf("remove", { label: r.label })}
                className="justify-self-end rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
