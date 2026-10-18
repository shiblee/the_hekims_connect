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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Circle, Footprints, Hourglass, Infinity as InfinityIcon, Loader2, Moon, Repeat, RotateCcw, Snowflake, Sunrise, TrendingUp, Utensils, Waves, Zap } from "lucide-react";

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

const QUICK_DURATIONS = [
  { label: "Today", value: 12, unit: "hours" },
  { label: "2–3 days", value: 3, unit: "days" },
  { label: "1 week", value: 1, unit: "weeks" },
  { label: "2 weeks", value: 2, unit: "weeks" },
  { label: "1 month", value: 1, unit: "months" },
  { label: "3 months", value: 3, unit: "months" },
  { label: "6 months", value: 6, unit: "months" },
  { label: "1 year +", value: 1, unit: "years" },
];

const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

// An icon per onset pattern, matched on the admin-configured label.
function patternIcon(label: string) {
  const l = label.toLowerCase();
  if (/sudden|paroxys|abrupt|acute/.test(l)) return Zap;
  if (/insidious|gradual|slow|creep/.test(l)) return TrendingUp;
  if (/prandial|meal|food|eat/.test(l)) return Utensils;
  if (/nocturn|night|layl/.test(l)) return Moon;
  if (/morning|dawn|waking/.test(l)) return Sunrise;
  if (/season|winter|cold|weather/.test(l)) return Snowflake;
  if (/exert|activity|walk|effort/.test(l)) return Footprints;
  if (/episod|intermit|recur|periodic|cycl/.test(l)) return Repeat;
  if (/constant|continu|persist/.test(l)) return InfinityIcon;
  return Waves;
}

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

    // Selected options no longer offered by admin still show, so nothing is lost.
    const orphaned = selected.filter((l) => !patterns.some((p) => p.label === l));
    const cards: Pattern[] = [...patterns, ...orphaned.map((l) => ({ id: `orphan:${l}`, label: l, description: null }))];
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
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No options configured yet — add them in Admin → Meta → Patient.</p>
            ) : (
              <div className="grid @lg:grid-cols-2 gap-2">
                {cards.map((p) => {
                  const checked = selected.includes(p.label);
                  const Icon = patternIcon(p.label);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.label)}
                      aria-pressed={checked}
                      title={p.description ? `${p.label} — ${p.description}` : p.label}
                      className={cn(
                        "h-14 flex items-center gap-3 rounded-xl border px-3 text-left transition-colors",
                        checked ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/40 hover:border-primary/30"
                      )}
                    >
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", checked ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold leading-snug truncate">{p.label}</span>
                        {p.description && <span className="block text-xs text-muted-foreground truncate">{p.description}</span>}
                      </span>
                      {checked ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" /> : <Circle className="h-4.5 w-4.5 text-muted-foreground/40 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
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
                  Duration
                </label>
                <div className="h-8 w-px bg-border/70" aria-hidden />
                <Select value={shown.unit} onValueChange={(u) => editDuration(shown.value, u)}>
                  <SelectTrigger className="h-full border-0 shadow-none focus-visible:ring-0 w-44 shrink-0 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>{DURATION_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* One-tap common durations */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_DURATIONS.map((q) => {
                const on = shown.value === String(q.value) && shown.unit === q.unit;
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => editDuration(String(q.value), q.unit)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                    )}
                  >
                    {q.label}
                  </button>
                );
              })}
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
                  {COURSES.map((c, i) => <span key={c.key} className={cn(i === 1 && "text-center", i === 2 && "text-right", c.key === course.key && "font-semibold text-foreground")}>{c.range}</span>)}
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
                <p>Fills in automatically from the chief complaints&apos; durations, or pick one above.</p>
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
