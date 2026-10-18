"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BriefcaseMedical, CalendarDays, Flag, Loader2, Plus, X } from "lucide-react";

interface ChiefComplaintCfg { id: string; label: string }
interface FactorTagCfg { id: string; kind: string; label: string; active: boolean }
interface SeverityLabelCfg { level: number; label: string }
interface SavedComplaintRow {
  chiefComplaintId: string | null; chiefComplaintLabel: string;
  onsetValue: number | null; onsetUnit: string | null;
  severityScore: number | null; aggravatingFactors: string; relievingFactors: string;
}

interface Draft {
  chiefComplaintId: string | null;
  chiefComplaintLabel: string;
  onsetValue: string;
  onsetUnit: string;
  severityScore: number;
  aggravatingFactors: string[];
  relievingFactors: string[];
}

const ONSET_UNITS = ["hours", "days", "weeks", "months", "years"];

function emptyDraft(id: string | null, label: string): Draft {
  return { chiefComplaintId: id, chiefComplaintLabel: label, onsetValue: "", onsetUnit: "days", severityScore: 1, aggravatingFactors: [], relievingFactors: [] };
}

export interface ChiefComplaintMatrixHandle {
  save: () => Promise<void>;
}

/** One complaint's duration as currently entered (saved or not). */
export interface ComplaintDuration { label: string; value: number | null; unit: string }

