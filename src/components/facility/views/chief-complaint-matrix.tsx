"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BriefcaseMedical, CalendarDays, Flag, Loader2, Plus, X } from "lucide-react";

interface ScreeningOptionCfg { id: string; label: string }
interface ChiefComplaintCfg { id: string; label: string }
interface ScreeningQuestionCfg { id: string; label: string; type: string; options: ScreeningOptionCfg[] }
interface ScreeningModuleCfg { id: string; triggerComplaintIds: string[]; questions: ScreeningQuestionCfg[] }
interface L1Answer { questionId: string | null; questionLabel: string; value: string }
interface FactorTagCfg { id: string; kind: string; label: string; active: boolean }
interface SeverityLabelCfg { level: number; label: string }
interface SavedComplaintRow {
  chiefComplaintId: string | null; chiefComplaintLabel: string;
  onsetValue: number | null; onsetUnit: string | null;
  severityScore: number | null; aggravatingFactors: string; relievingFactors: string;
  screeningAnswers: string;
}

type AnswerValue = string | string[] | number;

interface Draft {
  chiefComplaintId: string | null;
  chiefComplaintLabel: string;
  onsetValue: string;
  onsetUnit: string;
  severityScore: number;
  aggravatingFactors: string[];
  relievingFactors: string[];
  screeningAnswers: Record<string, AnswerValue>;
}

const ONSET_UNITS = ["hours", "days", "weeks", "months", "years"];

function emptyDraft(id: string | null, label: string, screeningAnswers: Record<string, AnswerValue> = {}): Draft {
  return { chiefComplaintId: id, chiefComplaintLabel: label, onsetValue: "", onsetUnit: "days", severityScore: 1, aggravatingFactors: [], relievingFactors: [], screeningAnswers };
}

function parseAnswerValue(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
  } catch {
    return raw;
  }
}

