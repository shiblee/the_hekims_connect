"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDateLocale, useValueLabel } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AKHLAT, isAnswered, questionVisible, type AsbabAnswer, type AsbabQuestionCfg, type HumourPoints } from "@/lib/asbab";
import { DARJA, PRIORITIES, SU_MIZAJ_TYPES, type PrescriptionLine, type TadbeerLine, type TashkheesOptionRow } from "@/lib/tashkhees";
import { useAsbabAssessment } from "@/components/facility/views/asbab-assessment";
import { Card } from "@/components/ui/card";
import { InlineNotice, LoadFailed, useNotice } from "@/components/shared/inline-notice";
import { foodThumb } from "@/lib/food-thumb";
import { MarzSection, type AmrazOption, type DossierDiagnosis } from "@/components/facility/views/marz-diagnosis";
import { SafetyReviewPanel } from "@/components/facility/views/safety-review-panel";
import { ReasoningPanel } from "@/components/facility/views/reasoning-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeading } from "@/components/shared/section-heading";
import { FloatingField, FloatingMultiSelect, FloatingSelect, FloatingTextarea } from "@/components/shared/floating-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sortLabels } from "@/lib/sort-options";
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, Check, ClipboardCheck, FileSignature, HeartPulse, Leaf, Loader2, Pill, Plus,
  Search, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, Trash2, Utensils, X,
} from "lucide-react";

// ---------------------------------------------------------------- state

interface Dossier {
  status: "draft" | "submitted" | "finalized"; submittedAt?: string | null; submittedByName?: string | null; returnNote?: string | null; prescriptionId?: string | null; finalizedAt: string | null; finalizedByName: string | null;
  mizajAsli: string | null; suMizajType: string | null; suMizajQuality: string | null; suMizajGrade: number | null;
  organs: string[]; diagnosisNote: string | null; usool: string[]; usoolNote: string | null;
  ghizaRecommended: string[]; ghizaAvoid: string[]; ghizaNote: string | null;
  tadbeer: TadbeerLine[]; prescriptions: PrescriptionLine[];
  prognosis: string | null; followUpDate: string | null; followUpNote: string | null;
  urgentDirectives: string | null; priority: string; handoverNote: string | null;
  diagnoses: DossierDiagnosis[]; sabab: string[]; icdCode: string | null; icdLabel: string | null;
  revision?: number;
  versions?: { version: number; kind: "finalized" | "amended"; reason: string | null; byName: string | null; createdAt: string; contextHash?: string | null }[];
  treatmentResponse?: string | null; treatmentResponseNote?: string | null;
}
const EMPTY: Dossier = {
  status: "draft", finalizedAt: null, finalizedByName: null, mizajAsli: null, suMizajType: null, suMizajQuality: null, suMizajGrade: null,
  organs: [], diagnosisNote: null, usool: [], usoolNote: null, ghizaRecommended: [], ghizaAvoid: [], ghizaNote: null,
  tadbeer: [], prescriptions: [], diagnoses: [], sabab: [], icdCode: null, icdLabel: null, prognosis: null, followUpDate: null, followUpNote: null, urgentDirectives: null, priority: "routine", handoverNote: null,
};
interface Herb { id: string; label: string; category: string | null; forms: string[] }
type Warn = { level: "high" | "caution" | "info"; text: string; verified: boolean };

/** Dossier + Dala'il answers + option lists for Stage 5. */
export function useTashkhees(visitId: string | undefined) {
  const dalail = useAsbabAssessment(visitId, "dalail");
  const [options, setOptions] = useState<Record<string, TashkheesOptionRow[]> | null>(null);
  const [herbs, setHerbs] = useState<Herb[]>([]);
  const [amraz, setAmraz] = useState<AmrazOption[]>([]);
  const [dossier, setDossier] = useState<Dossier>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"draft" | "finalize" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // Medicine safety check for the current medicine lines — finalising waits for it to have run.
  const [safety, setSafety] = useState<"idle" | "checking" | "ok" | "failed">("idle");
  // High-risk safety-review items still without a reason (null = not loaded / failed).
  const [safetyBlocking, setSafetyBlocking] = useState<number | null>(null);
  const msg = useNotice();
  const td = useTranslations("clinic.dossier");
  const ts = useTranslations("clinic.safety");
  const tc = useTranslations("common");

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    Promise.all([
      api.get<{ options: Record<string, TashkheesOptionRow[]>; herbs: Herb[]; amraz: AmrazOption[] }>("/api/facility/tashkhees/options"),
      api.get<{ dossier: Dossier | null }>(`/api/facility/visits/${visitId}/dossier`),
    ])
      .then(([o, d]) => {
        if (cancelled) return;
        setLoadError(null);
        setOptions(o.options); setHerbs(o.herbs); setAmraz(o.amraz || []);
        if (d.dossier) setDossier({ ...EMPTY, ...d.dossier, followUpDate: d.dossier.followUpDate ? d.dossier.followUpDate.slice(0, 10) : null });
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || tc("network_error")); });
    return () => { cancelled = true; };
  }, [visitId, reloadTick]);
  const reload = () => { setLoadError(null); setReloadTick((n) => n + 1); if (dalail.loadError) dalail.reload(); };

  const set = useCallback((patch: Partial<Dossier>) => { setDossier((d) => ({ ...d, ...patch })); setDirty(true); }, []);

  /** Saves the dossier (and the Dala'il answers). A finalised dossier is only changed by amending it (finalize + reason). */
  const save = async (finalize: boolean, amendReason?: string) => {
    if (!visitId) return false;
    const locked = dossier.status === "finalized" && !finalize;
    setSaving(finalize ? "finalize" : "draft");
    try {
      const [res, dalailOk] = await Promise.all([
        locked ? Promise.resolve(null) : api.post<{ dossier: Dossier }>(`/api/facility/visits/${visitId}/dossier`, { ...dossier, finalize, amendReason }),
        dalail.save(false),
      ]);
      if (res) setDossier({ ...EMPTY, ...res.dossier, followUpDate: res.dossier.followUpDate ? res.dossier.followUpDate.slice(0, 10) : null });
      setDirty(false);
      dalail.msg.clear();
      if (!dalailOk) {
        msg.error(td("dalail_not_saved"), td("dalail_not_saved_hint"), { retry: () => save(finalize), retryLabel: td("save_again") });
        return false;
      }
      msg.clear();
      return true;
    } catch (e: any) {
      if (e?.status === 409 && e?.data?.safety) {
        msg.error(ts("need_safety_title"), ts("need_safety_hint"), { retry: () => document.getElementById("safety")?.scrollIntoView({ behavior: "smooth", block: "start" }), retryLabel: ts("go_safety") });
        return false;
      }
      if (e?.status === 409 && e?.data?.conflict) {
        msg.error(td("conflict_title"), td("conflict_hint"), { retry: reload, retryLabel: td("reload") });
        return false;
      }
      msg.error(
        finalize ? td("not_finalised") : td("draft_not_saved"),
        td("on_screen", { error: e.message || tc("network_error") }),
        { retry: () => save(finalize), retryLabel: tc("retry") },
      );
      return false;
    } finally {
      setSaving(null);
    }
  };

  // Draft autosave: a minute after the last change, quietly save a draft (never a finalised or submitted dossier).
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (!dirty || !options || saving || dossier.status !== "draft") return;
    const timer = setTimeout(() => { saveRef.current(false).then((ok) => { if (ok) setAutoSavedAt(new Date()); }); }, 60_000);
    return () => clearTimeout(timer);
  }, [dossier, dirty, options, saving]);

  /** A senior sends a submitted dossier back with a note. */
  const sendBack = async (note: string) => {
    if (!visitId) return false;
    try {
      const res = await api.post<{ dossier: Dossier }>(`/api/facility/visits/${visitId}/dossier`, { sendBack: true, returnNote: note });
      setDossier({ ...EMPTY, ...res.dossier, followUpDate: res.dossier.followUpDate ? res.dossier.followUpDate.slice(0, 10) : null });
      return true;
    } catch (e: any) {
      msg.error(td("draft_not_saved"), td("on_screen", { error: e.message || tc("network_error") }));
      return false;
    }
  };

  return { dalail, options, herbs, amraz, dossier, set, sendBack, autoSavedAt, dirty: dirty || dalail.dirty, saving, save, msg, loadError: loadError || dalail.loadError, reload, safety, setSafety, safetyBlocking, setSafetyBlocking };
}
type TashkheesState = ReturnType<typeof useTashkhees>;

// ---------------------------------------------------------------- small pieces


function Panel({ icon: Icon, title, aside, tour, children }: { icon: typeof Activity; title: string; hint?: string; aside?: ReactNode; tour?: string; children: ReactNode }) {
  return (
    <Card data-tour={tour} className="p-5 border-border/50 bg-card/60 gap-4">
      <SectionHeading icon={Icon} title={title} right={aside} />
      {children}
    </Card>
  );
}

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return <p className="text-[15px] font-semibold mb-2">{children}{required && <span className="text-destructive"> *</span>}</p>;
}

