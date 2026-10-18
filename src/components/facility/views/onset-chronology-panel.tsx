"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DURATION_UNITS, longestDuration, onsetDateFor, durationFromDate, toDateInput } from "@/lib/chronology";
import type { ComplaintDuration } from "@/components/facility/views/chief-complaint-matrix";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { FloatingField } from "@/components/shared/floating-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, CheckCircle2, Circle, Hourglass, Loader2, RotateCcw } from "lucide-react";

interface Pattern { id: string; label: string; description: string | null }
interface Saved {
  onsetPatterns: string; durationValue: number | null; durationUnit: string | null; onsetDate: string | null;
  durationSource: string; sourceComplaint: string | null; note: string | null;
}

export interface OnsetChronologyPanelHandle {
  save: () => Promise<void>;
}

const unitLabel = (u: string) => DURATION_UNITS.find((x) => x.value === u)?.label.split(" (")[0].toLowerCase() ?? u;
const fmt = (v: number, u: string) => `${v} ${v === 1 ? unitLabel(u).replace(/s$/, "") : unitLabel(u)}`;

/**
 * Stage 3 — Onset Nature & Rhythm (admin-configured, multi-select) and
 * Chronology & Duration. Duration auto-fills from the longest chief-complaint
 * duration in the matrix above (live, before saving) until the doctor
 * overrides it; the onset date and duration stay in step either way.
 */