// Shared by the live active-complaint memo and the initial-load pre-seed —
// the admin-configured questions whose module triggers on this complaint.
function relevantQuestionsFor(modules: ScreeningModuleCfg[], complaintId: string | null): ScreeningQuestionCfg[] {
  if (!complaintId) return [];
  const qs: ScreeningQuestionCfg[] = [];
  for (const m of modules) {
    if (!m.triggerComplaintIds.includes(complaintId)) continue;
    for (const q of m.questions) {
      if (q.type === "instruction") continue;
      qs.push(q);
    }
  }
  return qs;
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
  const [modules, setModules] = useState<ScreeningModuleCfg[]>([]);
  const [l1Answers, setL1Answers] = useState<L1Answer[]>([]);
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
      api.get<{ complaints: ChiefComplaintCfg[]; modules: ScreeningModuleCfg[] }>("/api/facility/screening/config"),
      api.get<{ screening: { answers: L1Answer[] } | null }>(`/api/facility/visits/${visitId}/screening`),
      api.get<{ factorTags: FactorTagCfg[]; severityLabels: SeverityLabelCfg[] }>("/api/facility/humor/config"),
      api.get<{ complaints: SavedComplaintRow[] }>(`/api/facility/visits/${visitId}/complaint-assessments`),
    ])
      .then(([screeningCfg, l1, humorCfg, saved]) => {
        setComplaintOptions(screeningCfg.complaints || []);
        setModules(screeningCfg.modules || []);
        setL1Answers(l1.screening?.answers || []);
        setFactorTags(humorCfg.factorTags || []);
        setSeverityLabels(humorCfg.severityLabels || []);

        const byLabel = new Map(saved.complaints.map((c) => [c.chiefComplaintLabel, c]));
        const l1Answers = l1.screening?.answers || [];
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
              screeningAnswers: row.screeningAnswers ? JSON.parse(row.screeningAnswers) : {},
            };
          } else {
            // No doctor capture yet for this complaint — give the questions a
            // starting point from what the nurse already found at L1
            // Screening, so the doctor confirms/edits rather than retypes.
            const seeded: Record<string, AnswerValue> = {};
            for (const q of relevantQuestionsFor(screeningCfg.modules || [], match?.id ?? null)) {
              const a = l1Answers.find((ans) => ans.questionId === q.id);
              if (!a) continue;
              try { seeded[q.id] = JSON.parse(a.value); } catch { seeded[q.id] = a.value; }
            }
            next[label] = emptyDraft(match?.id ?? null, label, seeded);
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

  const relevantQuestions = useMemo(
    () => relevantQuestionsFor(modules, active?.chiefComplaintId ?? null),
    [modules, active?.chiefComplaintId]
  );

  const l1AnswerFor = (questionId: string) => {
    const a = l1Answers.find((a) => a.questionId === questionId);
    return a ? parseAnswerValue(a.value) : null;
  };

  const updateAnswer = (questionId: string, value: AnswerValue) => {
    updateActive({ screeningAnswers: { ...(active?.screeningAnswers || {}), [questionId]: value } });
  };

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
    <Card className="p-5 border-border/50 bg-card/60">
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
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Primary Reason for Visit</label>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-2.5 min-h-11">
              {complaintLabels.length === 0 && <span className="text-xs text-muted-foreground px-1">No complaint added yet</span>}
              {complaintLabels.map((label) => (
                <Badge
                  key={label}
                  variant="outline"
                  onClick={() => setActiveLabel(label)}
                  className={cn(
                    "rounded-full pl-3 pr-1.5 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors",
                    label === activeLabel
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/60 border-border/50 hover:border-primary/40"
                  )}
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeComplaint(label); }}
                    className={cn("rounded-full p-0.5", label === activeLabel ? "hover:bg-white/20" : "hover:bg-black/10 dark:hover:bg-white/10")}
                    aria-label={`Remove ${label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Popover open={addComplaintOpen} onOpenChange={(open) => { setAddComplaintOpen(open); if (!open) setComplaintSearch(""); }}>
                <PopoverTrigger asChild>
                  <button type="button" className="rounded-full border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors h-6 w-6 flex items-center justify-center shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <Input
                    value={complaintSearch}
                    onChange={(e) => setComplaintSearch(e.target.value)}
                    placeholder="Search complaints…"
                    className="h-8 text-sm mb-1.5 bg-background/60"
                    autoFocus
                  />
                  <div className="flex flex-col max-h-56 overflow-y-auto">
                    {addComplaintResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => addComplaint(c.label)}
                        className="text-left px-2.5 py-1.5 text-sm rounded-md hover:bg-muted/60 transition-colors"
                      >
                        {c.label}
                      </button>
                    ))}
                    {addComplaintResults.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2.5 py-1.5">No matching complaints</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Reception&apos;s intake list, editable — add or remove as the consult reveals more.</p>
          </div>

          {active && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">Duration of Symptoms</label>
              <div className="flex items-center h-11 rounded-md border border-input bg-background/60 pr-3 overflow-hidden">
                <Input
                  type="number" min={0} value={active.onsetValue}
                  onChange={(e) => updateActive({ onsetValue: e.target.value })}
                  placeholder="e.g. 4"
                  className="h-full border-0 shadow-none focus-visible:ring-0 rounded-none"
                />
                <Select value={active.onsetUnit} onValueChange={(v) => updateActive({ onsetUnit: v })}>
                  <SelectTrigger className="h-full border-0 shadow-none focus-visible:ring-0 w-28 bg-transparent"><SelectValue /></SelectTrigger>
                  <SelectContent>{ONSET_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
              </div>
            </div>
          )}
        </div>

        {!active ? (
          <p className="text-sm text-muted-foreground">Add a chief complaint above to begin capturing this visit's findings.</p>
        ) : (
        <>
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <p className="text-sm font-medium">Severity Visual Scale (Shiddat-e-Marad)</p>
              <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {active.severityScore} / 10{severityLabelFor(active.severityScore) ? ` (${severityLabelFor(active.severityScore)})` : ""}
              </p>
            </div>
            <Slider
              min={1} max={10} step={1}
              value={[active.severityScore]}
              onValueChange={(vals) => updateActive({ severityScore: vals[0] })}
            />
            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
              <span>1 – {severityAnchor(1) || "Mild"}</span>
              <span>5 – {severityAnchor(5) || "Moderate"}</span>
              <span>10 – {severityAnchor(10) || "Severe"}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {([
              { kind: "aggravatingFactors" as const, tagKind: "aggravating", title: "Aggravating Factors (Muharrikat)", tone: "destructive" as const },
              { kind: "relievingFactors" as const, tagKind: "relieving", title: "Relieving Factors (Musakkinat)", tone: "emerald" as const },
            ]).map(({ kind, tagKind, title, tone }) => {
              const selected = active[kind];
              const available = factorTags.filter((f) => f.kind === tagKind && f.active && !selected.includes(f.label));
              return (
                <div key={kind}>
                  <p className="text-sm font-medium mb-2">{title}</p>
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/40 p-3 min-h-14">
                    {selected.length === 0 && <span className="text-xs text-muted-foreground">None selected</span>}
                    {selected.map((label) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className={cn(
                          "rounded-full pl-3 pr-1.5 py-1 text-xs font-medium flex items-center gap-1",
                          tone === "destructive"
                            ? "bg-destructive/15 text-destructive border-destructive/30"
                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {label}
                        <button type="button" onClick={() => toggleFactor(kind, label, false)} className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {available.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="rounded-full border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors h-6 w-6 flex items-center justify-center shrink-0">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1.5" align="start">
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
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {relevantQuestions.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Primary Complaint Questions — {activeLabel}</p>
              <div className="border-t border-border/40 divide-y divide-border/40">
                {relevantQuestions.map((q, i) => {
                  const l1Hint = l1AnswerFor(q.id);
                  const value = active.screeningAnswers[q.id];
                  return (
                    <div key={q.id} className="flex items-center justify-between gap-4 py-3 flex-wrap">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-0.5">{i + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{q.label}</p>
                          {l1Hint && <p className="text-[11px] text-muted-foreground mt-0.5">L1 Screening: {l1Hint}</p>}
                        </div>
                      </div>

                      {q.type === "single_select" && (
                        <div className="flex flex-wrap gap-2 justify-end shrink-0">
                          {q.options.map((o) => {
                            const selected = value === o.label;
                            return (
                              <button
                                key={o.id} type="button" onClick={() => updateAnswer(q.id, o.label)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs border transition-colors",
                                  selected ? "bg-primary text-primary-foreground border-primary" : "bg-background/60 border-border/50 hover:border-primary/40"
                                )}
                              >
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {q.type === "multi_select" && (
                        <div className="flex flex-wrap gap-2 justify-end shrink-0">
                          {q.options.map((o) => {
                            const arr = Array.isArray(value) ? value : [];
                            const selected = arr.includes(o.label);
                            return (
                              <button
                                key={o.id} type="button"
                                onClick={() => updateAnswer(q.id, selected ? arr.filter((v) => v !== o.label) : [...arr, o.label])}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs border transition-colors",
                                  selected ? "bg-primary text-primary-foreground border-primary" : "bg-background/60 border-border/50 hover:border-primary/40"
                                )}
                              >
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {q.type === "numeric" && (
                        <Input
                          type="number" value={value != null && !Array.isArray(value) ? String(value) : ""}
                          onChange={(e) => updateAnswer(q.id, e.target.value === "" ? "" : parseFloat(e.target.value))}
                          className="bg-background/60 w-32 shrink-0"
                        />
                      )}

                      {q.type === "text" && (
                        <Input
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => updateAnswer(q.id, e.target.value)}
                          className="bg-background/60 w-56 shrink-0"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
        )}
      </div>
      <NoticeSlot state={msg} className="mt-4" />
    </Card>
  );
});