/** Selectable chips (single or multi) — same visual language as the other selectors. */
function Chips({ items, selected, onToggle, tone = "emerald" }: {
  items: { label: string; sub?: string | null; tip?: string | null }[]; selected: string[]; onToggle: (label: string) => void; tone?: "emerald" | "red";
}) {
  return (
    <div className="flex flex-wrap content-start items-start self-start gap-2">
      {items.map((it) => {
        const on = selected.includes(it.label);
        return (
          <button key={it.label} type="button" onClick={() => onToggle(it.label)} aria-pressed={on} title={it.tip || it.sub || undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm leading-snug transition-colors text-start",
              on ? (tone === "red" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")
                : "border-border/60 bg-background/40 hover:border-primary/40",
            )}>
            {it.label}{it.sub && <span className="text-xs text-muted-foreground"> · {it.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Segmented<T extends string | number>({ value, options, onChange }: { value: T | null; options: { value: T; label: string }[]; onChange: (v: T | null) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-border/60 bg-background/40 p-0.5">
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => onChange(value === o.value ? null : o.value)}
          className={cn("rounded-md px-3 py-1 text-sm transition-colors", value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function HumourBars({ pct, compact }: { pct: HumourPoints; compact?: boolean }) {
  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      {AKHLAT.map((h) => (
        <div key={h.key} className="grid grid-cols-[62px_1fr_36px] items-center gap-2 text-xs">
          <span className="text-muted-foreground">{h.label}</span>
          <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full", h.bar)} style={{ width: `${pct[h.key]}%` }} /></span>
          <span className="text-end tabular-nums">{pct[h.key]}%</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- tab 1: Dala'il

function DalailRow({ q, value, onChange, reason, tag, onRemove }: {
  q: AsbabQuestionCfg; value: AsbabAnswer | undefined; onChange: (v: AsbabAnswer) => void;
  /** Why this question was selected for the patient. */
  reason?: string;
  tag?: "new" | "added" | "safety" | "earlier";
  onRemove?: () => void;
}) {
  const td = useTranslations("clinic.dossier");
  const sel = Array.isArray(value) ? value : [];
  const toggle = (l: string) => onChange(q.type === "multi_select" ? (sel.includes(l) ? sel.filter((x) => x !== l) : [...sel, l]) : (sel.includes(l) ? [] : [l]));
  return (
    <div className="grid md:grid-cols-[230px_1fr] gap-x-4 gap-y-2 py-3 border-t border-border/40 first:border-t-0">
      <div>
        <p className="text-[15px] font-medium">
          {q.label}{q.required && <span className="text-destructive"> *</span>}
          {tag === "safety" && <span className="ms-1.5 align-middle rounded-full bg-destructive/10 border border-destructive/30 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-destructive">{td("safety")}</span>}
          {tag === "new" && <span className="ms-1.5 align-middle rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">{td("new")}</span>}
        </p>
        {q.labelLocal && <p className="text-[13px] text-muted-foreground">{q.labelLocal}</p>}
        {reason && (
          <p className="mt-0.5 flex items-start gap-1 text-xs text-primary/90"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" /><span>{reason}</span></p>
        )}
        {tag === "added" && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">{td("added_by_you")}
            {onRemove && <button type="button" onClick={onRemove} className="text-primary hover:underline">{td("remove")}</button>}
          </p>
        )}
        {tag === "earlier" && <p className="mt-0.5 text-xs text-muted-foreground">{td("earlier")}</p>}
      </div>
      {q.type === "text"
        ? <FloatingField id={`dalail-${q.id}`} label={td("describe")} maxLength={500} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        : <Chips items={q.options.map((o) => ({ label: o.label, tip: o.description }))} selected={sel} onToggle={toggle} />}
    </div>
  );
}

const DALAIL_VIEW_KEY = "hekims-dalail-view";

interface DalailSelectionData {
  questionIds: string[]; reasons: Record<string, string>; addedIds: string[]; newIds: string[]; safetyIds: string[];
  method: string; eligibleCount: number; bankSize: number;
  context: { complaints: { label: string; primary: boolean }[]; symptoms: string[]; regions: string[] };
}

/**
 * Dala'il — adaptive clinical signs. The server selects a small set of
 * approved examination questions from what's already recorded for the visit
 * (complaints, other symptoms, body regions, onset, vitals); each shows why it
 * was selected. Answered questions always stay visible; the doctor can add any
 * approved question or switch to the full bank.
 */
function DalailTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { pillars, answers, setAnswer, drift } = state.dalail;
  const [view, setViewState] = useState<"selected" | "all">(() => {
    try { return localStorage.getItem(DALAIL_VIEW_KEY) === "all" ? "all" : "selected"; } catch { return "selected"; }
  });
  const setView = (v: "selected" | "all") => { setViewState(v); try { localStorage.setItem(DALAIL_VIEW_KEY, v); } catch { /* per-viewer convenience only */ } };
  const [sel, setSel] = useState<DalailSelectionData | null>(null);
  const [selError, setSelError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const td = useTranslations("clinic.dossier");

  const fetchSel = useCallback((refresh: boolean) =>
    api.get<{ selection: DalailSelectionData }>(`/api/facility/visits/${visitId}/dalail-selection${refresh ? "?refresh=1" : ""}`)
      .then((r) => { setSel(r.selection); setSelError(false); })
      .catch(() => setSelError(true)), [visitId]);
  const load = (refresh: boolean) => { setRefreshing(true); fetchSel(refresh).finally(() => setRefreshing(false)); };
  useEffect(() => { fetchSel(false); }, [fetchSel]);

  if (!pillars) return <Loading />;
  if (!pillars.length) return <Card className="p-5 text-sm text-muted-foreground">{td("no_sections")}</Card>;

  const allQs = pillars.flatMap((p) => p.questions.filter((q) => questionVisible(q, answers)).map((q) => ({ p, q })));
  // Without a selection (still loading or it failed) fall back to every question, so the examination is never blocked.
  const mode = sel && !selError ? view : "all";
  const picked = new Set(sel ? [...sel.questionIds, ...sel.addedIds] : []);
  const visibleIds = new Set(mode === "all"
    ? allQs.map(({ q }) => q.id)
    : allQs.filter(({ q }) => picked.has(q.id) || isAnswered(answers[q.id])).map(({ q }) => q.id));
  const sections = pillars.map((p) => ({ p, qs: p.questions.filter((q) => visibleIds.has(q.id) && questionVisible(q, answers)) })).filter((x) => x.qs.length);
  const shown = sections.flatMap((x) => x.qs);
  const answeredN = shown.filter((q) => isAnswered(answers[q.id])).length;
  const hasSigns = drift && AKHLAT.some((h) => drift.total[h.key] > 0);
  const jump = (k: string) => { const el = refs.current[k]; if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" }); };
  const tagFor = (id: string): "new" | "added" | "safety" | "earlier" | undefined => {
    if (!sel || mode === "all") return undefined;
    if (sel.safetyIds.includes(id) && sel.questionIds.includes(id)) return "safety";
    if (sel.newIds.includes(id)) return "new";
    if (sel.addedIds.includes(id) && !sel.questionIds.includes(id)) return "added";
    if (!picked.has(id)) return "earlier";
    return undefined;
  };
  const changeAdded = async (id: string, add: boolean) => {
    try {
      const r = await api.post<{ addedIds: string[] }>(`/api/facility/visits/${visitId}/dalail-selection`, add ? { add: id } : { remove: id });
      setSel((cur) => (cur ? { ...cur, addedIds: r.addedIds } : cur));
    } catch { /* the list simply stays as it was */ }
  };
  const aq = addQuery.trim().toLowerCase();
  const addable = allQs.filter(({ q }) => !visibleIds.has(q.id) && (!aq || q.label.toLowerCase().includes(aq) || q.options.some((o) => o.label.toLowerCase().includes(aq))));

  return (
    <Panel icon={Stethoscope} tour="dossier.dalail" title={td("dalail_title")}
      aside={
        <span className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {sel && !selError && (
            <span className="inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5" role="group" aria-label={td("which_signs")}>
              {([["selected", td("for_patient", { count: sel.questionIds.length + sel.addedIds.filter((x) => !sel.questionIds.includes(x)).length })], ["all", td("all_n", { count: allQs.length })]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setView(m)} aria-pressed={view === m}
                  className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors", view === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </span>
          )}
          <Badge variant="outline" className="tabular-nums">{td("n_recorded", { n: answeredN, total: shown.length })}</Badge>
        </span>
      }>

      {/* What the selection was based on */}
      {sel && !selError && mode === "selected" && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-[13px] font-semibold text-primary flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> {td("selected_for")}</p>
            <button type="button" onClick={() => load(true)} disabled={refreshing} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
              {refreshing ? td("rechecking") : td("recheck")}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sel.context.complaints.map((c) => (
              <span key={c.label} className={cn("rounded-full border px-2.5 py-0.5 text-xs", c.primary ? "border-primary/50 bg-primary/10 font-semibold text-primary" : "border-border/60 bg-background/50")}>{c.label}</span>
            ))}
            {sel.context.symptoms.map((x) => <span key={x} className="rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5 text-xs">{x}</span>)}
            {sel.context.regions.map((x) => <span key={x} className="rounded-full border border-dashed border-border/70 px-2.5 py-0.5 text-xs text-muted-foreground">{x}</span>)}
            {sel.context.complaints.length + sel.context.symptoms.length + sel.context.regions.length === 0 && (
              <span className="text-xs text-muted-foreground">{td("no_context")}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {td("sel_summary", { n: sel.questionIds.length, eligible: sel.eligibleCount, bank: sel.bankSize })}
            {" · "}{sel.method === "ranked" ? td("by_insight") : td("by_rules")}
            {sel.method === "rules-fallback" && td("insight_down")}
          </p>
        </div>
      )}
      {selError && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-400">
          {td.rich("sel_failed", { retry: (c) => <button type="button" onClick={() => load(false)} className="font-medium underline">{c}</button> })}
        </p>
      )}

      {/* Jump bar */}
      {sections.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {sections.map(({ p, qs }) => {
            const a = qs.filter((q) => isAnswered(answers[q.id])).length;
            const done = a === qs.length;
            return (
              <button key={p.key} type="button" onClick={() => jump(p.key)}
                className={cn("rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border/50 bg-background/40 hover:border-primary/40")}>
                {p.label} <span className="text-xs tabular-nums opacity-80">{done ? "✓" : `${a}/${qs.length}`}</span>
              </button>
            );
          })}
        </div>
      )}

      {!sel && !selError ? <Loading /> : (
        <div className="space-y-4">
          {sections.map(({ p, qs }) => {
            const a = qs.filter((q) => isAnswered(answers[q.id])).length;
            const done = a === qs.length;
            return (
              <div key={p.key} ref={(el) => { refs.current[p.key] = el; }}
                className={cn("rounded-xl border border-s-4 bg-background/30 px-4 pt-3 pb-1", done ? "border-border/50 border-s-emerald-500/70" : "border-border/50 border-s-primary/40")}>
                <div className="flex items-center justify-between gap-2 pb-1">
                  <p className="text-[15px] font-semibold">{p.label} <span className="text-[13px] font-normal text-muted-foreground">· {p.english}</span></p>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs tabular-nums", done ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-border/60 text-muted-foreground")}>{done ? td("done") : `${a}/${qs.length}`}</span>
                </div>
                {qs.map((q) => {
                  const tag = tagFor(q.id);
                  return (
                    <DalailRow key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)}
                      reason={mode === "selected" && sel?.questionIds.includes(q.id) ? sel.reasons[q.id]?.replace(/^Safety check · /, "") : undefined}
                      tag={tag} onRemove={tag === "added" ? () => changeAdded(q.id, false) : undefined} />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Doctor control: add any approved question */}
      {mode === "selected" && sel && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> {td("add_question")}</Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-2" align="start">
              <Input autoFocus value={addQuery} onChange={(e) => setAddQuery(e.target.value)} placeholder={td("search_questions")} className="h-9 mb-2" />
              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {addable.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{aq ? td("no_other") : td("all_shown")}</p>}
                {addable.slice(0, 60).map(({ p, q }) => (
                  <button key={q.id} type="button" onClick={() => { changeAdded(q.id, true); setAddOpen(false); setAddQuery(""); }}
                    className="w-full text-start rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                    {q.label}<span className="block text-xs text-muted-foreground">{p.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button type="button" onClick={() => setView("all")} className="text-[13px] text-primary font-medium hover:underline">{td("show_all", { count: allQs.length })}</button>
        </div>
      )}

      {hasSigns && drift && (
        <div className="rounded-xl border border-border/50 bg-background/40 p-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">{td("signs_point")}</p>
          <HumourBars pct={drift.percent} compact />
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- tab 2: Tashkhees

// ---------------------------------------------------------------- Tashkhees engine card

type EngPoints = Record<"safra" | "dam" | "balgham" | "sauda", number>;
interface EngTemperament {
  label: string | null; humour: string | null; percent: EngPoints; lead: number; confidence: "strong" | "moderate" | "weak"; evidence: { label: string; humour: string; points: number }[]; note?: string;
  conflict?: { leans: { source: "complaints" | "asbab" | "dalail" | "assessment"; humour: string }[] };
  cap?: "no_exam" | "no_core_exam";
  assessment?: { percent: EngPoints; date: string } | null;
}
interface EngSuggestion {
  sources: { key: string; label: string; percent: EngPoints | null; weight: number }[];
  mizajAsli: EngTemperament | null;
  suMizaj: (EngTemperament & { type: "Sada" | "Maddi"; maddiScore: number; maddiSigns: string[]; darja: number | null }) | null;
  organs: { label: string; reason: string; score: number }[];
  insufficient: string[];
}
const CONF_STYLE = {
  strong: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  moderate: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  weak: "border-border/60 text-muted-foreground",
} as const;

/**
 * The Tashkhees engine's suggestion for this visit: Mizaj-e-Asli from the
 * constitutional signs, Su-e-Mizaj (quality, Sada/Maddi, Darja) from all three
 * humoral readings, and the affected organs from the complaints, symptoms and
 * body regions — each with a confidence and the findings behind it. Nothing is
 * filled in until the Hakim accepts it.
 */
function EngineCard({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  const dl = useDateLocale();
  const [data, setData] = useState<{ suggestion: EngSuggestion; method: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const td = useTranslations("clinic.dossier");

  const fetchEngine = useCallback(() =>
    api.get<{ suggestion: EngSuggestion; method: string }>(`/api/facility/visits/${visitId}/tashkhees-engine`)
      .then((r) => { setData(r); setFailed(false); })
      .catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchEngine(); }, [fetchEngine]);

  // Re-run: save the examination & dossier first so the engine sees the latest answers.
  const rerun = async () => {
    setRunning(true);
    try { await state.save(false); await fetchEngine(); } finally { setRunning(false); }
  };
  const record = (accepted: "mizajAsli" | "suMizaj" | "organs" | "all") =>
    api.post(`/api/facility/visits/${visitId}/tashkhees-engine`, { accepted }).catch(() => {});

  const s = data?.suggestion;
  const local = (label: string | null) => (label ? (options?.mizaj || []).find((o) => o.label === label)?.localName : null);
  const asli = s?.mizajAsli;
  const su = s?.suMizaj;
  const asliApplied = !!asli?.label && d.mizajAsli === asli.label;
  const suApplied = !!su?.label && d.suMizajQuality === su.label && d.suMizajType === su.type && (su.darja == null || d.suMizajGrade === su.darja);
  const newOrgans = (s?.organs || []).filter((o) => !d.organs.includes(o.label));
  const applyAsli = () => { if (!asli?.label) return; set({ mizajAsli: asli.label }); record("mizajAsli"); };
  const applySu = () => { if (!su?.label) return; set({ suMizajQuality: su.label, suMizajType: su.type, suMizajGrade: su.darja }); record("suMizaj"); };
  const applyOrgans = () => { if (!newOrgans.length) return; set({ organs: [...d.organs, ...newOrgans.map((o) => o.label)] }); record("organs"); };
  const applyAll = () => {
    set({
      ...(asli?.label ? { mizajAsli: asli.label } : {}),
      ...(su?.label ? { suMizajQuality: su.label, suMizajType: su.type, suMizajGrade: su.darja } : {}),
      ...(newOrgans.length ? { organs: [...d.organs, ...newOrgans.map((o) => o.label)] } : {}),
    });
    record("all");
  };
  const canApplyAll = (!!asli?.label && !asliApplied) || (!!su?.label && !suApplied) || newOrgans.length > 0;

  const Conf = ({ c }: { c: "strong" | "moderate" | "weak" }) => (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", CONF_STYLE[c])}>{td(`conf_${c}`)}</span>
  );
  const Ev = ({ items }: { items: { label: string; humour: string }[] }) => items.length ? (
    <ul className="mt-1.5 space-y-0.5">
      {items.slice(0, 3).map((e, i) => {
        const h = AKHLAT.find((x) => x.key === e.humour);
        return <li key={i} className="text-xs text-muted-foreground">• {e.label}{h && <span className={cn("ms-1 font-medium", h.text)}>→ {h.label}</span>}</li>;
      })}
    </ul>
  ) : null;
  const humourName = (h: string) => AKHLAT.find((x) => x.key === h)?.label ?? h;
  // Why a suggestion is uncertain: conflicting readings, a capped confidence, the Mizaj assessment used.
  const Why = ({ t: m }: { t: EngTemperament }) => (
    <>
      {m.conflict && m.label && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{td("conflict_leans", { items: m.conflict.leans.map((l) => td("lean_item", { source: td(`src_${l.source}`), humour: humourName(l.humour) })).join(" · ") })}</p>}
      {m.cap && <p className="mt-1 text-xs text-muted-foreground">{td(`cap_${m.cap}`)}</p>}
      {m.assessment && <p className="mt-1 text-xs text-muted-foreground">{td("uses_assessment", { date: new Date(m.assessment.date).toLocaleDateString(dl) })}</p>}
    </>
  );
  const Apply = ({ applied, onClick, label = td("accept") }: { applied: boolean; onClick: () => void; label?: string }) => applied
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> {td("applied")}</span>
    : <Button size="sm" variant="outline" className="h-7" onClick={onClick}>{label}</Button>;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {td("engine")}</p>
        <span className="flex items-center gap-2">
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? td("rerunning") : td("rerun")}</button>
          {canApplyAll && <Button size="sm" className="h-7" onClick={applyAll}>{td("accept_all")}</Button>}
        </span>
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">{td.rich("engine_failed", { retry: (c) => <button type="button" onClick={() => fetchEngine()} className="text-primary font-medium hover:underline">{c}</button> })}</p>
      ) : !s ? <Loading /> : (
        <>
          {/* The three humoral readings and how much each counts */}
          <div className="grid sm:grid-cols-3 gap-2.5">
            {s.sources.map((r) => (
              <div key={r.key} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
                <p className="text-xs text-muted-foreground leading-snug">{r.label}</p>
                <p className="text-[11px] text-muted-foreground/80 mb-1.5">{r.percent ? td("counts", { w: r.weight }) : td("not_recorded")}</p>
                {r.percent && <HumourBars pct={r.percent} compact />}
              </div>
            ))}
          </div>

          {/* Suggestions */}
          <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-background/50">
            <div className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{td("asli_head")}</p>
                {asli?.label ? (
                  <>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{asli.label}</span>{local(asli.label) && <span className="text-xs text-muted-foreground">{local(asli.label)}</span>}<Conf c={asli.confidence} /></p>
                    {asli.note && <p className="mt-1 text-xs text-muted-foreground">{asli.note}</p>}
                    <Why t={asli} />
                    <Ev items={asli.evidence} />
                  </>
                ) : <p className="mt-0.5 text-sm text-muted-foreground">{s.insufficient.find((x) => x.includes("Mizaj-e-Asli")) || td("no_suggestion")}</p>}
              </div>
              {asli?.label && <Apply applied={asliApplied} onClick={applyAsli} />}
            </div>

            <div className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{td("su_head")}</p>
                {su?.label ? (
                  <>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{su.type} · {su.label}{su.darja ? ` · ${td("darja_n", { n: su.darja })}` : ""}</span>
                      {local(su.label) && <span className="text-xs text-muted-foreground">{local(su.label)}</span>}
                      <Conf c={su.confidence} />
                    </p>
                    {su.type === "Maddi" && su.maddiSigns.length > 0 && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{td("maddi_signs", { items: su.maddiSigns.slice(0, 3).join("; ") })}</p>
                    )}
                    {su.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{su.note}</p>}
                    <Why t={su} />
                    <Ev items={su.evidence} />
                  </>
                ) : su?.conflict ? (
                  <>
                    <p className="mt-0.5 text-base font-semibold text-amber-700 dark:text-amber-400">{td("undetermined")}</p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{td("conflict_leans", { items: su.conflict.leans.map((l) => td("lean_item", { source: td(`src_${l.source}`), humour: humourName(l.humour) })).join(" · ") })}</p>
                    {su.cap && <p className="mt-1 text-xs text-muted-foreground">{td(`cap_${su.cap}`)}</p>}
                  </>
                ) : <p className="mt-0.5 text-sm text-muted-foreground">{s.insufficient.find((x) => x.includes("Su-e-Mizaj")) || td("no_suggestion")}</p>}
              </div>
              {su?.label && <Apply applied={suApplied} onClick={applySu} />}
            </div>

            <div className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{td("organs_head")}</p>
                {s.organs.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {s.organs.map((o) => {
                      const desc = (options?.organ || []).find((x) => x.label === o.label)?.description;
                      return (
                        <span key={o.label} title={o.reason} className={cn("rounded-full border px-2.5 py-0.5 text-xs", d.organs.includes(o.label) ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-primary/30 bg-primary/5")}>
                          {o.label}{desc && <span className="text-muted-foreground"> · {desc}</span>}
                        </span>
                      );
                    })}
                  </div>
                ) : <p className="mt-0.5 text-sm text-muted-foreground">{s.insufficient.find((x) => x.includes("organ")) || td("no_suggestion")}</p>}
                {s.organs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{s.organs[0].reason}{s.organs.length > 1 ? td("hover_organ") : ""}</p>}
              </div>
              {s.organs.length > 0 && <Apply applied={newOrgans.length === 0} onClick={applyOrgans} label={td("add_n", { count: newOrgans.length })} />}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {td("engine_note", { ranked: data?.method === "ranked" ? td("organs_ranked") : "" })}
          </p>
        </>
      )}
    </div>
  );
}

function TashkheesTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  const mizaj = (options?.mizaj || []).map((o) => ({ label: o.label, sub: o.localName || o.description }));
  const td = useTranslations("clinic.dossier");
  return (
    <Panel icon={FileSignature} tour="dossier.diagnosis" title={td("tashkhees_title")}>
      <ReasoningPanel visitId={visitId} diagnoses={d.diagnoses} saveFirst={() => state.save(false)}
        onAdd={(x) => { if (!d.diagnoses.some((y) => y.label === x.label)) set({ diagnoses: [...d.diagnoses, x] }); }}
        onUseStatement={(text) => set({ diagnosisNote: text })} />
      <MarzSection visitId={visitId} d={d} set={set} amraz={state.amraz} rerun={() => state.save(false)} />
      <div className="border-t border-border/50" />
      <EngineCard state={state} visitId={visitId} />
      <div><Label required>{td("asli_label")}</Label>
        <Chips items={mizaj} selected={d.mizajAsli ? [d.mizajAsli] : []} onToggle={(l) => set({ mizajAsli: d.mizajAsli === l ? null : l })} /></div>
      <div className="space-y-3">
        <Label required>{td("su_label")}</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={d.suMizajType} options={SU_MIZAJ_TYPES.map((t) => ({ value: t.value, label: t.value }))} onChange={(v) => set({ suMizajType: v })} />
          <span className="text-[13px] text-muted-foreground">{d.suMizajType === "Sada" ? td("sada_desc") : d.suMizajType === "Maddi" ? td("maddi_desc") : td("su_default")}</span>
        </div>
        <Chips items={mizaj} selected={d.suMizajQuality ? [d.suMizajQuality] : []} onToggle={(l) => set({ suMizajQuality: d.suMizajQuality === l ? null : l })} />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{td("darja")}</span>
          <Segmented value={d.suMizajGrade} options={DARJA.map((n) => ({ value: n, label: `${n}` }))} onChange={(v) => set({ suMizajGrade: v })} />
        </div>
      </div>
      <div><Label>{td("organs_label")}</Label>
        <Chips items={(options?.organ || []).map((o) => ({ label: o.label, sub: o.description }))} selected={d.organs}
          onToggle={(l) => set({ organs: d.organs.includes(l) ? d.organs.filter((x) => x !== l) : [...d.organs, l] })} /></div>
      <FloatingTextarea id="tashkhees-statement" label={td("statement")} rows={3} value={d.diagnosisNote ?? ""} onChange={(e) => set({ diagnosisNote: e.target.value })}
        title={td("statement_eg")} />
    </Panel>
  );
}

// ---------------------------------------------------------------- tab 3: Usool

// ---------------------------------------------------------------- Usool-e-Ilaj engine card

interface UsoolPlanItem { label: string; localName: string | null; description: string | null; phase: number; reason: string; caution?: string }
interface UsoolPlanData {
  basis: { suMizaj: string | null; type: string | null; darja: number | null; organs: string[]; fromEngine: boolean };
  plan: UsoolPlanItem[]; cautions: UsoolPlanItem[]; insufficient: string[];
}

/**
 * Suggested treatment plan — principles in the classical order, from the
 * diagnosis and the visit's findings. Principles needing care (e.g.
 * evacuation with a weak pulse) are listed apart with the reason and are
 * never part of "Accept plan". The Hakim adds what fits.
 */
function UsoolEngineCard({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set } = state;
  const [data, setData] = useState<{ plan: UsoolPlanData; method: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const td = useTranslations("clinic.dossier");
  const fetchPlan = useCallback(() =>
    api.get<{ plan: UsoolPlanData; method: string }>(`/api/facility/visits/${visitId}/usool-engine`)
      .then((r) => { setData(r); setFailed(false); })
      .catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  const rerun = async () => { setRunning(true); try { await state.save(false); await fetchPlan(); } finally { setRunning(false); } };
  const record = (labels: string[]) => { if (labels.length) api.post(`/api/facility/visits/${visitId}/usool-engine`, { accepted: labels }).catch(() => {}); };
  const add = (labels: string[]) => {
    const fresh = labels.filter((l) => !d.usool.includes(l));
    if (!fresh.length) return;
    set({ usool: [...d.usool, ...fresh] });
    record(fresh);
  };

  const p = data?.plan;
  const missing = (p?.plan || []).filter((x) => !d.usool.includes(x.label)).map((x) => x.label);
  const b = p?.basis;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {td("plan_title")}</p>
        <span className="flex items-center gap-2">
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? td("rerunning") : td("rerun")}</button>
          {missing.length > 0 && <Button size="sm" className="h-7" onClick={() => add(missing)}>{td("accept_plan", { count: missing.length })}</Button>}
        </span>
      </div>
      {failed ? (
        <p className="text-sm text-muted-foreground">{td.rich("plan_failed", { retry: (c) => <button type="button" onClick={() => fetchPlan()} className="text-primary font-medium hover:underline">{c}</button> })}</p>
      ) : !p ? <Loading /> : (
        <>
          <p className="text-xs text-muted-foreground">
            {td("based_on")} {b?.suMizaj ? <span className="font-medium text-foreground">Su-e-Mizaj {[b.type, b.suMizaj, b.darja ? td("darja_n", { n: b.darja }) : null].filter(Boolean).join(" · ")}</span> : td("no_diagnosis")}
            {b && b.organs.length > 0 && <> · {td("organs_word")} <span className="font-medium text-foreground">{b.organs.join(", ")}</span></>}
            {b?.fromEngine && <span className="text-amber-700 dark:text-amber-400">{td("from_engine")}</span>}
          </p>
          {/* Still to add — one compact line each; ones already in the plan fold into a single line */}
          {p.plan.some((x) => !d.usool.includes(x.label)) && (
            <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-background/50">
              {p.plan.filter((x) => !d.usool.includes(x.label)).map((x) => (
                <li key={x.label} className="flex items-center gap-3 px-3 py-1.5" title={x.description ?? undefined}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]"><span className="font-semibold">{x.label}</span> <span className="text-[11px] text-muted-foreground">· {td("step", { n: x.phase, phase: x.phase >= 1 && x.phase <= 6 ? td(`phase_${x.phase}`) : "" })}</span></p>
                    <p className="truncate text-[11px] text-primary/90">{x.reason}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => add([x.label])}>{td("add")}</Button>
                </li>
              ))}
            </ul>
          )}
          {p.plan.some((x) => d.usool.includes(x.label)) && (
            <p className="flex items-start gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><Check className="h-3.5 w-3.5 mt-px shrink-0" /> {td("in_plan", { items: p.plan.filter((x) => d.usool.includes(x.label)).map((x) => x.label).join(", ") })}</p>
          )}
          {p.cautions.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> {td("caution")}</p>
              {p.cautions.map((x) => (
                <div key={x.label} className="flex items-start justify-between gap-3">
                  <p className="text-xs"><span className="font-semibold">{x.label}</span> <span className="text-muted-foreground">— {x.caution}</span></p>
                  {!d.usool.includes(x.label) && <button type="button" onClick={() => add([x.label])} className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline">{td("add_anyway")}</button>}
                </div>
              ))}
            </div>
          )}
          {p.insufficient.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
          <p className="text-[11px] text-muted-foreground">{td("guide_note", { ranked: data?.method === "ranked" ? td("ranked") : "" })}</p>
        </>
      )}
    </div>
  );
}

function UsoolTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  const td = useTranslations("clinic.dossier");
  const [q, setQ] = useState("");
  const all = options?.usool || [];
  const phaseOf = (label: string) => all.find((o) => o.label === label)?.phase ?? 6;
  const stepName = (n: number) => td("step", { n, phase: td(`phase_${n}`) });
  const add = (label: string) => { if (!d.usool.includes(label)) set({ usool: [...d.usool, label] }); };
  const remove = (label: string) => set({ usool: d.usool.filter((x) => x !== label) });
  // The chosen plan in classical order (Izala-e-Sabab first … symptomatic relief last).
  const chosen = [...d.usool].sort((a, b) => phaseOf(a) - phaseOf(b));
  const ql = q.trim().toLowerCase();
  const results = all
    .filter((o) => !d.usool.includes(o.label) && (!ql || `${o.label} ${o.localName ?? ""} ${o.description ?? ""} ${td(`phase_${o.phase ?? 6}`)}`.toLowerCase().includes(ql)))
    .sort((a, b) => (a.phase ?? 6) - (b.phase ?? 6) || a.label.localeCompare(b.label))
    .map((o) => ({ id: o.label, label: o.label, description: o.description, phase: o.phase ?? 6 }));
  return (
    <Panel icon={ClipboardCheck} tour="dossier.usool" title={td("usool_title")}>
      <UsoolEngineCard state={state} visitId={visitId} />

      {/* One search box to pick any number of principles; the chosen ones sit right under it */}
      <div className="space-y-2">
        <FloatingMultiSelect id="usoolPick" label={td("usool_add")} placeholder={td("usool_search")} openOnFocus keepOrder
          selected={[]} onRemove={() => {}}
          query={q} onQueryChange={setQ} results={results} onPick={add}
          describe={(o) => `${stepName(o.phase)}${o.description ? ` · ${o.description}` : ""}`} />
        {chosen.length === 0 ? <p className="text-[13px] text-muted-foreground">{td("usool_none")}</p> : (
          <div className="flex flex-wrap gap-1.5" aria-label={td("usool_yours")}>
            {chosen.map((l) => {
              const n = phaseOf(l);
              return (
                <button key={l} type="button" onClick={() => remove(l)} title={`${stepName(n)}${all.find((o) => o.label === l)?.description ? ` · ${all.find((o) => o.label === l)!.description}` : ""}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 ps-1 pe-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">{n}</span>
                  {l} <X className="h-3 w-3" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <FloatingTextarea id="usool-note" label={td("plan_note")} rows={2} value={d.usoolNote ?? ""} onChange={(e) => set({ usoolNote: e.target.value })}
        title={td("plan_note_eg")} />
    </Panel>
  );
}

// ---------------------------------------------------------------- tab 4: Ilaj trinity

function HerbPicker({ herbs, onPick }: { herbs: Herb[]; onPick: (h: { id: string | null; label: string; forms: string[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const td = useTranslations("clinic.dossier");
  const results = herbs.filter((h) => !q.trim() || h.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> {td("add_medicine")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={td("search_medicines")} className="h-9 mb-2" />
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {results.map((h) => (
            <button key={h.id} type="button" onClick={() => { onPick({ id: h.id, label: h.label, forms: h.forms }); setOpen(false); setQ(""); }}
              className="w-full text-start rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
              {h.label}{h.category && <span className="block text-[11px] text-muted-foreground">{h.category}</span>}
            </button>
          ))}
          {q.trim() && !herbs.some((h) => h.label.toLowerCase() === q.trim().toLowerCase()) && (
            <button type="button" onClick={() => { onPick({ id: null, label: q.trim(), forms: [] }); setOpen(false); setQ(""); }}
              className="w-full text-start rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 text-primary">{td("add_not_catalogue", { q: q.trim() })}</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------- Ilaj-bil-Ghiza engine card

/** A food photo (with its credit as a tooltip), or a neutral tile when there's none. */
/** Food photo: the small thumbnail first, the full photo if that fails, then a food icon — never a blank box. */
function FoodThumb({ src, alt, credit, className }: { src?: string | null; alt: string; credit?: string | null; className?: string }) {
  const thumb = foodThumb(src);
  const [stage, setStage] = useState<0 | 1 | 2>(0); // 0 thumbnail, 1 full photo, 2 icon
  const url = stage === 0 ? thumb : stage === 1 && src !== thumb ? src : null;
  return url
    ? <img src={url} alt={alt} title={credit || undefined} loading="lazy" decoding="async" width={64} height={64}
        onError={() => setStage((s) => (s === 0 && src && src !== thumb ? 1 : 2))}
        className={cn("shrink-0 rounded-lg object-cover bg-muted", className)} />
    : <span className={cn("shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground", className)}><Utensils className="h-4 w-4" /></span>;
}

interface GhizaPick { label: string; imageUrl: string | null; imageCredit: string | null; category: string | null; foodMizaj: string | null; reasons: string[]; hard?: boolean }
interface GhizaPlanData { basis: { suMizaj: string | null; fromEngine: boolean; conditions: string[]; allergies: string[] }; recommended: GhizaPick[]; avoid: GhizaPick[]; insufficient: string[] }

/**
 * Diet advice for this patient: foods that balance the present dyscrasia and
 * suit the recorded conditions and today's symptoms (Recommended), and foods
 * to avoid (Parhez) — allergy items always first. Each card shows why; the
 * Hakim adds what fits.
 */
/**
 * Ilaj-bil-Ghiza picker: one search box with two tabs (Recommended / Parhez). The dropdown shows
 * the foods suggested for this patient on the chosen tab — photo, temperament and why — and any
 * food when you type; every row can be sent either way. Chosen foods sit under the box, green for
 * Recommended and red for Parhez, so the full food list never fills the screen.
 */
function GhizaPicker({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  const [data, setData] = useState<{ plan: GhizaPlanData; method: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<"rec" | "avoid" | "all">("rec");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const td = useTranslations("clinic.dossier");
  const fetchPlan = useCallback(() =>
    api.get<{ plan: GhizaPlanData; method: string }>(`/api/facility/visits/${visitId}/ghiza-engine`)
      .then((r) => { setData(r); setFailed(false); })
      .catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  // Close the dropdown on a click outside the picker.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const rerun = async () => { setRunning(true); try { await state.save(false); await fetchPlan(); } finally { setRunning(false); } };
  const record = (labels: string[]) => { if (labels.length) api.post(`/api/facility/visits/${visitId}/ghiza-engine`, { accepted: labels }).catch(() => {}); };
  const p = data?.plan;
  const suggested = (where: "rec" | "avoid") => (where === "rec" ? p?.recommended : p?.avoid) || [];
  /** Puts a food on one side (taking it off the other); clicking the side it's already on removes it. */
  const setFood = (label: string, where: "rec" | "avoid") => {
    const was = where === "rec" ? d.ghizaRecommended.includes(label) : d.ghizaAvoid.includes(label);
    const rec = d.ghizaRecommended.filter((x) => x !== label);
    const avoid = d.ghizaAvoid.filter((x) => x !== label);
    if (!was) (where === "rec" ? rec : avoid).push(label);
    set({ ghizaRecommended: rec, ghizaAvoid: avoid });
    if (!was && suggested(where).some((x) => x.label === label)) record([label]);
  };
  const acceptAll = () => {
    const recAdd = suggested("rec").map((x) => x.label).filter((l) => !d.ghizaRecommended.includes(l) && !d.ghizaAvoid.includes(l));
    const avoidAdd = suggested("avoid").map((x) => x.label).filter((l) => !d.ghizaAvoid.includes(l));
    set({ ghizaRecommended: [...d.ghizaRecommended.filter((l) => !avoidAdd.includes(l)), ...recAdd], ghizaAvoid: [...d.ghizaAvoid, ...avoidAdd] });
    record([...recAdd, ...avoidAdd]);
  };
  const leftToAccept = suggested("rec").some((x) => !d.ghizaRecommended.includes(x.label)) || suggested("avoid").some((x) => !d.ghizaAvoid.includes(x.label));

  // Rows for the dropdown: the chosen tab's foods — Recommended / Parhez suggestions, or General (every food) — filtered by what's typed.
  const foods = options?.ghiza || [];
  const byLabel = (l: string) => foods.find((f) => f.label === l);
  const ql = q.trim().toLowerCase();
  type Row = { label: string; imageUrl: string | null; imageCredit: string | null; foodMizaj: string | null; category: string | null; reasons: string[]; hard?: boolean; kind: "rec" | "avoid" | null };
  const matches = (label: string) => { const f = byLabel(label); return !ql || `${label} ${f?.localName ?? ""} ${f?.description ?? ""} ${f?.category ?? ""}`.toLowerCase().includes(ql); };
  const rows: Row[] = tab !== "all"
    ? suggested(tab).filter((x) => matches(x.label)).map((x) => ({ ...x, kind: tab }))
    : foods.filter((f) => matches(f.label)).map((f): Row => {
      const sr = suggested("rec").find((x) => x.label === f.label), sa = suggested("avoid").find((x) => x.label === f.label);
      const hit = sa ?? sr;
      return hit ? { ...hit, kind: hit === sr ? "rec" : "avoid" } : { label: f.label, imageUrl: f.imageUrl ?? null, imageCredit: f.imageCredit ?? null, foodMizaj: f.foodMizaj ?? null, category: f.category ?? null, reasons: f.description ? [f.description] : [], kind: null };
    }).sort((a, b) => a.label.localeCompare(b.label));

  const Chosen = ({ where }: { where: "rec" | "avoid" }) => {
    const list = where === "rec" ? d.ghizaRecommended : d.ghizaAvoid;
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("w-full sm:w-auto sm:min-w-[9rem] text-[12px] font-semibold uppercase tracking-wide", where === "rec" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>
          {where === "rec" ? td("recommended") : td("parhez_avoid")} · {list.length}
        </span>
        {list.length === 0 ? <span className="text-[13px] text-muted-foreground">{td("none_yet")}</span> : list.map((l) => (
          <span key={l} className={cn("inline-flex items-center gap-1.5 rounded-full border ps-1 pe-1 py-0.5 text-[13px]",
            where === "rec" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "border-destructive/40 bg-destructive/10 text-destructive")}>
            <FoodThumb src={byLabel(l)?.imageUrl} alt={l} className="h-6 w-6 rounded-full" />
            {l}
            <button type="button" onClick={() => setFood(l, where)} aria-label={td("remove_x", { label: l })} className="rounded-full p-0.5 hover:bg-background/60"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          {failed ? td.rich("diet_failed", { retry: (c) => <button type="button" onClick={() => fetchPlan()} className="text-primary font-medium hover:underline">{c}</button> })
            : !p ? td("rerunning") : <>
              {td("based_on")} {p.basis.suMizaj ? <span className="font-medium text-foreground">{p.basis.suMizaj}</span> : td("no_su")}
              {p.basis.fromEngine && <span className="text-amber-700 dark:text-amber-400">{td("suggested")}</span>}
              {p.basis.conditions.length > 0 && <> · {td("history")} <span className="font-medium text-foreground">{p.basis.conditions.join(", ")}</span></>}
              {p.basis.allergies.length > 0 && <> · {td("allergies")} <span className="font-medium text-destructive">{p.basis.allergies.join(", ")}</span></>}
            </>}
        </p>
        <span className="flex items-center gap-2">
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? td("rerunning") : td("rerun")}</button>
          {p && leftToAccept && <Button size="sm" className="h-7" onClick={acceptAll}><Sparkles className="h-3.5 w-3.5" /> {td("accept_all")}</Button>}
        </span>
      </div>

      <div ref={boxRef} className="relative">
        {/* Two tabs over one search box */}
        <div className="mb-1.5 inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5" role="tablist">
          {(["rec", "avoid", "all"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(true); }}
              className={cn("rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
                tab === k ? (k === "rec" ? "bg-emerald-600 text-white" : k === "avoid" ? "bg-destructive text-white" : "bg-primary text-primary-foreground") : "text-muted-foreground hover:text-foreground")}>
              {k === "rec" ? td("recommended") : k === "avoid" ? td("parhez_avoid") : td("diet_general")}
              <span className="ms-1.5 text-[11px] opacity-80">{k === "all" ? foods.length : p ? suggested(k).length : ""}</span>
            </button>
          ))}
        </div>
        {/* Label follows the tab and floats onto the border when the box is focused or filled */}
        <FloatingField id="ghizaSearch" icon={Search} autoComplete="off" value={q} aria-expanded={open}
          label={tab === "rec" ? td("diet_search_rec", { count: suggested("rec").length }) : tab === "avoid" ? td("diet_search_avoid", { count: suggested("avoid").length }) : td("diet_search_all", { count: foods.length })}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
        {open && (
          <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[380px] overflow-y-auto rounded-xl border border-border/60 bg-popover shadow-xl divide-y divide-border/40">
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tab === "all" ? td("diet_general_hint") : td("diet_suggested_for")}</p>
            {rows.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">{ql ? td("no_food", { q }) : tab === "avoid" ? td("nothing_avoid") : td("no_recs")}</p>}
            {rows.map((x) => {
              const inRec = d.ghizaRecommended.includes(x.label), inAvoid = d.ghizaAvoid.includes(x.label);
              return (
                <div key={x.label} className={cn("flex items-center gap-3 px-3 py-2", x.hard && "bg-destructive/5")}>
                  <FoodThumb src={x.imageUrl} alt={x.label} credit={x.imageCredit} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{x.label}{x.foodMizaj && <span className="ms-1.5 text-[11px] font-normal text-muted-foreground">{x.foodMizaj}{x.category ? ` · ${x.category}` : ""}</span>}</p>
                    {x.reasons.length > 0 && <p className={cn("truncate text-xs", x.hard ? "font-medium text-destructive" : x.kind === "rec" ? "text-emerald-700 dark:text-emerald-400" : x.kind === "avoid" ? "text-destructive/90" : "text-muted-foreground")}>{x.reasons.slice(0, 2).join(" · ")}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {tab !== "all" ? (() => {
                      // Recommended / Parhez tabs: one Add button for that side.
                      const on = tab === "rec" ? inRec : inAvoid;
                      return (
                        <button type="button" onClick={() => setFood(x.label, tab)} aria-pressed={on}
                          className={cn("rounded-md border px-3 py-1 text-xs font-medium",
                            on ? (tab === "rec" ? "border-emerald-500/60 bg-emerald-600 text-white" : "border-destructive/60 bg-destructive text-white")
                              : tab === "rec" ? "border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10" : "border-destructive/50 text-destructive hover:bg-destructive/10")}>
                          {on ? <><Check className="me-0.5 inline h-3 w-3" />{td("added")}</> : td("add")}
                        </button>
                      );
                    })() : (
                      <>
                        <button type="button" onClick={() => setFood(x.label, "rec")} aria-pressed={inRec}
                          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", inRec ? "border-emerald-500/60 bg-emerald-600 text-white" : "border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10")}>
                          {inRec && <Check className="me-0.5 inline h-3 w-3" />}{td("recommend")}
                        </button>
                        <button type="button" onClick={() => setFood(x.label, "avoid")} aria-pressed={inAvoid}
                          className={cn("rounded-md border px-2.5 py-1 text-xs font-medium", inAvoid ? "border-destructive/60 bg-destructive text-white" : "border-destructive/50 text-destructive hover:bg-destructive/10")}>
                          {inAvoid && <Check className="me-0.5 inline h-3 w-3" />}{td("parhez")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* What's chosen — Recommended in green, Parhez in red */}
      <div className="space-y-1.5">
        <Chosen where="rec" />
        <Chosen where="avoid" />
      </div>
      {p?.insufficient.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
    </div>
  );
}

// ---------------------------------------------------------------- Clinical decision support

interface CdsNote { level: "high" | "caution" | "info"; text: string; verified: boolean }
interface CdsCand { tagId: string; label: string; unaniName: string | null; herbType: string | null; category: string; reasons: string[]; evidence: { traditional: boolean; clinical: boolean; verified: boolean }; safety: CdsNote[]; completeness: number; mizaj: string | null }
interface CdsData {
  enabled: boolean; sessionId?: string; method?: string; changed?: boolean;
  result?: {
    urgent: string[]; infoNeeded: string[]; unani: CdsCand[]; supplements: CdsCand[];
    excluded: { tagId: string; label: string; reason: string; verified: boolean }[];
    currentMeds: { label: string; matched: boolean }[];
    basis: { complaints: string[]; conditions: string[]; allergies: string[]; suMizaj: string | null; age: number | null; sex: string | null };
  };
  decisions?: { tagId: string; action: string; reason: string | null }[];
}
const NOTE_STYLE = { high: "text-destructive", caution: "text-amber-700 dark:text-amber-400", info: "text-muted-foreground" } as const;

/**
 * "Clinical Decision Support — Medicines & Supplements" (doctors only).
 * Candidates from the clinic's own database that may be worth evaluating,
 * after safety checks — each with why it was found, its evidence and
 * verification status and any precautions. Accepting is NOT prescribing:
 * adding to the prescription is a separate, deliberate step.
 */
function CdsPanel({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, herbs } = state;
  const [data, setData] = useState<CdsData | null>(null);
  const [tab, setTab] = useState<"unani" | "supplements" | "safety" | "info">("unani");
  const [running, setRunning] = useState(false);
  const [rejecting, setRejecting] = useState<{ tagId: string; reason: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const td = useTranslations("clinic.dossier");
  const tc = useTranslations("common");
  const vl = useValueLabel();
  const fetchCds = useCallback(() =>
    api.get<CdsData>(`/api/facility/visits/${visitId}/cds`)
      .then((r) => { setData(r); setFailed(false); })
      .catch((e: any) => { if (e?.status === 403 || /doctors only/i.test(e?.message || "")) setData({ enabled: false }); else setFailed(true); }), [visitId]);
  useEffect(() => { fetchCds(); }, [fetchCds]);
  if (!data && !failed) return null;
  if (data && !data.enabled) return null; // pilot off, or not a doctor
  const rerun = async () => { setRunning(true); try { await state.save(false); await fetchCds(); } finally { setRunning(false); } };

  const r = data?.result;
  const last = (tagId: string) => [...(data?.decisions || [])].reverse().find((x) => x.tagId === tagId);
  const act = async (c: CdsCand, action: string, reason?: string) => {
    if (!data?.sessionId) return;
    try {
      await api.post(`/api/facility/visits/${visitId}/cds`, { sessionId: data.sessionId, tagId: c.tagId, label: c.label, action, reason });
      setData((cur) => (cur ? { ...cur, decisions: [...(cur.decisions || []), { tagId: c.tagId, action, reason: reason ?? null }] } : cur));
    } catch { /* stays as it was */ }
  };
  const addToRx = (c: CdsCand) => {
    if (d.prescriptions.some((p) => p.tagId === c.tagId)) return;
    const forms = herbs.find((h) => h.id === c.tagId)?.forms || [];
    set({ prescriptions: [...d.prescriptions, { tagId: c.tagId, name: c.label, form: forms[0] ?? "", dose: "", timing: "", duration: "", adjuvant: "", instructions: "" }] });
    act(c, "added_to_prescription");
  };

  const renderCard = (c: CdsCand) => {
    const dec = last(c.tagId);
    const inRx = d.prescriptions.some((p) => p.tagId === c.tagId);
    return (
      <div className={cn("rounded-xl border p-3 space-y-2", dec?.action === "rejected" ? "border-border/40 bg-muted/30 opacity-70" : dec?.action === "accepted" || inRx ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/50 bg-background/50")}>
        <div className="space-y-1">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold leading-snug">{c.label}{c.unaniName && c.unaniName !== c.label && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{c.unaniName}</span>}</p>
            <p className="text-xs text-muted-foreground">{[c.herbType, c.mizaj].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {c.evidence.traditional && <Badge variant="outline" className="text-[10px]">{td("traditional")}</Badge>}
            {c.evidence.clinical && <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-400">{td("clinical")}</Badge>}
            <Badge variant="outline" className={cn("text-[10px]", c.evidence.verified ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400")}>{c.evidence.verified ? td("verified") : td("unverified")}</Badge>
          </div>
        </div>
        <ul className="space-y-0.5">{c.reasons.map((x) => <li key={x} className="text-xs text-foreground/85">• {x}</li>)}</ul>
        {c.safety.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-background/60 px-2 py-1.5">
            {c.safety.map((n, i) => (
              <li key={i} className={cn("text-xs flex gap-1.5", NOTE_STYLE[n.level])}>
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /><span>{n.text}{!n.verified && <span className="opacity-70">{td("unverified_paren")}</span>}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-muted-foreground me-auto">{td("profile_pct", { pct: c.completeness })}{dec ? ` · ${dec.action === "added_to_prescription" ? td("dec_rx") : dec.action === "accepted" ? td("dec_accepted") : dec.action === "considered" ? td("dec_considered") : dec.action === "rejected" ? td("dec_rejected") : dec.action}` : ""}</span>
          {rejecting?.tagId === c.tagId ? (
            <span className="flex items-center gap-1.5">
              <Input autoFocus value={rejecting.reason} onChange={(e) => setRejecting({ tagId: c.tagId, reason: e.target.value })} placeholder={td("reject_reason")} className="h-7 w-48 text-xs" />
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!rejecting.reason.trim()} onClick={() => { act(c, "rejected", rejecting.reason); setRejecting(null); }}>{td("reject")}</Button>
              <button type="button" className="text-xs text-muted-foreground" onClick={() => setRejecting(null)}>{tc("cancel")}</button>
            </span>
          ) : (
            <>
              {!dec && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(c, "considered")}>{td("considered")}</Button>}
              {dec?.action !== "accepted" && dec?.action !== "added_to_prescription" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(c, "accepted")}>{td("accept_eval")}</Button>}
              {dec?.action !== "rejected" && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setRejecting({ tagId: c.tagId, reason: "" })}>{td("reject_more")}</Button>}
              {(dec?.action === "accepted" || dec?.action === "added_to_prescription") && (
                inRx ? <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {td("in_rx")}</span>
                  : <Button size="sm" className="h-7 text-xs" onClick={() => addToRx(c)}><Plus className="h-3 w-3" /> {td("add_rx")}</Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const counts = { unani: r?.unani.length ?? 0, supplements: r?.supplements.length ?? 0, safety: (r?.excluded.length ?? 0), info: r?.infoNeeded.length ?? 0 };
  return (
    <Panel icon={ShieldAlert} tour="dossier.cds" title={td("cds_title")}
      aside={
        <span className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">{td("pilot")}</Badge>
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? td("rechecking") : td("recheck")}</button>
        </span>
      }>
      {failed || !r ? (
        failed ? <p className="text-sm text-muted-foreground">{td.rich("cds_failed", { retry: (c) => <button type="button" onClick={() => fetchCds()} className="text-primary font-medium hover:underline">{c}</button> })}</p> : <Loading />
      ) : (
        <>
          {r.urgent.map((u) => (
            <p key={u} className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{u}</p>
          ))}
          <p className="text-xs text-muted-foreground">
            {td("for_label")} <span className="font-medium text-foreground">{r.basis.complaints.join(", ") || td("no_complaints")}</span>
            {r.basis.suMizaj && <> · Su-e-Mizaj {r.basis.suMizaj}</>}
            {r.basis.conditions.length > 0 && <> · {td("history")} {r.basis.conditions.join(", ")}</>}
            {r.basis.allergies.length > 0 && <> · {td("allergies")} <span className="text-destructive">{r.basis.allergies.join(", ")}</span></>}
            {r.basis.age != null && <> · {td("yrs", { age: r.basis.age })}{r.basis.sex ? `, ${vl(r.basis.sex)}` : ""}</>}
            {data?.changed && <span className="text-primary">{td("updated_after")}</span>}
          </p>
          <div className="inline-flex flex-wrap rounded-lg border border-border/60 bg-background/40 p-0.5" role="tablist">
            {([["unani", td("tab_unani", { count: counts.unani })], ["supplements", td("tab_supp", { count: counts.supplements })], ["safety", td("tab_safety", { count: counts.safety })], ["info", td("tab_info", { count: counts.info })]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn("rounded-md px-3 py-1 text-[13px] font-medium transition-colors", tab === k ? (k === "safety" ? "bg-destructive text-white" : k === "info" ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground") : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>

          {tab === "unani" && (r.unani.length ? <div className="grid lg:grid-cols-2 gap-2.5">{r.unani.map((c) => <div key={c.tagId}>{renderCard(c)}</div>)}</div> : <p className="text-sm text-muted-foreground">{td("no_unani")}</p>)}
          {tab === "supplements" && (r.supplements.length ? <div className="grid lg:grid-cols-2 gap-2.5">{r.supplements.map((c) => <div key={c.tagId}>{renderCard(c)}</div>)}</div> : <p className="text-sm text-muted-foreground">{td("no_supp")}</p>)}
          {tab === "safety" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{td("current_meds")}</p>
                {r.currentMeds.length ? (
                  <div className="flex flex-wrap gap-1.5">{r.currentMeds.map((m) => <span key={m.label} className={cn("rounded-full border px-2.5 py-0.5 text-xs", m.matched ? "border-border/60" : "border-amber-500/50 text-amber-700 dark:text-amber-400")} title={m.matched ? td("med_matched") : td("med_unmatched")}>{m.label}{!m.matched && " ⚠"}</span>)}</div>
                ) : <p className="text-xs text-muted-foreground">{td("none_recorded")}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{td("excluded", { count: r.excluded.length })}</p>
                {r.excluded.length ? (
                  <ul className="space-y-1">{r.excluded.map((e) => (
                    <li key={e.tagId} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs"><span className="font-semibold">{e.label}</span> <span className="text-destructive">— {e.reason}</span>{!e.verified && <span className="text-muted-foreground">{td("unverified_paren")}</span>}</li>
                  ))}</ul>
                ) : <p className="text-xs text-muted-foreground">{td("nothing_excluded")}</p>}
              </div>
            </div>
          )}
          {tab === "info" && (r.infoNeeded.length ? <ul className="space-y-1.5">{r.infoNeeded.map((x) => <li key={x} className="flex gap-2 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />{x}</li>)}</ul> : <p className="text-sm text-muted-foreground">{td("nothing_missing")}</p>)}

          <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            {td("cds_note", { ranked: data?.method === "ranked" ? td("cds_ranked") : "" })}
          </p>
        </>
      )}
    </Panel>
  );
}

function IlajTab({ state, patientId, visitId }: { state: TashkheesState; patientId: string; visitId: string }) {
  const { dossier: d, set, options, herbs } = state;
  const [warnings, setWarnings] = useState<Record<string, Warn[]>>({});
  const [checkTick, setCheckTick] = useState(0);
  const tagKey = d.prescriptions.map((p) => p.tagId).filter(Boolean).join(",");
  const reqRef = useRef(0);
  const td = useTranslations("clinic.dossier");
  const { setSafety } = state;

  // Safety check whenever the set of catalogue medicines changes. A failed check is shown —
  // never mistaken for "no warnings" — and finalising waits until it has run.
  useEffect(() => {
    const ids = tagKey ? tagKey.split(",") : [];
    const n = ++reqRef.current;
    if (!ids.length) { queueMicrotask(() => { setWarnings({}); setSafety("idle"); }); return; }
    queueMicrotask(() => setSafety("checking"));
    api.post<{ warnings: Record<string, Warn[]> }>("/api/facility/tashkhees/prescription-check", { patientId, visitId, tagIds: ids })
      .then((r) => { if (n === reqRef.current) { setWarnings(r.warnings); setSafety("ok"); } })
      .catch(() => { if (n === reqRef.current) setSafety("failed"); });
  }, [tagKey, patientId, visitId, checkTick, setSafety]);

  const updRx = (i: number, patch: Partial<PrescriptionLine>) => set({ prescriptions: d.prescriptions.map((p, n) => (n === i ? { ...p, ...patch } : p)) });
  const updTd = (i: number, patch: Partial<TadbeerLine>) => set({ tadbeer: d.tadbeer.map((t, n) => (n === i ? { ...t, ...patch } : t)) });
  const forms = (options?.dosage_form || []).map((o) => o.label);
  const timings = (options?.timing || []).map((o) => o.label);

  return (
    <div className="space-y-5">
      {/* Ilaj-bil-Ghiza */}
      <Panel icon={Utensils} tour="dossier.ghiza" title={td("ghiza_title")}
        aside={<Badge variant="outline" className="mt-1 shrink-0">{td("advised_parhez", { rec: d.ghizaRecommended.length, avoid: d.ghizaAvoid.length })}</Badge>}>
        <GhizaPicker state={state} visitId={visitId} />
        <FloatingTextarea id="ghiza-note" label={td("meal_note")} rows={2} value={d.ghizaNote ?? ""} onChange={(e) => set({ ghizaNote: e.target.value })}
          title={td("meal_note_eg")} />
      </Panel>

      {/* Clinical decision support — doctors only, pilot switch in Admin */}
      <CdsPanel state={state} visitId={visitId} />

      {/* Ilaj-bil-Dawa */}
      <Panel icon={Pill} tour="dossier.dawa" title={td("dawa_title")}
        aside={<HerbPicker herbs={herbs} onPick={(h) => set({ prescriptions: [...d.prescriptions, { tagId: h.id, name: h.label, form: h.forms[0] ?? "", dose: "", timing: "", duration: "", adjuvant: "", instructions: "" }] })} />}>
        {state.safety === "failed" && (
          <InlineNotice tone="error" title={td("safety_failed")} detail={td("safety_failed_hint")}
            action={<Button size="sm" variant="outline" onClick={() => setCheckTick((n) => n + 1)}>{td("check_again")}</Button>} />
        )}
        {d.prescriptions.length === 0 ? <p className="text-sm text-muted-foreground">{td("no_meds")}</p> : (
          <div className="space-y-3">
            {d.prescriptions.map((p, i) => {
              const w = p.tagId ? warnings[p.tagId] || [] : [];
              const formOptions = [...new Set([...(herbs.find((h) => h.id === p.tagId)?.forms || []), ...forms])];
              return (
                <div key={i} className={cn("rounded-xl border p-3 space-y-2.5", w.some((x) => x.level === "high") ? "border-destructive/40 bg-card" : "border-border/50 bg-card")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold flex items-center gap-1.5"><Leaf className="h-4 w-4 text-primary" />{p.name}{!p.tagId && <Badge variant="outline" className="text-[11px] font-normal">{td("not_catalogue")}</Badge>}</p>
                    <button type="button" onClick={() => set({ prescriptions: d.prescriptions.filter((_, n) => n !== i) })} aria-label={td("remove_x", { label: p.name })} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {/* One line where there's room (six fields), otherwise three per row. */}
                  <div className="@container"><div className="grid grid-cols-2 @min-[28rem]:grid-cols-3 @min-[34rem]:grid-cols-[0.9fr_0.75fr_1.3fr_0.95fr_0.95fr_1.2fr] gap-x-2 gap-y-4 pt-2">
                    <FloatingSelect id={`rx-form-${i}`} label={td("form")} value={p.form || ""} onValueChange={(v) => updRx(i, { form: v })} placeholder={td("choose")}>
                      {sortLabels(formOptions).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </FloatingSelect>
                    <FloatingField id={`rx-dose-${i}`} label={td("dose")} value={p.dose} onChange={(e) => updRx(i, { dose: e.target.value })} title={td("dose_eg")} />
                    <FloatingSelect id={`rx-timing-${i}`} label={td("timing")} value={p.timing || ""} onValueChange={(v) => updRx(i, { timing: v })} placeholder={td("choose")}>
                      {timings.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </FloatingSelect>
                    <FloatingField id={`rx-duration-${i}`} label={td("duration")} value={p.duration} onChange={(e) => updRx(i, { duration: e.target.value })} title={td("duration_eg")} />
                    <FloatingField id={`rx-with-${i}`} label={td("badraqa")} value={p.adjuvant} onChange={(e) => updRx(i, { adjuvant: e.target.value })} title={td("badraqa_eg")} />
                    <FloatingField id={`rx-instr-${i}`} label={td("instructions")} maxLength={500} value={p.instructions} onChange={(e) => updRx(i, { instructions: e.target.value })} title={p.instructions || td("instructions")} />
                  </div></div>
                  {w.length > 0 && (
                    <div className="space-y-1">
                      {w.map((x, n) => (
                        <p key={n} className={cn("text-[13px] flex items-start gap-1.5", x.level === "high" ? "text-destructive" : x.level === "caution" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{x.text}{!x.verified && <span className="opacity-70">{td("ref_unverified")}</span>}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">{td("safety_note")}</p>
          </div>
        )}
      </Panel>

      {/* Ilaj-bil-Tadbeer */}
      <Panel icon={HeartPulse} tour="dossier.tadbeer" title={td("tadbeer_title")}
        aside={
          <Select value="" onValueChange={(v) => set({ tadbeer: [...d.tadbeer, { label: v, frequency: "", duration: "", notes: "" }] })}>
            <SelectTrigger className="h-9 w-48 bg-background/60"><SelectValue placeholder={td("add_regimen")} /></SelectTrigger>
            <SelectContent>{(options?.tadbeer || []).filter((o) => !d.tadbeer.some((t) => t.label === o.label)).map((o) => <SelectItem key={o.id} value={o.label}>{o.label}{o.description ? ` — ${o.description}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        }>
        {d.tadbeer.length === 0 ? <p className="text-sm text-muted-foreground">{td("no_regimens")}</p> : (
          <div className="space-y-2">
            {d.tadbeer.map((t, i) => (
              <div key={t.label} className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold">{t.label} <span className="text-[13px] font-normal text-muted-foreground">{options?.tadbeer?.find((o) => o.label === t.label)?.description}</span></p>
                  <button type="button" onClick={() => set({ tadbeer: d.tadbeer.filter((_, n) => n !== i) })} aria-label={td("remove_x", { label: t.label })} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 pt-2">
                  <FloatingField id={`td-freq-${i}`} label={td("frequency")} value={t.frequency} onChange={(e) => updTd(i, { frequency: e.target.value })} title={td("frequency_eg")} />
                  <FloatingField id={`td-dur-${i}`} label={td("duration")} value={t.duration} onChange={(e) => updTd(i, { duration: e.target.value })} title={td("sessions_eg")} />
                  <FloatingField id={`td-notes-${i}`} label={td("site_notes")} value={t.notes} onChange={(e) => updTd(i, { notes: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- tab 5: Prognosis & handover

function HandoverTab({ state }: { state: TashkheesState }) {
  const { dossier: d, set, options } = state;
  const td = useTranslations("clinic.dossier");
  const dl = useDateLocale();
  return (
    <Panel icon={CalendarDays} tour="dossier.handover" title={td("handover_title")}
      aside={d.status === "finalized" ? <Badge variant="outline" className="mt-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">{td("finalised")}</Badge> : undefined}>
      <div><Label>{td("prognosis")}</Label>
        <Chips items={(options?.prognosis || []).map((o) => ({ label: o.label, sub: o.description }))} selected={d.prognosis ? [d.prognosis] : []}
          onToggle={(l) => set({ prognosis: d.prognosis === l ? null : l })} /></div>
      <div className="grid sm:grid-cols-[220px_1fr] gap-3 pt-1">
        <div className="relative h-14 rounded-lg border border-input focus-within:border-primary flex items-center transition-colors">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 ms-3.5" />
          <input id="followup-date" type="date" value={d.followUpDate ?? ""} onChange={(e) => set({ followUpDate: e.target.value || null })}
            className="peer h-full flex-1 min-w-0 bg-transparent ps-2.5 pe-3 text-base font-medium outline-none" />
          {/* A date box always shows its dd/mm/yyyy mask, so the label sits on the border. */}
          <label htmlFor="followup-date" className="pointer-events-none absolute start-3 top-0 -translate-y-1/2 bg-card px-1.5 whitespace-nowrap text-sm font-semibold text-muted-foreground peer-focus:text-primary">{td("followup_date")}</label>
        </div>
        <FloatingField id="followup-note" label={td("followup_plan")} maxLength={500} value={d.followUpNote ?? ""} onChange={(e) => set({ followUpNote: e.target.value })}
          title={td("followup_eg")} />
      </div>
      <div><Label>{td("priority")}</Label>
        <Segmented value={d.priority} options={PRIORITIES.map((o) => ({ value: o.value, label: td(`pr_${o.value}`) }))} onChange={(v) => set({ priority: v ?? "routine" })} /></div>
      <FloatingTextarea id="urgent-directives" label={td("urgent_directives")} rows={2} value={d.urgentDirectives ?? ""} onChange={(e) => set({ urgentDirectives: e.target.value })}
        title={td("urgent_eg")} />
      <FloatingTextarea id="handover-note" label={td("handover_note")} rows={4} value={d.handoverNote ?? ""} onChange={(e) => set({ handoverNote: e.target.value })}
        title={td("handover_eg")} />
      {d.status === "finalized" && d.finalizedByName && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-emerald-500" /> {td("finalised_by", { name: d.finalizedByName })}{d.finalizedAt && ` · ${new Date(d.finalizedAt).toLocaleString(dl)}`}</p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- shell

function Loading() {
  const tc = useTranslations("common");
  return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}</div>;
}

const TABS = [
  { key: "dalail", label: "Dala'il", short: "Dala'il", sub: "Examination", icon: Stethoscope },
  { key: "tashkhees", label: "Tashkhees", short: "Tashkhees", sub: "Diagnosis", icon: FileSignature },
  { key: "usool", label: "Usool-e-Ilaj", short: "Usool", sub: "Principles", icon: ClipboardCheck },
  { key: "ilaj", label: "Ilaj", short: "Ilaj", sub: "Ghiza · Dawa · Tadbeer", short2: "Treatment", icon: Leaf },
  { key: "safety", label: "Safety", short: "Safety", sub: "Review", icon: ShieldCheck },
  { key: "handover", label: "Prognosis", short: "Prognosis", sub: "& Handover", short2: "Handover", icon: CalendarDays },
] as const;

/**
 * Centre of Stage 5: the Hakim's dossier — all five steps on one screen
 * (Dala'il, Tashkhees, Usool-e-Ilaj, Ilaj, Prognosis & Handover). The step
 * strip is a jump bar that highlights the step in view; once it scrolls away a
 * slim floating copy stays at the top.
 */
export function TashkheesDossierPanel({ state, patientId, visitId }: { state: TashkheesState; patientId: string; visitId: string }) {
  const d = state.dossier;
  const dl = useDateLocale();
  const td = useTranslations("clinic.dossier");
  // Unani step names stay as they are; their plain-language descriptions are translated.
  const tsf = useTranslations("clinic.safety");
  const tabLabel = (k: string, label: string) => (k === "handover" ? td("tab_prognosis") : k === "safety" ? tsf("tab") : label);
  const tabSub = (k: string) => (k === "safety" ? tsf("tab_sub") : td(`sub_${k}`));
  const tabShort2 = (k: string) => (k === "safety" ? tsf("tab_sub") : k === "ilaj" || k === "handover" ? td(`short2_${k}`) : td(`sub_${k}`));
  const done: Record<string, boolean> = {
    // Adaptive selection means not every question is shown — any recorded finding counts.
    dalail: state.dalail.progress.answered > 0,
    tashkhees: !!d.mizajAsli && !!d.suMizajQuality && d.diagnoses.some((x) => x.role === "working"),
    usool: d.usool.length > 0,
    ilaj: d.prescriptions.length + d.tadbeer.length + d.ghizaRecommended.length + d.ghizaAvoid.length > 0,
    safety: state.safetyBlocking === 0,
    handover: !!d.prognosis || !!d.handoverNote,
  };
  const doneCount = Object.values(done).filter(Boolean).length;
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const headerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState<string>("dalail");
  const [floatBox, setFloatBox] = useState<{ left: number; width: number } | null>(null);
  const ready = !!state.options;

  useEffect(() => {
    if (!ready) return;
    const update = () => {
      let current = TABS[0].key as string;
      for (const t of TABS) {
        const el = refs.current[t.key];
        if (el && el.getBoundingClientRect().top <= 160) current = t.key;
      }
      setInView(current);
      const h = headerRef.current;
      if (!h) return;
      const r = h.getBoundingClientRect();
      const panel = h.parentElement?.getBoundingClientRect();
      setFloatBox(r.bottom < 12 && !!panel && panel.bottom > 200 ? { left: r.left, width: r.width } : null);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [ready]);

  if (!state.options) {
    if (state.loadError) return <LoadFailed what={td("the_dossier")} detail={state.loadError} onRetry={state.reload} />;
    return <Card className="p-5 border-border/50 bg-card/60"><Loading /></Card>;
  }

  const jump = (key: string) => {
    const el = refs.current[key];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
  };
  const firstOpen = TABS.find((t) => !done[t.key]);

  return (
    <div className="space-y-5">
      {floatBox && (
        <div className="fixed top-3 z-20 flex items-center gap-1 rounded-xl border border-border/60 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur"
          style={{ left: floatBox.left, width: floatBox.width }} role="navigation" aria-label={td("jump")}>
          {TABS.map((t, i) => {
            const on = inView === t.key;
            return (
              <button key={t.key} type="button" onClick={() => jump(t.key)} title={`${i + 1}. ${tabLabel(t.key, t.label)} — ${tabSub(t.key)}`}
                className={cn("flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium transition-colors",
                  on ? "bg-primary text-primary-foreground" : done[t.key] ? "text-emerald-700 dark:text-emerald-400 hover:bg-muted" : "text-muted-foreground hover:bg-muted")}>
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate hidden sm:inline">{tabLabel(t.key, t.short)}</span>
                {done[t.key] && <Check className="h-3 w-3 shrink-0" />}
              </button>
            );
          })}
          <span className="hidden md:inline shrink-0 border-s border-border/60 ps-2 text-xs tabular-nums text-muted-foreground">{doneCount}/{TABS.length}</span>
        </div>
      )}

      <Card ref={headerRef} className="p-5 border-border/50 bg-card/60 gap-0">
        <SectionHeading
          icon={FileSignature}
          title={td("title")}
          right={
            <span className="flex items-center gap-1.5 shrink-0">
              {state.autoSavedAt && d.status === "draft" && <span className="hidden sm:inline text-[11px] text-muted-foreground">{td("autosaved", { time: state.autoSavedAt.toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" }) })}</span>}
              <Badge variant="outline">{td("n_steps", { n: doneCount, total: TABS.length })}</Badge>
              {d.status === "finalized"
                ? <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/40">{td("finalised")}{d.versions?.[0] ? ` · ${td("version_n", { n: d.versions[0].version })}` : ""}</Badge>
                : <Badge variant="outline">{td("draft")}</Badge>}
            </span>
          }
        />
        <div className="mt-3 mb-3 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / TABS.length) * 100}%` }} />
        </div>
        {/* Steps — one line; click jumps to the step. */}
        <div className="@container"><div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          {TABS.map((t, i) => {
            const on = inView === t.key;
            const ok = done[t.key];
            return (
              <button key={t.key} type="button" onClick={() => jump(t.key)} title={`${i + 1}. ${tabLabel(t.key, t.label)} — ${tabSub(t.key)}${ok ? td("recorded_suffix") : ""}`}
                className={cn("flex min-w-[7rem] @xl:min-w-0 flex-1 basis-0 items-center gap-1.5 @3xl:gap-2 rounded-xl border px-1.5 @3xl:px-2 py-1.5 text-start transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border/50 bg-background/40 hover:border-primary/40")}>
                <span className={cn("relative h-8 w-8 @3xl:h-9 @3xl:w-9 shrink-0 rounded-full border-2 flex items-center justify-center",
                  ok ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : on ? "border-primary text-primary" : "border-muted text-muted-foreground")}>
                  <t.icon className="h-4 w-4" />
                  {ok && <span className="absolute -end-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-card" aria-label={td("recorded")}><Check className="h-2 w-2" /></span>}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-xs @3xl:text-[13px] font-semibold leading-tight", on && "text-primary")}>{tabLabel(t.key, t.short)}</span>
                  <span className={cn("block truncate text-[11px] @3xl:text-xs leading-tight", ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{tabShort2(t.key)}</span>
                </span>
              </button>
            );
          })}
        </div></div>
        {/* Version history — every finalisation and amendment, newest first */}
        {!!d.versions?.length && (
          <ul className="mt-3 space-y-0.5 border-t border-border/40 pt-2.5">
            {d.versions.slice(0, 4).map((v) => {
              const when = new Date(v.createdAt).toLocaleString(dl, { dateStyle: "medium", timeStyle: "short" });
              return (
                <li key={v.version} className="text-xs text-muted-foreground">
                  {v.kind === "amended"
                    ? td("ver_amended", { n: v.version, by: v.byName || "—", when, reason: v.reason || "" })
                    : td("ver_finalized", { n: v.version, by: v.byName || "—", when })}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <section id="dalail" className="scroll-mt-20" ref={(el) => { refs.current.dalail = el; }}><DalailTab state={state} visitId={visitId} /></section>
      <section id="tashkhees" className="scroll-mt-20" ref={(el) => { refs.current.tashkhees = el; }}><TashkheesTab state={state} visitId={visitId} /></section>
      <section id="usool" className="scroll-mt-20" ref={(el) => { refs.current.usool = el; }}><UsoolTab state={state} visitId={visitId} /></section>
      <section id="ilaj" className="scroll-mt-20" ref={(el) => { refs.current.ilaj = el; }}><IlajTab state={state} patientId={patientId} visitId={visitId} /></section>
      <section id="safety" data-tour="dossier.safety" className="scroll-mt-20" ref={(el) => { refs.current.safety = el; }}>
        <SafetyReviewPanel visitId={visitId} refreshKey={`${d.revision ?? 0}|${d.prescriptions.map((p) => p.tagId).join(",")}`} onBlocking={state.setSafetyBlocking} />
      </section>
      <section id="handover" className="scroll-mt-20" ref={(el) => { refs.current.handover = el; }}><HandoverTab state={state} /></section>

      {/* Where to next */}
      <div className={cn("flex items-center justify-between gap-3 flex-wrap rounded-xl border px-4 py-3",
        firstOpen ? "border-dashed border-border/60 bg-card/40" : "border-emerald-500/40 bg-emerald-500/5")}>
        <p className="text-[13px] text-muted-foreground">
          {firstOpen
            ? td.rich("open_steps", { count: TABS.length - doneCount, next: tabLabel(firstOpen.key, firstOpen.label), b: (c) => <span className="font-medium text-foreground">{c}</span> })
            : <span className="font-medium text-emerald-700 dark:text-emerald-400">{td("all_recorded")}</span>}
        </p>
        {firstOpen && <Button size="sm" variant="outline" onClick={() => jump(firstOpen.key)}>{td("go_to", { label: tabLabel(firstOpen.key, firstOpen.label) })} <ArrowRight className="h-3.5 w-3.5" /></Button>}
      </div>
    </div>
  );
}
