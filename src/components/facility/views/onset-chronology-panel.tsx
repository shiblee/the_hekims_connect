"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { COURSES, courseFor, DURATION_UNITS, longestDuration, onsetDateFor } from "@/lib/chronology";
import type { ComplaintDuration } from "@/components/facility/views/chief-complaint-matrix";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { FloatingMultiSelect } from "@/components/shared/floating-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hourglass, Loader2, RotateCcw } from "lucide-react";
import { patternIcon } from "@/lib/onset-icons";

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

const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });


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
    const [patternQuery, setPatternQuery] = useState("");
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

    // Search the admin list by name or description; with nothing typed, offer the first few.
    const pq = patternQuery.trim().toLowerCase();
    const patternSuggestions = patterns
      .filter((p) => !selected.includes(p.label) && (!pq || p.label.toLowerCase().includes(pq) || (p.description || "").toLowerCase().includes(pq)))
      .slice(0, pq ? 12 : 6)
      .map((p) => ({ id: p.label, label: p.label, description: p.description }));
    const addOtherPattern = (text: string) => {
      const match = patterns.find((p) => p.label.toLowerCase() === text.toLowerCase());
      const label = match ? match.label : text;
      setSelected((cur) => (cur.some((x) => x.toLowerCase() === label.toLowerCase()) ? cur : [...cur, label]));
    };
    const withDurations = (complaintDurations || []).filter((d) => d.value != null);
    const course = courseFor(shown.value, shown.unit);

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="@container min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium">How did it start, and when is it worse?</p>
              {selected.length > 0 && <Badge variant="outline" className="text-[11px] font-normal shrink-0">{selected.length} selected</Badge>}
            </div>
            <div className="pt-1.5">
              <FloatingMultiSelect
                id="onsetPatternSearch"
                label="Search onset & rhythm"
                placeholder="Type — e.g. sudden, gradual, night, after meals…"
                openOnFocus
                emptyHint={patterns.length > 6 ? `Common patterns · type to search all ${patterns.length}` : "Onset & rhythm patterns"}
                selected={selected.map((label) => {
                  const pt = patterns.find((x) => x.label === label);
                  return { id: label, label, description: pt ? pt.description : "Added by doctor" };
                })}
                onRemove={(label) => setSelected((cur) => cur.filter((x) => x !== label))}
                query={patternQuery}
                onQueryChange={setPatternQuery}
                results={patternSuggestions}
                describe={(pt) => pt.description}
                renderIcon={(pt) => { const Icon = patternIcon(pt.label); return <Icon className="h-3.5 w-3.5 shrink-0" />; }}
                onPick={(label) => toggle(label)}
                onCreate={addOtherPattern}
                createLabel={(q) => `Add "${q}" as another pattern`}
              />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-medium">How long has it been going on?</p>
              {shown.value && (
                <Badge variant="outline" className={cn("text-[11px] font-normal shrink-0", source === "auto" ? "border-primary/40 text-primary" : "text-muted-foreground")}>
                  {source === "auto" ? "From chief complaints" : "Set by you"}
                </Badge>
              )}
            </div>
            <div className="pt-1.5">
              <div className="relative h-14 rounded-lg border border-input focus-within:border-primary flex items-center transition-colors">
                <input
                  id="chronology-duration"
                  type="number" min={0} inputMode="decimal"
                  value={shown.value}
                  onChange={(e) => editDuration(e.target.value, shown.unit)}
                  placeholder=" "
                  className="peer h-full flex-1 min-w-0 bg-transparent ps-3.5 text-base font-medium outline-none"
                />
                <label
                  htmlFor="chronology-duration"
                  className={cn(
                    "pointer-events-none absolute start-3 bg-card px-1.5 whitespace-nowrap transition-all duration-150 text-muted-foreground",
                    "top-1/2 -translate-y-1/2 text-base font-medium",
                    "peer-focus:top-0 peer-focus:text-sm peer-focus:font-semibold peer-focus:text-primary",
                    "peer-[&:not(:placeholder-shown)]:top-0 peer-[&:not(:placeholder-shown)]:text-sm peer-[&:not(:placeholder-shown)]:font-semibold",
                  )}
                >
                  Duration
                </label>
                <div className="h-8 w-px bg-border/70" aria-hidden />
                <Select value={shown.unit} onValueChange={(u) => editDuration(shown.value, u)}>
                  <SelectTrigger className="h-full border-0 shadow-none focus-visible:ring-0 w-44 shrink-0 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATION_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* What the duration means: course type + approximate start */}
            {course && (
              <div className={cn("mt-3 rounded-xl border px-3.5 py-3", course.style.border, course.style.bg)}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className={cn("text-sm font-semibold", course.style.text)}>{course.label} <span className="font-normal opacity-80">({course.unani})</span></span>
                  {shown.date && <span className="text-xs text-muted-foreground">Started around <span className="font-medium text-foreground">{longDate(shown.date)}</span></span>}
                </div>
                <div className="mt-2.5 relative">
                  <div className="flex h-1.5 overflow-hidden rounded-full">
                    {COURSES.map((c) => <div key={c.key} className={cn("flex-1", c.style.bar, c.key === course.key ? "opacity-100" : "opacity-30")} />)}
                  </div>
                  <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow" style={{ left: `${course.pos}%`, background: course.style.dot }} aria-hidden />
                </div>
                <div className="mt-1.5 grid grid-cols-3 text-[11px] text-muted-foreground">
                  {COURSES.map((c, i) => <span key={c.key} className={cn(i === 1 && "text-center", i === 2 && "text-end", c.key === course.key && "font-semibold text-foreground")}>{c.range}</span>)}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{course.hint}</p>
              </div>
            )}

            <div className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
              {source === "auto" && longest ? (
                <p>Taken from the longest chief complaint — <span className="font-medium text-foreground/80">{longest.label}</span>.</p>
              ) : source === "manual" && longest ? (
                <p className="flex items-center gap-1.5 flex-wrap">
                  <button type="button" onClick={() => setSource("auto")} className="inline-flex items-center gap-1 text-primary hover:underline">
                    <RotateCcw className="h-3 w-3" /> Use chief-complaint duration ({fmt(longest.value!, longest.unit)})
                  </button>
                </p>
              ) : !longest && !shown.value ? (
                <p>Fills in automatically from the chief complaints&apos; durations, or enter one above.</p>
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
          </div>
        </div>
        <NoticeSlot state={msg} className="mt-4" />
      </Card>
    );
  },
);