export const OnsetChronologyPanel = forwardRef<OnsetChronologyPanelHandle, { visitId: string; complaintDurations: ComplaintDuration[] | null }>(
  function OnsetChronologyPanel({ visitId, complaintDurations }, ref) {
    const [patterns, setPatterns] = useState<Pattern[]>([]);
    const [selected, setSelected] = useState<string[]>([]);
    const [value, setValue] = useState("");
    const [unit, setUnit] = useState("days");
    const [date, setDate] = useState("");
    const [source, setSource] = useState<"auto" | "manual">("auto");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reloadTick, setReloadTick] = useState(0);
    const msg = useNotice();

    useEffect(() => {
      let cancelled = false;
      Promise.all([
        api.get<{ patterns: Pattern[] }>("/api/facility/onset-patterns"),
        api.get<{ chronology: Saved | null }>(`/api/facility/visits/${visitId}/chronology`),
      ])
        .then(([p, c]) => {
          if (cancelled) return;
          setPatterns(p.patterns || []);
          const s = c.chronology;
          if (s) {
            try { setSelected(JSON.parse(s.onsetPatterns || "[]")); } catch { setSelected([]); }
            setNote(s.note || "");
            setSource(s.durationSource === "manual" ? "manual" : "auto");
            if (s.durationSource === "manual") {
              setValue(s.durationValue != null ? String(s.durationValue) : "");
              setUnit(s.durationUnit || "days");
              setDate(s.onsetDate ? s.onsetDate.slice(0, 10) : "");
            }
          }
        })
        .catch((e) => { if (!cancelled) setLoadError(e.message || "Network error"); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [visitId, reloadTick]);

    const longest = useMemo(() => (complaintDurations ? longestDuration(complaintDurations) : null), [complaintDurations]);

    // Auto mode follows the matrix live (longest complaint duration + its
    // onset date); manual mode shows the doctor's own values.
    const shown = source === "auto"
      ? longest
        ? { value: String(longest.value), unit: longest.unit, date: onsetDateFor(longest.value!, longest.unit) }
        : { value: "", unit: "days", date: "" }
      : { value, unit, date };

    useImperativeHandle(ref, () => ({
      save: async function save() {
        // Never save over the visit's real record with blanks that simply failed to load.
        if (loading || loadError) return;
        try {
          await api.post(`/api/facility/visits/${visitId}/chronology`, {
            onsetPatterns: selected, durationValue: shown.value ? Number(shown.value) : null, durationUnit: shown.unit,
            onsetDate: shown.date || null, durationSource: source,
            sourceComplaint: source === "auto" ? longest?.label ?? null : null, note,
          });
          msg.clear();
        } catch (e: any) {
          msg.error("Onset & chronology weren't saved", `${e.message || "Network error"}. Your entries are still shown above.`, { retry: () => { save().catch(() => {}); } });
          throw e;
        }
      },
    }), [visitId, selected, shown.value, shown.unit, shown.date, source, longest, note, loading, loadError, msg]);

    const toggle = (label: string) =>
      setSelected((cur) => (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]));

    const editDuration = (nextValue: string, nextUnit: string) => {
      setSource("manual");
      setValue(nextValue);
      setUnit(nextUnit);
      const n = parseFloat(nextValue);
      setDate(Number.isFinite(n) && n > 0 ? onsetDateFor(n, nextUnit) : "");
    };
    const editDate = (nextDate: string) => {
      setSource("manual");
      setDate(nextDate);
      const d = nextDate ? durationFromDate(nextDate) : null;
      if (d) { setValue(String(d.value)); setUnit(d.unit); }
    };

    // Selected options no longer offered by admin still show, so nothing is lost.
    const orphaned = selected.filter((l) => !patterns.some((p) => p.label === l));
    const cards: Pattern[] = [...patterns, ...orphaned.map((l) => ({ id: `orphan:${l}`, label: l, description: null }))];
    const withDurations = (complaintDurations || []).filter((d) => d.value != null);

    if (loadError) return <LoadFailed what="onset & chronology" detail={loadError} onRetry={() => { setLoading(true); setReloadTick((t) => t + 1); }} />;
    if (loading) {
      return (
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading onset &amp; chronology…
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-5 border-border/50 bg-card/60">
        <SectionHeading icon={Hourglass} title="Onset & Chronology" />

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium mb-1.5">Onset Nature &amp; Rhythm</p>
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No options configured yet — add them in Admin → Meta → Patient.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {cards.map((p) => {
                  const checked = selected.includes(p.label);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.label)}
                      aria-pressed={checked}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                        checked ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/40 hover:border-primary/30"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{p.label}</span>
                        {p.description && <span className="block text-[13px] text-muted-foreground mt-0.5">{p.description}</span>}
                      </span>
                      {checked ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="text-sm font-medium">Chronology &amp; Duration</p>
              {shown.value && (
                <Badge variant="outline" className={cn("text-[11px] font-normal", source === "auto" ? "border-primary/40 text-primary" : "text-muted-foreground")}>
                  {source === "auto" ? "Auto" : "Edited"}
                </Badge>
              )}
            </div>
            <div className="space-y-4 pt-2">
              <div className="relative h-14 rounded-lg border border-input focus-within:border-primary flex items-center transition-colors">
                <input
                  id="chronology-duration"
                  type="number" min={0} inputMode="decimal"
                  value={shown.value}
                  onChange={(e) => editDuration(e.target.value, shown.unit)}
                  placeholder=" "
                  className="peer h-full flex-1 min-w-0 bg-transparent pl-3.5 text-base font-medium outline-none"
                />
                <label
                  htmlFor="chronology-duration"
                  className={cn(
                    "pointer-events-none absolute left-3 bg-card px-1.5 whitespace-nowrap transition-all duration-150 text-muted-foreground",
                    "top-1/2 -translate-y-1/2 text-base font-medium",
                    "peer-focus:top-0 peer-focus:text-sm peer-focus:font-semibold peer-focus:text-primary",
                    "peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:text-sm peer-[&:not(:placeholder-shown)]:font-semibold",
                  )}
                >
                  How long has it lasted?
                </label>
                <div className="h-8 w-px bg-border/70" aria-hidden />
                <Select value={shown.unit} onValueChange={(u) => editDuration(shown.value, u)}>
                  <SelectTrigger className="h-full border-0 shadow-none focus-visible:ring-0 w-40 shrink-0 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATION_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="relative h-14 rounded-lg border border-input focus-within:border-primary flex items-center transition-colors">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 ml-3.5" />
                <input
                  id="chronology-onset-date"
                  type="date" value={shown.date} max={toDateInput(new Date())}
                  onChange={(e) => editDate(e.target.value)}
                  className="peer h-full flex-1 min-w-0 bg-transparent pl-2.5 pr-3.5 text-base font-medium outline-none"
                />
                {/* A date box always shows its dd/mm/yyyy mask, so the label sits on the border. */}
                <label htmlFor="chronology-onset-date" className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-card px-1.5 whitespace-nowrap text-sm font-semibold text-muted-foreground peer-focus:text-primary">
                  When did it start?
                </label>
              </div>
            </div>

            <div className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
              {source === "auto" && longest ? (
                <p>Auto-filled from the longest chief-complaint duration — <span className="font-medium text-foreground/80">{longest.label}</span>.</p>
              ) : source === "manual" && longest ? (
                <p className="flex items-center gap-1.5 flex-wrap">
                  Set manually.
                  <button type="button" onClick={() => setSource("auto")} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <RotateCcw className="h-3 w-3" /> Use chief-complaint duration ({fmt(longest.value!, longest.unit)})
                  </button>
                </p>
              ) : !longest ? (
                <p>Enter a duration for the chief complaints above to fill this in automatically, or set it here.</p>
              ) : null}
              {withDurations.length > 1 && (
                <p className="flex flex-wrap gap-1.5">
                  {withDurations.map((d) => (
                    <span key={d.label} className={cn("rounded-full border px-2 py-0.5", d.label === longest?.label ? "border-primary/40 text-primary" : "border-border/60")}>
                      {d.label}: {fmt(d.value!, d.unit)}
                    </span>
                  ))}
                </p>
              )}
            </div>

            <div className="mt-4">
              <FloatingField
                id="chronology-note"
                label="Chronology note"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                title="e.g. episodic recurrence over the past 6 months"
              />
            </div>
          </div>
        </div>
        <NoticeSlot state={msg} className="mt-4" />
      </Card>
    );
  },
);