export const ChiefComplaintMatrix = forwardRef<ChiefComplaintMatrixHandle, {
  visitId: string;
  intakeComplaints: string[];
  /** Fires with every complaint's live duration whenever the doctor edits one — lets Stage 3's chronology auto-fill. */
  onDurationsChange?: (durations: ComplaintDuration[]) => void;
}>(
  function ChiefComplaintMatrix({ visitId, intakeComplaints, onDurationsChange }, ref) {
  const [loading, setLoading] = useState(true);
  const [complaintOptions, setComplaintOptions] = useState<ChiefComplaintCfg[]>([]);
  const [factorTags, setFactorTags] = useState<FactorTagCfg[]>([]);
  const [severityLabels, setSeverityLabels] = useState<SeverityLabelCfg[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [activeLabel, setActiveLabel] = useState<string>(intakeComplaints[0] || "");
  // The doctor-editable working list for this visit — starts from reception's
  // intake complaints but the doctor can add from the master catalog or drop
  // ones that turn out not to apply. Distinct from `intakeComplaints` (which
  // stays whatever reception originally captured) so "remove" doesn't try to
  // mutate a prop.
  const [complaintLabels, setComplaintLabels] = useState<string[]>(intakeComplaints);
  const [addComplaintOpen, setAddComplaintOpen] = useState(false);
  const [complaintSearch, setComplaintSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const msg = useNotice();

  useEffect(() => {
    Promise.all([
      api.get<{ complaints: ChiefComplaintCfg[] }>("/api/facility/screening/config"),
      api.get<{ factorTags: FactorTagCfg[]; severityLabels: SeverityLabelCfg[] }>("/api/facility/humor/config"),
      api.get<{ complaints: SavedComplaintRow[] }>(`/api/facility/visits/${visitId}/complaint-assessments`),
    ])
      .then(([screeningCfg, humorCfg, saved]) => {
        setComplaintOptions(screeningCfg.complaints || []);
        setFactorTags(humorCfg.factorTags || []);
        setSeverityLabels(humorCfg.severityLabels || []);

        const byLabel = new Map(saved.complaints.map((c) => [c.chiefComplaintLabel, c]));
        // Once the doctor has saved at least once, their current complaint
        // set (additions/removals included) is authoritative — falling back
        // to reception's original intake list on every reload would silently
        // undo a removal, since intake data lives in a separate table the
        // doctor's edits never touch. Only a visit with zero saved rows ever
        // seeds from intake.
        const unionLabels = saved.complaints.length > 0
          ? saved.complaints.map((c) => c.chiefComplaintLabel)
          : intakeComplaints;
        const next: Record<string, Draft> = {};
        for (const label of unionLabels) {
          const match = (screeningCfg.complaints || []).find((c) => c.label === label);
          const row = byLabel.get(label);
          if (row) {
            next[label] = {
              chiefComplaintId: row.chiefComplaintId,
              chiefComplaintLabel: label,
              onsetValue: row.onsetValue != null ? String(row.onsetValue) : "",
              onsetUnit: row.onsetUnit || "days",
              severityScore: row.severityScore ?? 1,
              aggravatingFactors: JSON.parse(row.aggravatingFactors || "[]"),
              relievingFactors: JSON.parse(row.relievingFactors || "[]"),
            };
          } else {
            next[label] = emptyDraft(match?.id ?? null, label);
          }
        }
        setLoadError(null);
        setDrafts(next);
        setComplaintLabels(unionLabels);
        setActiveLabel((cur) => (cur && unionLabels.includes(cur) ? cur : (unionLabels[0] || "")));
      })
      .catch((e) => setLoadError(e.message || "Network error"))
      .finally(() => setLoading(false));
    // Depend on a joined string, not the array itself — intakeComplaints is
    // easy for a caller to pass as a fresh array on every render (e.g. an
    // inline JSON.parse in JSX), which would re-trigger this load on every
    // parent re-render and silently wipe out unsaved edits mid-typing.
  }, [visitId, intakeComplaints.join("|"), reloadTick]);

  const active = drafts[activeLabel];

  const updateActive = (patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [activeLabel]: { ...prev[activeLabel], ...patch } }));
  };

  // Doctor's own additions/removals on top of whatever reception captured —
  // picks from the same master catalog reception uses, so data stays clean
  // (no free-text complaints), but the doctor isn't limited to their list.
  const addComplaint = (label: string) => {
    if (!complaintLabels.includes(label)) {
      const match = complaintOptions.find((c) => c.label === label);
      setComplaintLabels((prev) => [...prev, label]);
      setDrafts((prev) => ({ ...prev, [label]: emptyDraft(match?.id ?? null, label) }));
    }
    setActiveLabel(label);
    setComplaintSearch("");
    setAddComplaintOpen(false);
  };

  const removeComplaint = (label: string) => {
    const next = complaintLabels.filter((l) => l !== label);
    setComplaintLabels(next);
    setDrafts((prev) => {
      const rest = { ...prev };
      delete rest[label];
      return rest;
    });
    if (activeLabel === label) setActiveLabel(next[0] || "");
  };

  const addComplaintResults = complaintOptions.filter((c) => {
    if (complaintLabels.includes(c.label)) return false;
    const q = complaintSearch.trim().toLowerCase();
    return !q || c.label.toLowerCase().includes(q);
  });

  const toggleFactor = (kind: "aggravatingFactors" | "relievingFactors", label: string, add: boolean) => {
    const current = active?.[kind] || [];
    updateActive({ [kind]: add ? [...current, label] : current.filter((l) => l !== label) } as Partial<Draft>);
  };

  const severityLabelFor = (level: number) => severityLabels.find((s) => s.level === level)?.label || "";
  const severityAnchor = (level: number) => severityLabels.find((s) => s.level === level)?.label;

  const save = async () => {
    // Guard against the unified Save Draft/Proceed button firing before this
    // panel's own initial fetch has resolved — drafts would still be empty
    // at that point, and posting it would wipe out whatever was already
    // saved for this visit via the full-replace endpoint below.
    // A matrix that failed to load is equally empty — never save it over the real one.
    if (loading || loadError) return;
    try {
      await api.post(`/api/facility/visits/${visitId}/complaint-assessments`, {
        complaints: Object.values(drafts).map((d) => ({
          ...d,
          onsetValue: d.onsetValue === "" ? null : d.onsetValue,
        })),
      });
      msg.clear();
    } catch (e: any) {
      msg.error("The main complaints weren't saved", `${e.message || "Network error"}. Your entries are still shown above.`, { retry: () => { save().catch(() => {}); } });
      throw e;
    }
  };

  useImperativeHandle(ref, () => ({ save }), [drafts, loading, loadError, msg]);

  useEffect(() => {
    if (loading || !onDurationsChange) return;
    onDurationsChange(complaintLabels.map((label) => {
      const d = drafts[label];
      const n = d ? parseFloat(d.onsetValue) : NaN;
      return { label, value: Number.isFinite(n) && n > 0 ? n : null, unit: d?.onsetUnit || "days" };
    }));
  }, [drafts, complaintLabels, loading, onDurationsChange]);

  if (loadError) return <LoadFailed what="the main complaints" detail={loadError} onRetry={() => { setLoading(true); setReloadTick((t) => t + 1); }} />;
  if (loading) {
    return (
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading chief complaint matrix…
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 border-border/50 bg-card">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <BriefcaseMedical className="h-4.5 w-4.5" />
          </div>
          <h2 className="font-serif text-lg font-semibold">Main Complaints</h2>
        </div>
        <Badge variant="outline" className="shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <Flag className="h-3 w-3" /> Unani Triage Stage 1
        </Badge>
      </div>

      <div className="space-y-5">
        <div className="grid sm:grid-cols-[3fr_2fr] gap-4">
          {/* Complaints — chips double as tabs: the one selected is what the fields below describe */}
          <div>
            <FieldBox label="Primary reasons for visit" filled={complaintLabels.length > 0 || addComplaintOpen || !!complaintSearch} focused={addComplaintOpen}>
              {complaintLabels.map((label) => (
                <span
                  key={label}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveLabel(label)}
                  onKeyDown={(e) => { if (e.key === "Enter") setActiveLabel(label); }}
                  title={label === activeLabel ? "Details below are for this complaint" : "Click to fill in this complaint's details"}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-sm font-medium cursor-pointer transition-colors",
                    label === activeLabel
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/5 text-primary border-primary/30 hover:bg-primary/10"
                  )}
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeComplaint(label); }}
                    className={cn("rounded-full p-0.5", label === activeLabel ? "hover:bg-white/20" : "hover:bg-primary/15")}
                    aria-label={`Remove ${label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <div className="relative flex-1 min-w-32">
                <input
                  value={complaintSearch}
                  onChange={(e) => { setComplaintSearch(e.target.value); setAddComplaintOpen(true); }}
                  onFocus={() => setAddComplaintOpen(true)}
                  onBlur={() => setTimeout(() => setAddComplaintOpen(false), 150)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && addComplaintResults[0]) { e.preventDefault(); addComplaint(addComplaintResults[0].label); }
                    if (e.key === "Escape") { setComplaintSearch(""); setAddComplaintOpen(false); }
                  }}
                  placeholder={complaintLabels.length || addComplaintOpen ? "Add a complaint…" : ""}
                  className="w-full bg-transparent text-sm outline-none py-1 placeholder:text-muted-foreground/70"
                  aria-label="Add a complaint"
                />
                {addComplaintOpen && (
                  <div className="absolute left-0 top-full mt-2 z-30 w-72 rounded-lg border border-border/60 bg-popover shadow-lg max-h-60 overflow-y-auto py-1">
                    {addComplaintResults.slice(0, 30).map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addComplaint(c.label)}
                        className={cn("w-full text-left px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors flex items-center gap-1.5", i === 0 && complaintSearch && "bg-muted/40")}
                      >
                        <Plus className="h-3 w-3 text-muted-foreground shrink-0" /> {c.label}
                      </button>
                    ))}
                    {addComplaintResults.length === 0 && <p className="text-xs text-muted-foreground px-3 py-1.5">No matching complaints</p>}
                  </div>
                )}
              </div>
            </FieldBox>
            <p className="text-[11px] text-muted-foreground mt-1.5 px-1">
              {complaintLabels.length > 1
                ? <>Filling in details for <span className="font-semibold text-foreground">{activeLabel}</span> — click another complaint to switch.</>
                : "From reception's intake — add or remove as the consultation reveals more."}
            </p>
          </div>

          {/* Duration of the selected complaint */}
          {active && (
            <div>
              <div className="relative h-14 rounded-lg border border-input focus-within:border-primary flex items-center transition-colors">
                <input
                  id="complaint-duration"
                  type="number" min={0} inputMode="decimal"
                  value={active.onsetValue}
                  onChange={(e) => updateActive({ onsetValue: e.target.value })}
                  placeholder=" "
                  className="peer h-full flex-1 min-w-0 bg-transparent pl-3.5 text-base font-medium outline-none"
                />
                <label
                  htmlFor="complaint-duration"
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
                <Select value={active.onsetUnit} onValueChange={(v) => updateActive({ onsetUnit: v })}>
                  <SelectTrigger className="h-full border-0 shadow-none focus-visible:ring-0 w-28 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>{ONSET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mr-3" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 px-1">For <span className="font-medium text-foreground">{activeLabel}</span>{active.onsetValue ? ` · ${active.onsetValue} ${active.onsetUnit}` : ""}</p>
            </div>
          )}
        </div>

        {!active ? (
          <p className="text-sm text-muted-foreground">Add a complaint above to begin capturing this visit&apos;s findings.</p>
        ) : (
        <>
          {/* Severity */}
          <FieldBox label="How severe? (Shiddat-e-Marad)" filled className="block py-3">
            <div className="flex items-center gap-4">
              <Slider
                min={1} max={10} step={1}
                value={[active.severityScore]}
                onValueChange={(vals) => updateActive({ severityScore: vals[0] })}
                className="flex-1"
              />
              <span className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                active.severityScore >= 8 ? "bg-red-500/10 text-red-600 dark:text-red-400" : active.severityScore >= 5 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              )}>
                {active.severityScore}/10{severityLabelFor(active.severityScore) ? ` · ${severityLabelFor(active.severityScore)}` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground pr-1">
              <span>1 · {severityAnchor(1) || "Mild"}</span>
              <span>5 · {severityAnchor(5) || "Moderate"}</span>
              <span>10 · {severityAnchor(10) || "Severe"}</span>
            </div>
          </FieldBox>

          {/* What makes it worse / better */}
          <div className="grid sm:grid-cols-2 gap-4">
            {([
              { kind: "aggravatingFactors" as const, tagKind: "aggravating", title: "What makes it worse? (Muharrikat)", tone: "destructive" as const },
              { kind: "relievingFactors" as const, tagKind: "relieving", title: "What makes it better? (Musakkinat)", tone: "emerald" as const },
            ]).map(({ kind, tagKind, title, tone }) => {
              const selected = active[kind];
              const available = factorTags.filter((f) => f.kind === tagKind && f.active && !selected.includes(f.label));
              return (
                <Popover key={kind}>
                  <FieldBox label={title} filled={selected.length > 0}>
                    {selected.map((label) => (
                      <span
                        key={label}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-sm font-medium",
                          tone === "destructive"
                            ? "bg-destructive/10 text-destructive border-destructive/30"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {label}
                        <button type="button" onClick={() => toggleFactor(kind, label, false)} className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5" aria-label={`Remove ${label}`}>
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    {available.length > 0 && (
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors",
                            selected.length === 0 && "absolute inset-0 justify-end pr-3",
                          )}
                          aria-label={`Add to ${title}`}
                        >
                          <Plus className="h-4 w-4" />{selected.length > 0 && <span className="text-xs">Add</span>}
                        </button>
                      </PopoverTrigger>
                    )}
                  </FieldBox>
                  <PopoverContent className="w-60 p-1.5" align="start">
                    <div className="flex flex-col max-h-56 overflow-y-auto">
                      {available.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFactor(kind, f.label, true)}
                          className="text-left px-2.5 py-1.5 text-sm rounded-md hover:bg-muted/60 transition-colors"
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        </>
        )}
      </div>
      <NoticeSlot state={msg} className="mt-4" />
    </Card>
  );
});

/**
 * A bordered field with the house floating label: inside the box when empty,
 * up on the border once it holds something — same look as FloatingField,
 * for content that isn't a single text input (chips, a slider).
 */
function FieldBox({ label, filled, focused, className, children }: {
  label: string; filled?: boolean; focused?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "relative min-h-14 rounded-lg border px-3 py-2.5 flex flex-wrap items-center gap-1.5 transition-colors",
      focused ? "border-primary" : "border-input",
      className,
    )}>
      <span className={cn(
        "pointer-events-none absolute left-3 z-10 bg-card px-1.5 whitespace-nowrap transition-all duration-150",
        filled ? "top-0 -translate-y-1/2 text-sm font-semibold" : "top-1/2 -translate-y-1/2 text-base font-medium",
        focused ? "text-primary" : "text-muted-foreground",
      )}>
        {label}
      </span>
      {children}
    </div>
  );
}
