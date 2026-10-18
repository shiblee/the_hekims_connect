"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { regionIcon, regionAppliesTo } from "@/lib/anatomical-region-icons";
import { BODY_ZONES, type BodyView } from "@/lib/body-zones";
import { BodyMap } from "@/components/facility/views/body-map";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { PersonStanding, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Region { id: string; label: string; localTerms: string | null; icon: string; gender: string; bodyZone: string | null }

export interface AnatomicalRegionSelectorHandle {
  save: () => Promise<void>;
}

/**
 * Stage 3 — Anatomical Region & Organ System Selector. Multi-select cards
 * configured in Admin → Meta → Patient. Selection order matters: the first
 * region picked is the primary one (marked with a "Primary" badge).
 * Saved through the page's Save Draft via the ref, like the other panels.
 */
export const AnatomicalRegionSelector = forwardRef<AnatomicalRegionSelectorHandle, { visitId: string; patientGender?: string | null }>(
  function AnatomicalRegionSelector({ visitId, patientGender }, ref) {
    const [regions, setRegions] = useState<Region[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<BodyView>("front");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadTick, setReloadTick] = useState(0);
    const msg = useNotice();

    useEffect(() => {
      let cancelled = false;
      Promise.all([
        api.get<{ regions: Region[] }>("/api/facility/anatomical-regions"),
        api.get<{ selection: { regions: string } | null }>(`/api/facility/visits/${visitId}/anatomical-regions`),
      ])
        .then(([r, s]) => {
          if (cancelled) return;
          setLoadError(null);
          setRegions(r.regions || []);
          try { setSelected(JSON.parse(s.selection?.regions || "[]")); } catch { setSelected([]); }
        })
        .catch((e) => { if (!cancelled) setLoadError(e.message || "Network error"); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [visitId, reloadTick]);

    useImperativeHandle(ref, () => ({
      save: async function save() {
        // Never save over the visit's real selection with an empty one that simply failed to load.
        if (loading || loadError) return;
        try {
          await api.post(`/api/facility/visits/${visitId}/anatomical-regions`, { regions: selected });
          msg.clear();
        } catch (e: any) {
          msg.error("The anatomical regions weren't saved", `${e.message || "Network error"}. Your selection is still shown above.`, { retry: () => { save().catch(() => {}); } });
          throw e;
        }
      },
    }), [visitId, selected, loading, loadError, msg]);

    const toggle = (label: string) => {
      const adding = !selected.includes(label);
      setSelected((cur) => (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]));
      // Selecting a region that's only drawn on the other side (e.g. Spine on
      // the back) flips the body map so the highlight is actually visible.
      const zone = regions.find((r) => r.label === label)?.bodyZone;
      const z = zone ? BODY_ZONES[zone] : null;
      if (adding && z && !z[view]) setView(view === "front" ? "back" : "front");
    };

    // A region selected on this visit but since deactivated/renamed in admin
    // still shows, so the record never silently loses it.
    const orphaned = selected.filter((l) => !regions.some((r) => r.label === l));
    // Regions that don't apply to this patient's recorded gender are hidden —
    // unless already selected on this visit, so a saved choice never vanishes.
    const visible = regions.filter((r) => regionAppliesTo(r.gender, patientGender) || selected.includes(r.label));
    const hiddenCount = regions.length - visible.length;
    const cards: Region[] = [...visible, ...orphaned.map((l) => ({ id: `orphan:${l}`, label: l, localTerms: null, icon: "activity", gender: "all", bodyZone: null }))];

    if (loadError) return <LoadFailed what="the anatomical regions" detail={loadError} onRetry={() => { setLoading(true); setReloadTick((t) => t + 1); }} />;
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
        <SectionHeading
          icon={PersonStanding}
          title="Anatomical Region & Organ System"
          right={<Badge variant="outline" className="shrink-0">{selected.length} selected</Badge>}
        />

        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No regions configured yet — add them in Admin → Meta → Patient.</p>
        ) : (
          <div className="grid lg:grid-cols-[190px_1fr] gap-5 items-start">
          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
            <BodyMap
              view={view}
              onViewChange={setView}
              onToggle={toggle}
              items={cards.map((r) => ({
                label: r.label, localTerms: r.localTerms, icon: r.icon, zone: r.bodyZone,
                selected: selected.includes(r.label), primary: selected[0] === r.label,
              }))}
            />
          </div>
          <div className="space-y-2 min-w-0">
          {/* Five rows visible (about the body map's height), the rest scrolls
              inside the card: every card is the same height (80px), so
              5 rows + 4 gaps of 8px = 432px (+ padding so borders aren't clipped). */}
          <div className="grid sm:grid-cols-2 gap-2 max-h-[436px] overflow-y-auto p-0.5 pr-1.5 -m-0.5">
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
                  title={r.localTerms ? `${r.label} — ${r.localTerms}` : r.label}
                  className={cn(
                    "h-20 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors",
                    checked ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/40 hover:border-primary/30"
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={cn("h-4.5 w-4.5 shrink-0", checked ? "text-emerald-500" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      <span className="text-sm font-semibold line-clamp-2">{r.label}</span>
                      {r.localTerms && <span className="block text-[13px] text-muted-foreground mt-0.5 truncate">{r.localTerms}</span>}
                    </span>
                  </span>
                  <span className="flex flex-col items-center gap-0.5 shrink-0">
                    {checked ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5 text-muted-foreground/40" />}
                    {idx === 0 && <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Primary</span>}
                  </span>
                </button>
              );
            })}
          </div>
          {cards.length > 10 && (
            <p className="text-[13px] text-muted-foreground">Scroll the list to see all {cards.length} regions.</p>
          )}
          </div>
          </div>
        )}
        <NoticeSlot state={msg} className="mt-4" />
      </Card>
    );
  },
);
