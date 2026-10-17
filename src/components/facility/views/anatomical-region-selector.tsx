"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { regionIcon } from "@/lib/anatomical-region-icons";
import { Card } from "@/components/ui/card";
import { PersonStanding, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Region { id: string; label: string; localTerms: string | null; icon: string }

export interface AnatomicalRegionSelectorHandle {
  save: () => Promise<void>;
}

/**
 * Stage 3 — Anatomical Region & Organ System Selector. Multi-select cards
 * configured in Admin → Meta → Patient. Selection order matters: the first
 * region picked is the primary one (marked with a "Primary" badge).
 * Saved through the page's Save Draft via the ref, like the other panels.
 */
export const AnatomicalRegionSelector = forwardRef<AnatomicalRegionSelectorHandle, { visitId: string }>(
  function AnatomicalRegionSelector({ visitId }, ref) {
    const [regions, setRegions] = useState<Region[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      let cancelled = false;
      Promise.all([
        api.get<{ regions: Region[] }>("/api/facility/anatomical-regions"),
        api.get<{ selection: { regions: string } | null }>(`/api/facility/visits/${visitId}/anatomical-regions`),
      ])
        .then(([r, s]) => {
          if (cancelled) return;
          setRegions(r.regions || []);
          try { setSelected(JSON.parse(s.selection?.regions || "[]")); } catch { setSelected([]); }
        })
        .catch((e) => toast.error(e.message || "Could not load anatomical regions"))
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [visitId]);

    useImperativeHandle(ref, () => ({
      save: async () => {
        try {
          await api.post(`/api/facility/visits/${visitId}/anatomical-regions`, { regions: selected });
        } catch (e: any) {
          toast.error(e.message || "Could not save the anatomical regions");
          throw e;
        }
      },
    }), [visitId, selected]);

    const toggle = (label: string) =>
      setSelected((cur) => (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]));

    // A region selected on this visit but since deactivated/renamed in admin
    // still shows, so the record never silently loses it.
    const orphaned = selected.filter((l) => !regions.some((r) => r.label === l));
    const cards: Region[] = [...regions, ...orphaned.map((l) => ({ id: `orphan:${l}`, label: l, localTerms: null, icon: "activity" }))];

    if (loading) {
      return (
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading anatomical regions…
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
              <PersonStanding className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold">Anatomical Region &amp; Organ System</h2>
              <p className="text-sm text-muted-foreground">Select every region involved — the first one selected is the primary region.</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0">{selected.length} selected</Badge>
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No regions configured yet — add them in Admin → Meta → Patient.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {cards.map((r) => {
              const idx = selected.indexOf(r.label);
              const checked = idx >= 0;
              const Icon = regionIcon(r.icon);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.label)}
                  aria-pressed={checked}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    checked ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/40 hover:border-primary/30"
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={cn("h-4.5 w-4.5 shrink-0", checked ? "text-emerald-500" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{r.label}</span>
                        {idx === 0 && (
                          <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">Primary</Badge>
                        )}
                      </span>
                      {r.localTerms && <span className="block text-xs text-muted-foreground mt-0.5">{r.localTerms}</span>}
                    </span>
                  </span>
                  {checked ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>
    );
  },
);
