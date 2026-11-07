"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Leaf, Pill, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseSynonyms, searchEntries } from "@/lib/complaint-search";
import { UNANI_GROUPS, unaniGroup, type UnaniGroup } from "@/lib/unani-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PickerMedicine { id: string; label: string; kind: string; synonyms?: string; herbType: string | null; generic?: string | null; forms: string[] }
type Tab = UnaniGroup | "allo";
const TABS: readonly Tab[] = [...UNANI_GROUPS, "allo"];
const inTab = (k: Tab, m: PickerMedicine) => (k === "allo" ? m.kind === "medication" : m.kind !== "medication" && unaniGroup(m.herbType) === k);

/**
 * Medicine picker for building a regimen — the same four tabs as the prescription's
 * "Add medicine" (Unani Murakkab · Unani Mufrad · Unani Other · Allopathic), grouped
 * by the same rule. Only medicines from the medicine list (no free text), and it stays
 * open so several medicines can be added in a row.
 */
export function MedicineCategoryPicker({ medicines, added, onPick }: { medicines: PickerMedicine[]; added: string[]; onPick: (m: PickerMedicine) => void }) {
  const td = useTranslations("clinic.dossier");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("murakkab");
  const [q, setQ] = useState("");
  const tabLabel = (k: Tab) => td(k === "other" ? "picker_other_group" : `picker_${k}`);
  // The generic name is searchable too, like a synonym.
  const entries = useMemo(() => medicines.map((m) => ({ ...m, synonyms: JSON.stringify([...parseSynonyms(m.synonyms), ...(m.generic ? [m.generic] : [])]) })), [medicines]);
  const hits = (k: Tab) => {
    const pool = entries.filter((m) => inTab(k, m));
    return q.trim() ? searchEntries(pool, q, 200) : pool.sort((a, b) => a.label.localeCompare(b.label));
  };
  const list = hits(tab);
  const elsewhere = q.trim() && !list.length ? TABS.find((k) => k !== tab && hits(k).length > 0) : undefined;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> {td("add_medicine")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(36rem,calc(100vw-2rem))] p-2" align="end">
        <div className="mb-2 grid grid-cols-4 rounded-lg border border-border/60 bg-background/40 p-0.5" role="tablist">
          {TABS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn("rounded-md px-1 py-1 text-xs font-medium transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tabLabel(k)}{q.trim() && ` · ${hits(k).length}`}
            </button>
          ))}
        </div>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "allo" ? td("search_allo") : td("search_medicines")} className="h-9 mb-1"
          onKeyDown={(e) => { if (e.key === "Enter" && list[0] && !added.includes(list[0].id)) { e.preventDefault(); onPick(list[0]); setQ(""); } }} />
        <div className="max-h-[24rem] overflow-y-auto">
          {list.length > 0 && <p className="sticky top-0 z-[1] bg-popover px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tabLabel(tab)} · {list.length}</p>}
          {list.map((m) => {
            const on = added.includes(m.id);
            return (
              <button key={m.id} type="button" disabled={on} onClick={() => { onPick(m); setQ(""); }}
                className={cn("flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-start", on ? "cursor-default opacity-60" : "hover:bg-muted/60")}>
                {m.kind === "medication" ? <Pill className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" /> : <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug">{m.label}{m.generic && m.generic.toLowerCase() !== m.label.toLowerCase() && <span className="ms-1.5 text-xs text-muted-foreground">{m.generic}</span>}</span>
                  {m.herbType && <span className="block text-[11px] text-muted-foreground">{m.herbType}</span>}
                </span>
                {on && <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />{td("added")}</span>}
              </button>
            );
          })}
          {elsewhere && <button type="button" onClick={() => setTab(elsewhere)} className="w-full text-start rounded-md px-2 py-1.5 text-sm font-medium text-primary hover:bg-muted/60">{td("picker_found", { tab: tabLabel(elsewhere), count: hits(elsewhere).length })}</button>}
          {q.trim() && !list.length && !elsewhere && <p className="px-2 py-2 text-sm text-muted-foreground">No medicine in the medicine list matches “{q.trim()}”.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
