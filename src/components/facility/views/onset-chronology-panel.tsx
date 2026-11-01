"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { COURSES, courseFor, DURATION_UNITS, longestDuration, onsetDateFor } from "@/lib/chronology";
import type { ComplaintDuration } from "@/components/facility/views/chief-complaint-matrix";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import { Badge } from "@/components/ui/badge";
import { FindingAddButton, FindingTable } from "@/components/facility/views/finding-table";
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
    const t3 = useTranslations("clinic.stage3");
    const tc = useTranslations("common");
    const dl = useDateLocale();
    const fmt = (v: number, u: string) => (DURATION_UNITS.some((x) => x.value === u) ? t3(`n_${u}`, { count: v }) : `${v} ${u}`);
    const longDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(dl, { day: "numeric", month: "short", year: "numeric" });

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
        .catch((e) => { if (!cancelled) setLoadError(e.message || tc("network_error")); })
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
          msg.error(t3("chrono_not_saved"), t3("entries_shown", { error: e.message || tc("network_error") }), { retry: () => { save().catch(() => {}); } });
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

    const addOtherPattern = (text: string) => {
      const match = patterns.find((p) => p.label.toLowerCase() === text.toLowerCase());
      const label = match ? match.label : text;
      setSelected((cur) => (cur.some((x) => x.toLowerCase() === label.toLowerCase()) ? cur : [...cur, label]));
    };
    const withDurations = (complaintDurations || []).filter((d) => d.value != null);
    const course = courseFor(shown.value, shown.unit);

    if (loadError) return <LoadFailed what={t3("the_chrono")} detail={loadError} onRetry={() => { setLoading(true); setReloadTick((n) => n + 1); }} />;
    if (loading) {
      return (
        <Card className="p-5 border-border/50 bg-card/60">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> {t3("chrono_loading")}
          </div>
        </Card>
      );
    }

    const tableRows = selected.map((label) => {
      const pt = patterns.find((x) => x.label === label);
      return { id: label, label, description: pt?.description ?? null, custom: !pt };
    });

    return (
      <Card className="p-5 border-border/50 bg-card/60">
        <SectionHeading icon={Hourglass} title={t3("chrono_title")} />

        {/* How it started — Add button + table, same pattern as Main Complaints */}
        <div className="mt-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              {t3("how_start")}
              {selected.length > 0 && <Badge variant="outline" className="text-[11px] font-normal">{t3("n_selected", { count: selected.length })}</Badge>}
            </p>
            <FindingAddButton
              label={t3("add_pattern_btn")}
              options={patterns.filter((p) => !selected.includes(p.label)).map((p) => ({ id: p.label, label: p.label, description: p.description }))}
              onPick={toggle}
              onCreate={addOtherPattern}
              createLabel={(q) => t3("add_pattern", { q })}
              searchPh={t3("pattern_ph")}
            />
          </div>
          <FindingTable rows={tableRows} nameHeading={t3("col_pattern")} empty={t3("no_patterns")}
            iconFor={(r) => patternIcon(r.label)}
            onRemove={(label) => setSelected((cur) => cur.filter((x) => x !== label))} />
        </div>

        {/* How long — duration on the left, what it means (course of illness) on the right */}
        <div className="mt-5 border-t border-border pt-5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{t3("how_long")}</p>
            {shown.value && (
              <Badge variant="outline" className={cn("text-[11px] font-normal", source === "auto" ? "border-primary/40 text-primary" : "text-muted-foreground")}>
                {source === "auto" ? t3("from_complaints") : t3("set_by_you")}
              </Badge>
            )}
          </div>

          {/* One line: duration · course of illness · where it sits on the scale · approximate start */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <div className="flex h-12 w-full shrink-0 items-stretch overflow-hidden rounded-lg border border-input bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15 lg:w-72">
              <input
                id="chronology-duration"
                aria-label={t3("duration")}
                type="number" min={0} inputMode="decimal"
                value={shown.value}
                onChange={(e) => editDuration(e.target.value, shown.unit)}
                placeholder="0"
                className="w-20 min-w-0 bg-transparent px-3 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
              />
              <div className="w-px bg-border" aria-hidden />
              <Select value={shown.unit} onValueChange={(u) => editDuration(shown.value, u)}>
                <SelectTrigger className="h-full! flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>{DURATION_UNITS.map((u) => <SelectItem key={u.value} value={u.value}>{t3(`du_${u.value}`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {course ? (
              <div title={t3(`course_${course.key}_hint`)} className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border px-4 py-2", course.style.border, course.style.bg)}>
                <p className={cn("shrink-0 font-serif text-lg font-semibold leading-none", course.style.text)}>
                  {t3(`course_${course.key}`)} <span className="text-sm font-normal opacity-80">· {course.unani}</span>
                </p>
                <div className="min-w-[12rem] flex-1">
                  <div className="relative">
                    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                      {COURSES.map((c) => <div key={c.key} className={cn("flex-1", c.style.bar, c.key === course.key ? "opacity-100" : "opacity-25")} />)}
                    </div>
                    <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow" style={{ left: `${course.pos}%`, background: course.style.dot }} aria-hidden />
                  </div>
                  <div className="mt-1 grid grid-cols-3 text-[10px] leading-none text-muted-foreground">
                    {COURSES.map((c, i) => (
                      <span key={c.key} className={cn("truncate", i === 1 && "text-center", i === 2 && "text-end", c.key === course.key && "font-semibold text-foreground")}>
                        {t3(`course_${c.key}`)} · {t3(`course_${c.key}_range`)}
                      </span>
                    ))}
                  </div>
                </div>
                {shown.date && (
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {t3("approx_start")} <span className="ms-1 text-sm font-semibold text-foreground">{longDate(shown.date)}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-lg border border-dashed border-border px-4 py-2 text-center text-sm text-muted-foreground">
                {t3("course_empty")}
              </div>
            )}
          </div>

          {/* Where the duration came from, and each complaint's own duration */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
            {source === "auto" && longest ? (
              <p>{t3.rich("from_longest", { label: longest.label, b: (c) => <span className="font-medium text-foreground/80">{c}</span> })}</p>
            ) : source === "manual" && longest ? (
              <button type="button" onClick={() => setSource("auto")} className="inline-flex items-center gap-1 text-primary hover:underline">
                <RotateCcw className="h-3 w-3" /> {t3("use_complaint", { value: fmt(longest.value!, longest.unit) })}
              </button>
            ) : !longest && !shown.value ? (
              <p>{t3("fills_auto")}</p>
            ) : null}
            {withDurations.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide">{t3("per_complaint")}:</span>
                {withDurations.map((d) => {
                  const isLongest = d.label === longest?.label;
                  const active = shown.value === String(d.value) && shown.unit === d.unit;
                  return (
                    <button key={d.label} type="button"
                      onClick={() => (isLongest ? setSource("auto") : editDuration(String(d.value), d.unit))}
                      className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:border-primary/50 hover:bg-primary/5",
                        active ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                      <span className="font-medium text-foreground/90">{d.label}</span> · {fmt(d.value!, d.unit)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <NoticeSlot state={msg} className="mt-4" />
      </Card>
    );
  },
);
