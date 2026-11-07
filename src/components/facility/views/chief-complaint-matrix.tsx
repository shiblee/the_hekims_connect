"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { SectionHeading } from "@/components/shared/section-heading";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BriefcaseMedical, Clock, Flag, Loader2, Plus, X } from "lucide-react";
import { canRequestNew, complaintResults, pickableComplaints, requestNewComplaint, useComplaintPickerText, type ComplaintConfigResponse, type PickComplaint } from "@/components/facility/complaint-picker";

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
  const [complaintOptions, setComplaintOptions] = useState<PickComplaint[]>([]);
  const [factorTags, setFactorTags] = useState<FactorTagCfg[]>([]);
  const [severityLabels, setSeverityLabels] = useState<SeverityLabelCfg[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
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
  const cp = useComplaintPickerText();
  const t = useTranslations("clinic.complaints");
  const tc = useTranslations("common");

  useEffect(() => {
    Promise.all([
      api.get<ComplaintConfigResponse>("/api/facility/screening/config"),
      api.get<{ factorTags: FactorTagCfg[]; severityLabels: SeverityLabelCfg[] }>("/api/facility/humor/config"),
      api.get<{ complaints: SavedComplaintRow[] }>(`/api/facility/visits/${visitId}/complaint-assessments`),
    ])
      .then(([screeningCfg, humorCfg, saved]) => {
        setComplaintOptions(pickableComplaints(screeningCfg));
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
              chiefComplaintId: row.chiefComplaintId ?? match?.id ?? null,
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
      })
      .catch((e) => setLoadError(e.message || tc("network_error")))
      .finally(() => setLoading(false));
    // Depend on a joined string, not the array itself — intakeComplaints is
    // easy for a caller to pass as a fresh array on every render (e.g. an
    // inline JSON.parse in JSX), which would re-trigger this load on every
    // parent re-render and silently wipe out unsaved edits mid-typing.
  }, [visitId, intakeComplaints.join("|"), reloadTick]);

  // Doctor's own additions/removals on top of whatever reception captured —
  // picks from the same master catalog reception uses, so data stays clean
  // (no free-text complaints), but the doctor isn't limited to their list.
  const addComplaint = (label: string) => {
    if (!complaintLabels.includes(label)) {
      const match = complaintOptions.find((c) => c.label === label);
      setComplaintLabels((prev) => [...prev, label]);
      // A complaint still pending review has no master id — nothing rule-driven reads it.
      setDrafts((prev) => ({ ...prev, [label]: emptyDraft(match && !match.pending ? match.id : null, label) }));
    }
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
  };

  // Same search as registration; with nothing typed, the whole list A–Z.
  const addComplaintResults = complaintSearch.trim()
    ? complaintResults(complaintOptions, complaintSearch, (c) => complaintLabels.includes(c.label), [], 60)
    : complaintOptions.filter((c) => !complaintLabels.includes(c.label)).sort((a, b) => a.label.localeCompare(b.label));
  const typed = complaintSearch.trim();
  const canAddNew = canRequestNew(typed, complaintOptions);
  const addNewComplaint = async () => {
    const picked = await requestNewComplaint(typed, msg, cp.t);
    if (!picked) return;
    setComplaintOptions((prev) => (prev.some((p) => p.id === picked.id) ? prev : [...prev, picked]));
    addComplaint(picked.label);
  };


  const severityLabelFor = (level: number) => severityLabels.find((s) => s.level === level)?.label || "";

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
      msg.error(t("not_saved"), t("not_saved_hint", { error: e.message || tc("network_error") }), { retry: () => { save().catch(() => {}); } });
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

  if (loadError) return <LoadFailed what={t("the_complaints")} detail={loadError} onRetry={() => { setLoading(true); setReloadTick((n) => n + 1); }} />;
  if (loading) {
    return (
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading chief complaint matrix…
        </div>
      </Card>
    );
  }

  // One row per complaint: each field in its own column.
  const update = (label: string, patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [label]: { ...prev[label], ...patch } }));
  const sevTone = (n: number) => (n >= 8 ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" : n >= 5 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30");
  const COLS = "md:grid-cols-[minmax(0,1.1fr)_9rem_12rem_minmax(0,1.2fr)_minmax(0,1.2fr)_2rem]";

  return (
    <Card className="p-5 border-border/50 bg-card">
      <SectionHeading
        icon={BriefcaseMedical}
        title={t("title")}
        right={
          <span className="flex items-center gap-2">
            <Badge variant="outline" className="hidden shrink-0 border-amber-500/40 text-amber-600 dark:text-amber-400 sm:flex items-center gap-1">
              <Flag className="h-3 w-3" /> {t("stage1")}
            </Badge>
            <Popover open={addComplaintOpen} onOpenChange={(o) => { setAddComplaintOpen(o); if (!o) setComplaintSearch(""); }}>
              <PopoverTrigger asChild>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
                  <Plus className="h-4 w-4" /> {t("add_complaint_btn")}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-1.5">
                <Input autoFocus value={complaintSearch} onChange={(e) => setComplaintSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key !== "Enter") return; e.preventDefault(); if (addComplaintResults[0]) addComplaint(addComplaintResults[0].label); else if (canAddNew) addNewComplaint(); }}
                  placeholder={t("search_complaints", { count: addComplaintResults.length })} className="mb-1.5 h-9 text-sm" aria-label={t("add_aria")} />
                <div className="flex max-h-72 flex-col overflow-y-auto">
                  {addComplaintResults.slice(0, 60).map((c, i) => {
                    const sub = cp.describe(c, complaintSearch);
                    return (
                      <button key={c.id} type="button" onClick={() => addComplaint(c.label)}
                        className={cn("flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-muted/60", i === 0 && complaintSearch && "bg-muted/40")}>
                        {c.pending ? <Clock className="mt-1 h-3 w-3 shrink-0 text-amber-600" /> : <Plus className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />}
                        <span className="min-w-0">{c.label}{sub && <span className="block text-[11px] leading-snug text-muted-foreground">{sub}</span>}</span>
                      </button>
                    );
                  })}
                  {addComplaintResults.length === 0 && <p className="px-2.5 py-1.5 text-[13px] text-muted-foreground">{canAddNew ? cp.t("no_match_add") : t("no_match")}</p>}
                  {canAddNew && (
                    <button type="button" onClick={addNewComplaint}
                      className="mt-1 flex items-start gap-1.5 rounded-md border-t border-border px-2.5 pt-2 pb-1.5 text-start text-sm text-primary transition-colors hover:bg-muted/60">
                      <Plus className="mt-1 h-3 w-3 shrink-0" /> {cp.t("add_new", { q: typed })}
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </span>
        }
      />

      {complaintLabels.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("empty_table")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className={cn("hidden gap-3 border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid", COLS)}>
            <span>{t("col_complaint")}</span><span>{t("col_duration")}</span><span>{t("col_severity")}</span><span>{t("col_worse")}</span><span>{t("col_better")}</span><span />
          </div>
          <ul className="divide-y divide-border">
            {complaintLabels.map((label) => {
              const d = drafts[label];
              if (!d) return null;
              return (
                <li key={label} className={cn("grid items-start gap-3 px-3 py-2.5", COLS)}>
                  <div className="pt-1.5">
                    <p className="text-sm font-semibold leading-snug">{label}</p>
                    {!d.chiefComplaintId && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400" title={cp.t("pending_row")}>
                        <Clock className="h-3 w-3" /> {cp.t("pending_short")}
                      </p>
                    )}
                  </div>
                  {/* Duration */}
                  <div className="flex h-8 items-center overflow-hidden rounded-md border border-input bg-background/60 focus-within:border-primary">
                    <input type="number" min={0} inputMode="decimal" value={d.onsetValue} onChange={(e) => update(label, { onsetValue: e.target.value })}
                      placeholder="—" aria-label={`${t("col_duration")} · ${label}`} className="h-full w-12 min-w-0 bg-transparent px-2 text-sm font-medium outline-none" />
                    <Select value={d.onsetUnit} onValueChange={(v) => update(label, { onsetUnit: v })}>
                      <SelectTrigger className="h-full flex-1 rounded-none border-0 border-s border-input px-2 text-xs shadow-none focus-visible:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>{ONSET_UNITS.map((u) => <SelectItem key={u} value={u}>{t(`u_${u}`)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {/* Severity 1–10 */}
                  <Select value={String(d.severityScore)} onValueChange={(v) => update(label, { severityScore: Number(v) })}>
                    <SelectTrigger className={cn("h-8 w-full border text-xs font-semibold", sevTone(d.severityScore))} aria-label={`${t("col_severity")} · ${label}`} title={`${d.severityScore}/10${severityLabelFor(d.severityScore) ? ` · ${severityLabelFor(d.severityScore)}` : ""}`}>
                      <SelectValue>{d.severityScore}/10{severityLabelFor(d.severityScore) ? ` · ${severityLabelFor(d.severityScore)}` : ""}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}/10{severityLabelFor(n) ? ` · ${severityLabelFor(n)}` : n === 1 ? ` · ${t("mild")}` : n === 5 ? ` · ${t("moderate")}` : n === 10 ? ` · ${t("severe")}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Worse / better */}
                  {(["aggravatingFactors", "relievingFactors"] as const).map((kind) => (
                    <FactorCell key={kind} kind={kind} tags={factorTags} selected={d[kind]} tone={kind === "aggravatingFactors" ? "destructive" : "emerald"}
                      title={kind === "aggravatingFactors" ? t("col_worse") : t("col_better")}
                      onChange={(next) => update(label, { [kind]: next } as Partial<Draft>)} />
                  ))}
                  <button type="button" onClick={() => removeComplaint(label)} aria-label={t("remove", { label })} title={t("remove", { label })}
                    className="mt-1 justify-self-end rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <NoticeSlot state={msg} className="mt-4" />
    </Card>
  );
});

/** Worse-with / better-with cell: chosen factors as chips, + to add from the list (or type a new one). */
function FactorCell({ kind, tags, selected, tone, title, onChange }: {
  kind: "aggravatingFactors" | "relievingFactors"; tags: FactorTagCfg[]; selected: string[]; tone: "destructive" | "emerald"; title: string; onChange: (next: string[]) => void;
}) {
  const t = useTranslations("clinic.complaints");
  const [q, setQ] = useState("");
  const tagKind = kind === "aggravatingFactors" ? "aggravating" : "relieving";
  const available = tags.filter((f) => f.kind === tagKind && f.active && !selected.includes(f.label));
  const ql = q.trim().toLowerCase();
  const shown = ql ? available.filter((f) => f.label.toLowerCase().includes(ql)) : available;
  const custom = ql && !tags.some((f) => f.kind === tagKind && f.label.toLowerCase() === ql) && !selected.some((l) => l.toLowerCase() === ql) ? q.trim() : "";
  const add = (l: string) => { onChange([...selected, l]); setQ(""); };
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-1">
      {selected.map((l) => (
        <span key={l} className={cn("inline-flex items-center gap-0.5 rounded-full border py-0.5 ps-2 pe-0.5 text-xs font-medium",
          tone === "destructive" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>
          {l}
          <button type="button" onClick={() => onChange(selected.filter((x) => x !== l))} className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10" aria-label={t("remove", { label: l })}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <Popover onOpenChange={(o) => { if (!o) setQ(""); }}>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t("add_to", { title })} className="inline-flex h-6 items-center gap-0.5 rounded-full border border-dashed border-border px-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">
            <Plus className="h-3 w-3" />{selected.length === 0 && t("add")}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-1.5" align="start">
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const pick = shown[0]?.label || custom; if (pick) add(pick); } }}
            placeholder={t("search_factors", { count: available.length })} className="mb-1.5 h-8 text-sm" />
          <div className="flex max-h-64 flex-col overflow-y-auto">
            {shown.length === 0 && !custom && <p className="px-2.5 py-1.5 text-sm text-muted-foreground">{t("no_factor")}</p>}
            {shown.map((f) => <button key={f.id} type="button" onClick={() => add(f.label)} className="rounded-md px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-muted/60">{f.label}</button>)}
            {custom && <button type="button" onClick={() => add(custom)} className="rounded-md px-2.5 py-1.5 text-start text-sm text-primary transition-colors hover:bg-muted/60"><Plus className="me-1 inline h-3.5 w-3.5" />{t("add_custom", { q: custom })}</button>}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
