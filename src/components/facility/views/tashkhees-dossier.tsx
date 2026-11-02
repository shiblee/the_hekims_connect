"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AKHLAT, isAnswered, questionVisible, type AsbabAnswer, type AsbabQuestionCfg, type HumourPoints } from "@/lib/asbab";
import { DARJA, PRIORITIES, SU_MIZAJ_TYPES, type PrescriptionLine, type TadbeerLine, type TashkheesOptionRow } from "@/lib/tashkhees";
import { useAsbabAssessment } from "@/components/facility/views/asbab-assessment";
import { Card } from "@/components/ui/card";
import { InlineNotice, LoadFailed, useNotice } from "@/components/shared/inline-notice";
import { FloatingCombobox } from "@/components/shared/combobox";
import { OptionDropdown, QuestionRow } from "@/components/shared/option-dropdown";
import { MedicineInfoButton } from "@/components/facility/views/medicine-info";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  ChevronsUpDown, Search, ShieldAlert, ShieldCheck, Sparkles, Stethoscope, Trash2, Utensils, X,
  Ban, Clock, Droplet, CircleCheck, ChevronDown, BarChart3,
} from "lucide-react";

// ---------------------------------------------------------------- state

interface Dossier {
  status: "draft" | "submitted" | "finalized"; submittedAt?: string | null; submittedByName?: string | null; returnNote?: string | null; prescriptionId?: string | null; finalizedAt: string | null; finalizedByName: string | null;
  mizajAsli: string | null; suMizajType: string | null; suMizajQuality: string | null; suMizajGrade: number | null;
  organs: string[]; diagnosisNote: string | null; usool: string[]; usoolNote: string | null;
  ghizaRecommended: string[]; ghizaAvoid: string[]; ghizaNote: string | null; ghizaRules: string[];
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
  organs: [], diagnosisNote: null, usool: [], usoolNote: null, ghizaRecommended: [], ghizaAvoid: [], ghizaNote: null, ghizaRules: [],
  tadbeer: [], prescriptions: [], diagnoses: [], sabab: [], icdCode: null, icdLabel: null, prognosis: null, followUpDate: null, followUpNote: null, urgentDirectives: null, priority: "routine", handoverNote: null,
};
interface Herb { id: string; label: string; kind: string; generic?: string | null; category: string | null; forms: string[] }
type Warn = { level: "high" | "caution" | "info"; text: string; verified: boolean };
/** Colour of a "safety notes" link: red if any is high, amber if any caution, otherwise plain information. */
const noteTone = (notes: { level: string }[]) => notes.some((x) => x.level === "high") ? "text-destructive" : notes.some((x) => x.level === "caution") ? "text-amber-700 dark:text-amber-400" : "text-primary";

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

/** A question's text in a question row. */
function Q({ children, required }: { children: ReactNode; required?: boolean }) {
  return <p className="pt-2.5 text-[15px] font-semibold leading-snug">{children}{required && <span className="text-destructive">&nbsp;*</span>}</p>;
}
/** A part of a question (e.g. Su-e-Mizaj → type, quality, degree). */
function Sub({ children }: { children: ReactNode }) {
  return <p className="ps-4 pt-2.5 text-sm text-muted-foreground">{children}</p>;
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

function HumourBars({ pct, compact, inline }: { pct: HumourPoints; compact?: boolean; inline?: boolean }) {
  // inline: the four humours side by side on one line (two per line on phones)
  if (inline) return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-4">
      {AKHLAT.map((h) => (
        <div key={h.key} className="grid min-w-0 grid-cols-[auto_minmax(1.5rem,1fr)_2.3rem] items-center gap-1.5 text-[13px]">
          <span className="text-muted-foreground">{h.label}</span>
          <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full", h.bar)} style={{ width: `${pct[h.key]}%` }} /></span>
          <span className="font-medium tabular-nums">{pct[h.key]}%</span>
        </div>
      ))}
    </div>
  );
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

/** Column widths shared by the Dala'il heading row and its sign rows: # · sign · why it's asked · finding. */
const DL_ROW = "grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 lg:grid-cols-[1.75rem_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1fr)]";
const DL_COLS = "md:grid-cols-[17rem_minmax(0,1fr)]"; // same Factor column width as step 4

/** One Dala'il sign as a table row — no box of its own. */
function DalailRow({ q, n, value, onChange, reason, tag, onRemove }: {
  q: AsbabQuestionCfg; n: number; value: AsbabAnswer | undefined; onChange: (v: AsbabAnswer) => void;
  /** Why this question was selected for the patient. */
  reason?: string;
  tag?: "new" | "added" | "safety" | "earlier";
  onRemove?: () => void;
}) {
  const td = useTranslations("clinic.dossier");
  const sel = Array.isArray(value) ? value : [];
  const answered = isAnswered(value);
  const why = reason || tag === "added" || tag === "earlier";
  return (
    <div className={cn(DL_ROW, "px-3 py-2")}>
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
        answered ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : q.required ? "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-400" : "bg-muted text-muted-foreground")}>{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">
          {q.label}{q.required && <span className="text-destructive">&nbsp;*</span>}
          {tag === "safety" && <span className="ms-1.5 align-middle rounded-full bg-destructive/10 border border-destructive/30 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-destructive">{td("safety")}</span>}
          {tag === "new" && <span className="ms-1.5 align-middle rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">{td("new")}</span>}
        </p>
        {q.labelLocal && <p className="text-xs leading-snug text-muted-foreground">{q.labelLocal}</p>}
      </div>
      <div className={cn("col-start-2 min-w-0 text-xs leading-snug lg:col-start-auto", !why && "hidden lg:block")}>
        {reason ? (
          <p className="flex items-start gap-1 text-primary/90"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" /><span>{reason}</span></p>
        ) : tag === "added" ? (
          <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">{td("added_by_you")}
            {onRemove && <button type="button" onClick={onRemove} className="text-primary hover:underline">{td("remove")}</button>}
          </p>
        ) : tag === "earlier" ? (
          <p className="text-muted-foreground">{td("earlier")}</p>
        ) : <span className="text-muted-foreground/60">—</span>}
      </div>
      <div className="col-start-2 min-w-0 lg:col-start-auto">
        {q.type === "text"
          ? <Input id={`dalail-${q.id}`} maxLength={500} placeholder={td("describe")} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className="h-9" />
          : <OptionDropdown compact id={`dalail-${q.id}`} options={q.options.map((o) => ({ label: o.label, description: o.description }))} value={sel}
              multiple={q.type === "multi_select"} onChange={onChange} />}
      </div>
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
  const refs = useRef<Record<string, HTMLElement | null>>({});
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
  const hasSigns = drift && AKHLAT.some((h) => drift.total[h.key] > 0);
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
  const shownQs = sections.flatMap(({ qs }) => qs);
  const shownN = shownQs.length;
  const answeredN = shownQs.filter((q) => isAnswered(answers[q.id])).length;
  const numberOf = new Map(shownQs.map((q, i) => [q.id, i + 1]));
  const aq = addQuery.trim().toLowerCase();
  const addable = allQs.filter(({ q }) => !visibleIds.has(q.id) && (!aq || q.label.toLowerCase().includes(aq) || q.options.some((o) => o.label.toLowerCase().includes(aq))));

  return (
    <Card data-tour="dossier.dalail" className="gap-0 overflow-hidden p-0 border-border/50 bg-card/60">
      <div className="space-y-2.5 px-5 pt-5 pb-3">
        <SectionHeading icon={Stethoscope} title={td("dalail_title")} right={
          <span className="flex shrink-0 flex-wrap items-center gap-2">
            {sel && !selError && (mode === "selected"
              ? <button type="button" onClick={() => setView("all")} className="text-[13px] font-medium text-primary hover:underline">{td("show_all", { count: allQs.length })}</button>
              : <button type="button" onClick={() => setView("selected")} className="text-[13px] font-medium text-primary hover:underline">{td("show_for_patient")}</button>)}
            <Badge variant="outline" className="tabular-nums">{td("n_recorded", { n: answeredN, total: shownN })}</Badge>
            {sel && !selError && (
              <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm"><Plus className="h-3.5 w-3.5" /> {td("add_question")}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-96 p-2" align="end">
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
            )}
          </span>
        } />

        {/* What the selection was based on — one line, no box */}
        {sel && !selError && mode === "selected" && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="me-1 flex items-center gap-1.5 text-[13px] font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" /> {td("selected_for")}:</span>
            {sel.context.complaints.map((c) => (
              <span key={c.label} className={cn("rounded-full border px-2.5 py-0.5", c.primary ? "border-primary/50 bg-primary/10 font-semibold text-primary" : "border-border/60 bg-background/50")}>{c.label}</span>
            ))}
            {sel.context.symptoms.map((x) => <span key={x} className="rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5">{x}</span>)}
            {sel.context.regions.map((x) => <span key={x} className="rounded-full border border-dashed border-border/70 px-2.5 py-0.5 text-muted-foreground">{x}</span>)}
            {sel.context.complaints.length + sel.context.symptoms.length + sel.context.regions.length === 0 && (
              <span className="text-muted-foreground">{td("no_context")}</span>
            )}
            <button type="button" onClick={() => load(true)} disabled={refreshing} className="ms-auto font-medium text-primary hover:underline disabled:opacity-50">
              {refreshing ? td("rechecking") : td("recheck")}
            </button>
          </div>
        )}
        {selError && (
          <p className="text-[13px] text-amber-700 dark:text-amber-400">
            {td.rich("sel_failed", { retry: (c) => <button type="button" onClick={() => load(false)} className="font-medium underline">{c}</button> })}
          </p>
        )}
      </div>

      {!sel && !selError ? <div className="px-5 pb-5"><Loading /></div> : (
        <>
          {/* Column headings */}
          <div className={cn("hidden border-y border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid", DL_COLS)}>
            <span className="px-3 py-2">{td("dl_col_group")}</span>
            <div className={cn(DL_ROW, "border-s border-border px-3 py-2")}>
              <span className="text-center">#</span><span>{td("dl_col_sign")}</span><span className="hidden lg:block">{td("dl_col_why")}</span><span className="hidden lg:block">{td("dl_col_finding")}</span>
            </div>
          </div>
          <div className="divide-y divide-border border-b border-border md:border-t-0">
            {sections.map(({ p, qs }) => {
              const a = qs.filter((q) => isAnswered(answers[q.id])).length;
              const done = a === qs.length;
              return (
                <section key={p.key} ref={(el) => { refs.current[p.key] = el; }} className={cn("grid", DL_COLS)}>
                  <div className="flex items-start justify-between gap-2 bg-muted/20 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="font-serif text-[15px] font-semibold leading-tight">{p.label}</p>
                      <p className="text-xs leading-snug text-muted-foreground">{p.english}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full border px-2 py-px text-[11px] font-medium tabular-nums",
                      done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border/60 text-muted-foreground")}>{done ? td("done") : `${a}/${qs.length}`}</span>
                  </div>
                  <div className="min-w-0 divide-y divide-border/60 md:border-s md:border-border">
                    {qs.map((q) => {
                      const tag = tagFor(q.id);
                      return (
                        <DalailRow key={q.id} q={q} n={numberOf.get(q.id) ?? 1} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)}
                          reason={mode === "selected" && sel?.questionIds.includes(q.id) ? sel.reasons[q.id]?.replace(/^Safety check · /, "") : undefined}
                          tag={tag} onRemove={tag === "added" ? () => changeAdded(q.id, false) : undefined} />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {/* What the answered signs point to — a footer row, no box */}
      {hasSigns && drift && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-2.5">
          <p className="w-full shrink-0 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground md:w-auto">{td("signs_point")}</p>
          <HumourBars pct={drift.percent} inline />
        </div>
      )}
    </Card>
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
/** Soft tints for the humour bars (the leading humour a shade stronger) — easier on the eye than solid colour. */
const HUMOUR_TINT: Record<string, { soft: string; strong: string }> = {
  safra: { soft: "bg-amber-400/15", strong: "bg-amber-400/35" },
  dam: { soft: "bg-red-500/10", strong: "bg-red-500/25" },
  balgham: { soft: "bg-sky-400/15", strong: "bg-sky-400/35" },
  sauda: { soft: "bg-violet-500/10", strong: "bg-violet-500/25" },
};
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
  const [why, setWhy] = useState<string | null>(null);
  const [readingsOpen, setReadingsOpen] = useState(false);
  const td = useTranslations("clinic.dossier");
  const mizaj = (options?.mizaj || []).map((o) => ({ label: o.label, description: [o.localName, o.description].filter(Boolean).join(" — ") || null }));

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

  const ok = (applied: boolean, onClick: () => void, label = td("accept")) => <Apply applied={applied} onClick={onClick} label={label} />;
  const muted = (text: string) => <span className="text-[13px] text-muted-foreground">{text}</span>;
  const insuff = (key: string) => <span className="text-xs leading-snug text-muted-foreground">{s?.insufficient.find((x) => x.includes(key)) || td("no_suggestion")}</span>;
  const asliWhy = asli?.label ? <>{asli.note && <p className="text-xs text-muted-foreground">{asli.note}</p>}<Why t={asli} /><Ev items={asli.evidence} /></> : null;
  const suWhy = su?.label ? <>
    {su.type === "Maddi" && su.maddiSigns.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{td("maddi_signs", { items: su.maddiSigns.slice(0, 3).join("; ") })}</p>}
    {su.note && <p className="text-xs text-amber-700 dark:text-amber-400">{su.note}</p>}
    <Why t={su} /><Ev items={su.evidence} />
  </> : su?.conflict ? <>
    <p className="text-xs text-amber-700 dark:text-amber-400">{td("conflict_leans", { items: su.conflict.leans.map((l) => td("lean_item", { source: td(`src_${l.source}`), humour: humourName(l.humour) })).join(" · ") })}</p>
    {su.cap && <p className="text-xs text-muted-foreground">{td(`cap_${su.cap}`)}</p>}
  </> : null;
  const organWhy = s?.organs.length ? <ul className="space-y-0.5">{s.organs.map((o) => <li key={o.label} className="text-xs text-muted-foreground">• <span className="font-medium text-foreground/80">{o.label}</span> — {o.reason}</li>)}</ul> : null;

  // Each finding: what the engine suggests (with Accept) beside the Hakim's own answer.
  const rows: { key: string; finding: ReactNode; engine: ReactNode; action?: ReactNode; why?: ReactNode; answer: ReactNode }[] = s ? [
    {
      key: "asli", finding: <Q required>{td("asli_label")}</Q>,
      engine: asli?.label ? <span className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-semibold">{asli.label}</span>{local(asli.label) && <span className="text-xs text-muted-foreground">{local(asli.label)}</span>}<Conf c={asli.confidence} /></span> : insuff("Mizaj-e-Asli"),
      action: asli?.label ? ok(asliApplied, applyAsli) : null, why: asliWhy,
      answer: <OptionDropdown compact id="mizajAsli" options={mizaj} value={d.mizajAsli ? [d.mizajAsli] : []} onChange={(v) => set({ mizajAsli: v[0] ?? null })} placeholder={td("choose_one")} />,
    },
    {
      key: "su_type", finding: <><Q required>{td("su_label")}</Q><Sub>{td("su_type")}</Sub></>,
      engine: su?.label ? <span className="text-sm font-semibold">{su.type}</span> : su?.conflict ? <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">{td("undetermined")}</span> : insuff("Su-e-Mizaj"),
      action: su?.label ? ok(d.suMizajType === su.type, () => { set({ suMizajType: su.type }); record("suMizaj"); }) : null, why: suWhy,
      answer: <OptionDropdown compact id="suMizajType" options={SU_MIZAJ_TYPES.map((t) => ({ label: t.value, description: td(t.value === "Sada" ? "sada_desc" : "maddi_desc") }))}
        value={d.suMizajType ? [d.suMizajType] : []} onChange={(v) => set({ suMizajType: (v[0] as typeof d.suMizajType) ?? null })} placeholder={td("su_default")} />,
    },
    {
      key: "su_quality", finding: <Sub>{td("su_quality")}</Sub>,
      engine: su?.label ? <span className="flex flex-wrap items-center gap-1.5"><span className="text-sm font-semibold">{su.label}</span>{local(su.label) && <span className="text-xs text-muted-foreground">{local(su.label)}</span>}<Conf c={su.confidence} /></span> : muted("—"),
      action: su?.label ? ok(d.suMizajQuality === su.label, () => { set({ suMizajQuality: su.label }); record("suMizaj"); }) : null,
      answer: <OptionDropdown compact id="suMizajQuality" options={mizaj} value={d.suMizajQuality ? [d.suMizajQuality] : []} onChange={(v) => set({ suMizajQuality: v[0] ?? null })} placeholder={td("choose_quality")} />,
    },
    {
      key: "darja", finding: <Sub>{td("darja")}</Sub>,
      engine: su?.label && su.darja ? <span className="text-sm font-semibold">{td("darja_n", { n: su.darja })}</span> : muted("—"),
      action: su?.label && su.darja ? ok(d.suMizajGrade === su.darja, () => { set({ suMizajGrade: su.darja }); record("suMizaj"); }) : null,
      answer: <Segmented value={d.suMizajGrade} options={DARJA.map((n) => ({ value: n, label: `${n}` }))} onChange={(v) => set({ suMizajGrade: v })} />,
    },
    {
      key: "organs", finding: <Q>{td("organs_label")}</Q>,
      engine: s.organs.length ? (
        <span className="flex flex-wrap gap-1">
          {s.organs.map((o) => (
            <span key={o.label} title={o.reason} className={cn("rounded-full border px-2 py-px text-xs", d.organs.includes(o.label) ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-primary/30 bg-primary/5")}>{o.label}</span>
          ))}
        </span>
      ) : insuff("organ"),
      action: s.organs.length ? ok(newOrgans.length === 0, applyOrgans, td("add_n", { count: newOrgans.length })) : null, why: organWhy,
      answer: <OptionDropdown compact id="organs" multiple options={(options?.organ || []).map((o) => ({ label: o.label, description: o.description }))} value={d.organs}
        onChange={(v) => set({ organs: v })} placeholder={td("choose_many")} />,
    },
  ] : [];
  const TK = "grid grid-cols-1 gap-x-4 gap-y-1.5 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,1fr)]";
  const HM = "grid grid-cols-[minmax(0,17rem)_3rem_minmax(0,1fr)_minmax(0,10rem)] items-center gap-x-3";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {td("engine")}</p>
        <span className="flex items-center gap-2">
          {s && <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => setReadingsOpen(true)}>
            <BarChart3 className="h-3.5 w-3.5" />{td("tk_readings_btn")}<span className="text-muted-foreground">· {s.sources.length}</span>
          </Button>}
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? td("rerunning") : td("rerun")}</button>
          {canApplyAll && <Button size="sm" className="h-7" onClick={applyAll}>{td("accept_all")}</Button>}
        </span>
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">{td.rich("engine_failed", { retry: (c) => <button type="button" onClick={() => fetchEngine()} className="text-primary font-medium hover:underline">{c}</button> })}</p>
      ) : !s ? <Loading /> : (
        <>
          {/* Finding · what the engine suggests (Accept) · the Hakim's Tashkhees */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className={cn(TK, "hidden border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid")}>
              <span>{td("tk_col_finding")}</span><span className="flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" />{td("tk_col_engine")}</span><span>{td("tk_col_yours")}</span>
            </div>
            <div className="divide-y divide-border/60">
              {rows.map((r) => (
                <div key={r.key} className="px-3 py-2">
                  <div className={cn(TK, "items-center")}>
                    <div className="min-w-0 [&>p]:pt-0">{r.finding}</div>
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-primary/[0.04] px-2 py-1.5">
                      <div className="min-w-0">{r.engine}</div>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.why && <button type="button" onClick={() => setWhy(why === r.key ? null : r.key)} aria-expanded={why === r.key} className="text-xs font-medium text-primary hover:underline">{why === r.key ? td("tk_hide") : td("tk_why")}</button>}
                        {r.action}
                      </span>
                    </div>
                    <div className="min-w-0">{r.answer}</div>
                  </div>
                  {why === r.key && r.why && <div className="mt-1.5 space-y-0.5 md:ms-[calc(17rem+1rem)]">{r.why}</div>}
                </div>
              ))}
            </div>
          </div>
                    {/* The humoral readings behind the engine, in a pop-up — one line each: reading · weight · one soft stacked bar · the leading humour */}
          <Dialog open={readingsOpen} onOpenChange={setReadingsOpen}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />{td("tk_readings_btn")}</DialogTitle>
                <p className="text-sm text-muted-foreground">{td("tk_readings_hint")}</p>
              </DialogHeader>
              <div className="overflow-hidden rounded-xl border border-border">
                <div className={cn(HM, "border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground")}>
                  <span>{td("tk_reading")}</span><span className="text-end">{td("tk_weight")}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 normal-case tracking-normal">
                    {AKHLAT.map((h) => <span key={h.key} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><span className={cn("h-2.5 w-2.5 rounded-sm", HUMOUR_TINT[h.key].strong)} />{h.label}</span>)}
                  </span>
                  <span>{td("tk_leading")}</span>
                </div>
                <div className="divide-y divide-border/60">
                  {s.sources.map((r) => {
                    const vals = AKHLAT.map((h) => ({ h, v: r.percent ? Math.round(r.percent[h.key] * 10) / 10 : 0 }));
                    const top = Math.max(...vals.map((x) => x.v));
                    const leads = top > 0 ? vals.filter((x) => x.v === top).map((x) => x.h) : [];
                    return (
                      <div key={r.key} className={cn(HM, "px-3 py-1.5 text-[13px]")}>
                        <span className="truncate" title={r.label}>{r.label}</span>
                        <span className="text-end text-xs tabular-nums text-muted-foreground">{r.percent ? `×${r.weight}` : "—"}</span>
                        {r.percent ? (
                          <span className="flex h-6 min-w-0 gap-0.5 overflow-hidden rounded-md" role="img"
                            aria-label={vals.map(({ h, v }) => `${h.label} ${v}%`).join(", ")}>
                            {vals.filter(({ v }) => v > 0).map(({ h, v }) => (
                              <span key={h.key} title={`${h.label} ${v}%`} style={{ width: `${v}%` }}
                                className={cn("flex min-w-0 items-center justify-center overflow-hidden text-[11px] font-semibold tabular-nums",
                                  h.text, v === top ? HUMOUR_TINT[h.key].strong : HUMOUR_TINT[h.key].soft)}>
                                {v >= 9 && <span className="truncate px-1">{v >= 18 ? `${h.label} ` : ""}{v}%</span>}
                              </span>
                            ))}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">{td("not_recorded")}</span>}
                        {leads.length ? (
                          <span className="text-[13px] font-semibold leading-tight" title={`${leads.map((h) => h.label).join(" = ")} · ${top}%`}>
                            {leads.map((h, i) => <span key={h.key} className={h.text}>{i > 0 && <span className="text-muted-foreground"> = </span>}{h.label}</span>)}
                            <span className="font-normal tabular-nums text-muted-foreground"> {top}%</span>
                          </span>
                        ) : <span className="text-muted-foreground/60">—</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function TashkheesTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set } = state;
  const td = useTranslations("clinic.dossier");
  return (
    <Panel icon={FileSignature} tour="dossier.diagnosis" title={td("tashkhees_title")}>
      <ReasoningPanel visitId={visitId} diagnoses={d.diagnoses} saveFirst={() => state.save(false)}
        onAdd={(x) => { if (!d.diagnoses.some((y) => y.label === x.label)) set({ diagnoses: [...d.diagnoses, x] }); }}
        onUseStatement={(text) => set({ diagnosisNote: text })} />
      <MarzSection visitId={visitId} d={d} set={set} amraz={state.amraz} rerun={() => state.save(false)} />
      <div className="border-t border-border/50" />
      <EngineCard state={state} visitId={visitId} />
      {/* The statement — one line */}
      <div className="flex items-center gap-3">
        <label htmlFor="tashkhees-statement" className="shrink-0 text-[15px] font-semibold">{td("statement")}</label>
        <Input id="tashkhees-statement" maxLength={500} value={d.diagnosisNote ?? ""} onChange={(e) => set({ diagnosisNote: e.target.value })}
          placeholder={td("statement_eg")} title={d.diagnosisNote || td("statement_eg")} className="h-10" />
      </div>
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
 * Usool-e-Ilaj picker — same pattern as the diet: one search box with two tabs. "Treatment plan"
 * lists the principles suggested for this patient (in classical order, with why; ones that need care
 * are marked with the reason) and "Other principles" every other approved principle. One Add per row;
 * the chosen plan sits under the box as numbered chips (the number is the classical step).
 */
function UsoolTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  const td = useTranslations("clinic.dossier");
  const [data, setData] = useState<{ plan: UsoolPlanData; method: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const fetchPlan = useCallback(() =>
    api.get<{ plan: UsoolPlanData; method: string }>(`/api/facility/visits/${visitId}/usool-engine`)
      .then((r) => { setData(r); setFailed(false); })
      .catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  const rerun = async () => { setRunning(true); try { await state.save(false); await fetchPlan(); } finally { setRunning(false); } };
  const record = (labels: string[]) => { if (labels.length) api.post(`/api/facility/visits/${visitId}/usool-engine`, { accepted: labels }).catch(() => {}); };

  const all = options?.usool || [];
  const p = data?.plan;
  const b = p?.basis;
  const planItems = [...(p?.plan || []), ...(p?.cautions || [])];
  const inPlan = new Set(planItems.map((x) => x.label));
  const phaseOf = (label: string) => planItems.find((x) => x.label === label)?.phase ?? all.find((o) => o.label === label)?.phase ?? 6;
  const stepName = (n: number) => td("step", { n, phase: n >= 1 && n <= 6 ? td(`phase_${n}`) : "" });
  const toggle = (label: string) => {
    if (d.usool.includes(label)) { set({ usool: d.usool.filter((x) => x !== label) }); return; }
    set({ usool: [...d.usool, label] });
    if (inPlan.has(label)) record([label]);
  };
  const missing = (p?.plan || []).filter((x) => !d.usool.includes(x.label)).map((x) => x.label);
  const acceptPlan = () => { if (!missing.length) return; set({ usool: [...d.usool, ...missing] }); record(missing); };

  type Row = { label: string; description: string | null; phase: number; reason: string | null; caution?: string };
  const ql = q.trim().toLowerCase();
  const match = (r: Row) => !ql || `${r.label} ${r.description ?? ""} ${td(`phase_${r.phase >= 1 && r.phase <= 6 ? r.phase : 6}`)}`.toLowerCase().includes(ql);
  const planRows: Row[] = planItems.map((x) => ({ label: x.label, description: x.description, phase: x.phase, reason: x.reason, caution: x.caution }));
  const otherRows: Row[] = all.filter((o) => !inPlan.has(o.label)).map((o) => ({ label: o.label, description: o.description, phase: o.phase ?? 6, reason: null }))
    .sort((a, b2) => a.phase - b2.phase || a.label.localeCompare(b2.label));
  const groups = [
    { key: "plan", title: td("usool_tab_plan"), rows: planRows.filter(match), total: planRows.length },
    { key: "other", title: td("usool_tab_other"), rows: otherRows.filter(match), total: otherRows.length },
  ];
  const chosen = [...d.usool].sort((a, b2) => phaseOf(a) - phaseOf(b2)).map((label) => {
    const fromPlan = planItems.find((x) => x.label === label);
    return { label, phase: phaseOf(label), description: fromPlan?.description ?? all.find((o) => o.label === label)?.description ?? null, reason: fromPlan?.reason ?? null, caution: fromPlan?.caution };
  });
  const US = "grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1.2fr)_2rem] items-center gap-x-3";

  // The one "Add principles" dropdown: the suggested treatment plan first, then every other principle.
  const picker = (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
          <Plus className="h-4 w-4" /> {td("usool_add")}<ChevronDown className="h-3.5 w-3.5 opacity-80" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(34rem,calc(100vw-2rem))] p-1.5">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={td("usool_search")} className="mb-1.5 h-9 text-sm" />
        <div className="max-h-[26rem] overflow-y-auto">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="sticky top-0 z-10 flex items-center justify-between bg-popover px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className={cn(g.key === "plan" && "text-primary")}>{g.key === "plan" && <Sparkles className="me-1 inline h-3 w-3" />}{g.title}</span>
                <span className="tabular-nums">{g.key === "plan" && !p ? "…" : g.total}</span>
              </p>
              {g.rows.length === 0 && <p className="px-2.5 py-1.5 text-xs text-muted-foreground">{ql ? td("no_food", { q }) : td("no_suggestion")}</p>}
              {g.rows.map((r) => {
                const on = d.usool.includes(r.label);
                return (
                  <div key={r.label} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-muted/50", r.caution && "bg-amber-500/5")}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary" title={stepName(r.phase)}>{r.phase}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{r.label} <span className="text-[11px] font-normal text-muted-foreground">· {stepName(r.phase)}</span></p>
                      {r.caution ? <p className="truncate text-xs font-medium text-amber-700 dark:text-amber-400" title={r.caution}>{r.caution}</p>
                        : r.reason ? <p className="truncate text-xs text-emerald-700 dark:text-emerald-400" title={r.reason}>{r.reason}</p>
                        : r.description && <p className="truncate text-xs text-muted-foreground" title={r.description}>{r.description}</p>}
                    </div>
                    <button type="button" onClick={() => toggle(r.label)} aria-pressed={on}
                      className={cn("shrink-0 rounded-md border px-2.5 py-0.5 text-xs font-medium",
                        on ? "border-emerald-500/60 bg-emerald-600 text-white" : r.caution ? "border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10" : "border-primary/40 text-primary hover:bg-primary/10")}>
                      {on ? <><Check className="me-0.5 inline h-3 w-3" />{td("added")}</> : r.caution ? td("add_anyway") : td("add")}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <Panel icon={ClipboardCheck} tour="dossier.usool" title={td("usool_title")} aside={
      <span className="flex items-center gap-2">
        <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? td("rerunning") : td("rerun")}</button>
        {missing.length > 0 && <Button size="sm" variant="outline" className="h-8 border-primary/40 text-primary hover:bg-primary/10" onClick={acceptPlan}><Sparkles className="h-3.5 w-3.5" /> {td("accept_plan", { count: missing.length })}</Button>}
        {picker}
      </span>
    }>
      <p className="-mt-2 text-xs text-muted-foreground">
        {failed ? td.rich("plan_failed", { retry: (c) => <button type="button" onClick={() => fetchPlan()} className="text-primary font-medium hover:underline">{c}</button> })
          : !p ? td("rerunning") : <>
            {td("based_on")} {b?.suMizaj ? <span className="font-medium text-foreground">Su-e-Mizaj {[b.type, b.suMizaj, b.darja ? td("darja_n", { n: b.darja }) : null].filter(Boolean).join(" · ")}</span> : td("no_diagnosis")}
            {b && b.organs.length > 0 && <> · {td("organs_word")} <span className="font-medium text-foreground">{b.organs.join(", ")}</span></>}
            {b?.fromEngine && <span className="text-amber-700 dark:text-amber-400">{td("from_engine")}</span>}
          </>}
      </p>

      {/* The chosen plan, in classical order: step · principle · why · remove */}
      {chosen.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">{td("usool_none")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border" aria-label={td("usool_yours")}>
          <div className={cn(US, "border-b border-border bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground")}>
            <span>{td("us_col_step")}</span><span>{td("us_col_principle")}</span><span>{td("us_col_why")}</span><span />
          </div>
          <ul className="divide-y divide-border">
            {chosen.map((c) => (
              <li key={c.label} className={cn(US, "px-3 py-2", c.caution && "bg-amber-500/5")}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white">{c.phase}</span>
                  <span className="truncate text-xs text-muted-foreground" title={stepName(c.phase)}>{c.phase >= 1 && c.phase <= 6 ? td(`phase_${c.phase}`) : ""}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{c.label}</p>
                  {c.description && <p className="truncate text-xs text-muted-foreground" title={c.description}>{c.description}</p>}
                </div>
                <p className="min-w-0 text-xs">
                  {c.caution ? <span className="font-medium text-amber-700 dark:text-amber-400">{c.caution}</span>
                    : c.reason ? <span className="text-emerald-700 dark:text-emerald-400">{c.reason}</span>
                    : <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-px font-medium text-amber-700 dark:text-amber-400">{td("us_mine")}</span>}
                </p>
                <button type="button" onClick={() => toggle(c.label)} aria-label={`${td("remove")} ${c.label}`} title={`${td("remove")} ${c.label}`}
                  className="justify-self-end rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {p?.insufficient.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}

      {/* The plan note — one line */}
      <div className="flex items-center gap-3">
        <label htmlFor="usool-note" className="shrink-0 text-[15px] font-semibold">{td("plan_note")}</label>
        <Input id="usool-note" value={d.usoolNote ?? ""} onChange={(e) => set({ usoolNote: e.target.value })}
          placeholder={td("plan_note_eg")} title={d.usoolNote || td("plan_note_eg")} className="h-10" />
      </div>
    </Panel>
  );
}

function HerbPicker({ herbs, onPick }: { herbs: Herb[]; onPick: (h: { id: string | null; label: string; forms: string[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"unani" | "allo">("unani");
  const td = useTranslations("clinic.dossier");
  const ql = q.trim().toLowerCase();
  const results = herbs
    .filter((h) => (tab === "allo") === (h.kind === "medication"))
    .filter((h) => !ql || `${h.label} ${h.generic ?? ""}`.toLowerCase().includes(ql)).slice(0, 60);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> {td("add_medicine")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-2" align="end">
        <div className="mb-2 grid grid-cols-2 rounded-lg border border-border/60 bg-background/40 p-0.5" role="tablist">
          {(["unani", "allo"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn("rounded-md px-2 py-1 text-[13px] font-medium transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {k === "unani" ? td("picker_unani") : td("picker_allo")}
            </button>
          ))}
        </div>
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "unani" ? td("search_medicines") : td("search_allo")} className="h-9 mb-2" />
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {results.map((h) => (
            <button key={h.id} type="button" onClick={() => { onPick({ id: h.id, label: h.label, forms: h.forms }); setOpen(false); setQ(""); }}
              className="w-full text-start rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
              {h.label}{h.generic && h.generic.toLowerCase() !== h.label.toLowerCase() && <span className="ms-1.5 text-xs text-muted-foreground">{h.generic}</span>}
              {h.category && <span className="block text-[11px] text-muted-foreground">{h.category}</span>}
            </button>
          ))}
          {q.trim() && !herbs.some((h) => h.label.toLowerCase() === ql) && (
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

/** "Barid-Ratab 2" → "Barid-Ratab · D2" (compact temperament tag). */
const mizajTag = (m: string) => { const d = m.match(/[1-4]/)?.[0]; return d ? `${m.replace(/\s*[1-4]\s*/, "").trim()} · D${d}` : m; };
/**
 * "+ Add food" / "+ Add to Parhez": one list — this patient's suggestions for that side first
 * (with why), then every other food (General), filtered by what's typed.
 */
function FoodAddPicker({ where, label, suggested, foods, rec, avoid, onPick }: {
  where: "rec" | "avoid"; label: string; suggested: GhizaPick[]; foods: TashkheesOptionRow[]; rec: string[]; avoid: string[]; onPick: (label: string) => void;
}) {
  const td = useTranslations("clinic.dossier");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const byLabel = (l: string) => foods.find((f) => f.label === l);
  const hit = (l: string) => { const f = byLabel(l); return !ql || `${l} ${f?.localName ?? ""} ${f?.description ?? ""} ${f?.category ?? ""}`.toLowerCase().includes(ql); };
  const mine = where === "rec" ? rec : avoid, other = where === "rec" ? avoid : rec;
  const sugg = suggested.filter((x) => hit(x.label));
  const sLabels = new Set(suggested.map((x) => x.label));
  const general = foods.filter((f) => !sLabels.has(f.label) && hit(f.label)).sort((a, b) => a.label.localeCompare(b.label));
  const green = where === "rec";
  const row = (l: string, mizaj: string | null, why: string | undefined, img: string | null | undefined, credit: string | null | undefined, hard?: boolean) => {
    const on = mine.includes(l), elsewhere = other.includes(l);
    return (
      <button key={l} type="button" disabled={on} onClick={() => { onPick(l); setQ(""); }}
        className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start", on ? "cursor-default opacity-60" : green ? "hover:bg-emerald-500/10" : "hover:bg-destructive/10", hard && "bg-destructive/5")}>
        <FoodThumb src={img} alt={l} credit={credit} className="h-8 w-8" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug">{l}{mizaj && <span className="ms-1.5 text-[11px] font-normal text-muted-foreground">{mizajTag(mizaj)}</span>}</span>
          {why && <span className={cn("block truncate text-xs", hard ? "font-medium text-destructive" : green ? "text-emerald-700 dark:text-emerald-400" : "text-destructive/90")}>{why}</span>}
        </span>
        {on ? <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />{td("added")}</span>
          : elsewhere ? <span className="shrink-0 text-[11px] text-muted-foreground">{green ? td("parhez") : td("recommend")}</span> : <Plus className={cn("h-4 w-4 shrink-0", green ? "text-emerald-600" : "text-destructive")} />}
      </button>
    );
  };
  const head = (t: string, tone: string) => <p className={cn("sticky top-0 z-[1] bg-popover px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide", tone)}>{t}</p>;
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed px-2 py-1.5 text-xs font-medium", green ? "border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400" : "border-destructive/40 text-destructive hover:bg-destructive/10")}><Plus className="h-3 w-3" />{label}</button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(30rem,calc(100vw-2rem))] p-2">
        <div className="relative mb-1">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={td("diet_search_all", { count: foods.length })} className="h-9 ps-8" />
        </div>
        <div className="max-h-[24rem] overflow-y-auto">
          {sugg.length > 0 && head(`${green ? td("recommended") : td("parhez_avoid")} · ${td("g_suggested_n", { count: sugg.length })}`, green ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}
          {sugg.map((x) => row(x.label, x.foodMizaj, x.reasons.slice(0, 2).join(" · "), x.imageUrl, x.imageCredit, x.hard))}
          {general.length > 0 && <div className={cn(sugg.length > 0 && "mt-1 border-t border-border")}>{head(`${td("diet_general")} · ${general.length}`, "text-muted-foreground")}</div>}
          {general.map((f) => row(f.label, f.foodMizaj ?? null, (green ? f.action : f.harm) ?? f.description ?? undefined, f.imageUrl, f.imageCredit))}
          {!sugg.length && !general.length && <p className="px-2 py-3 text-sm text-muted-foreground">{td("no_food", { q })}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** A diet list sized to its first five rows, however tall each is; the rest scroll inside it. It grows when its box stretches to match the next column. */
function FiveRowList({ count, children }: { count?: number; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const fifth = el.children.length > 5 ? el.children[4] as HTMLElement : null;
    el.style.height = fifth ? `${fifth.offsetTop + fifth.offsetHeight}px` : "";
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [measure]);
  // A food just added goes to the end of the list: bring it into view (not when the saved list first loads).
  const lastCount = useRef(count);
  useEffect(() => {
    if (count && lastCount.current && count > lastCount.current) ref.current?.scrollTo({ top: ref.current.scrollHeight });
    lastCount.current = count;
  }, [count]);
  return <ul ref={ref} className="relative min-h-0 grow space-y-1.5 overflow-y-auto">{children}</ul>;
}

/** One of the three diet columns. */
function DietColumn({ tone, icon: Icon, title, count, add, children }: { tone: "rec" | "avoid"; icon: typeof Ban; title: string; count: number; add: ReactNode; children: ReactNode }) {
  return (
    <section className={cn("flex flex-col rounded-xl border p-3", tone === "rec" ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-destructive/25 bg-destructive/[0.04]")}>
      <header className="mb-2">
        <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide", tone === "rec" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}><Icon className="h-4 w-4 shrink-0" />{title}<span className="ms-auto rounded-full bg-background/80 px-1.5 text-[11px] tabular-nums">{count}</span></p>
      </header>
      <FiveRowList count={count}>{children}</FiveRowList>
      <div className="mt-2">{add}</div>
    </section>
  );
}

const RULE_ICON: Record<string, typeof Ban> = { timing: Clock, hydration: Droplet, habit: Utensils };
function RuleRow({ r, on, hint, onToggle }: { r: TashkheesOptionRow; on: boolean; hint?: boolean; onToggle: () => void }) {
  const Icon = RULE_ICON[r.category ?? ""] ?? Clock;
  return (
    <li>
      <button type="button" onClick={onToggle} aria-pressed={on} title={r.description ?? undefined}
        className={cn("flex w-full items-start gap-2 rounded-lg border p-2 text-start transition-colors", on ? "border-amber-500/40 bg-background/80" : "border-dashed border-border/70 hover:border-amber-500/40 hover:bg-background/60")}>
        <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-amber-500 bg-amber-500 text-white" : "border-input")}>{on && <Check className="h-3 w-3" />}</span>
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", on ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
        <span className="min-w-0">
          <span className={cn("block text-[13px] leading-snug", on ? "font-semibold" : "text-foreground/90")}>{r.label}{hint && <Sparkles className="ms-1 inline h-3 w-3 text-primary" />}</span>
          {on && r.description && <span className="block text-[11px] text-muted-foreground">{r.description}</span>}
        </span>
      </button>
    </li>
  );
}

/** Third column: meal-timing & hydration rules (admin list), suggested ones first, plus a free note. */
function MealRulesColumn({ state, basis }: { state: TashkheesState; basis: { suMizaj: string | null; conditions: string[] } | null }) {
  const { dossier: d, set, options } = state;
  const td = useTranslations("clinic.dossier");
  const [more, setMore] = useState(false);
  const rules = options?.ghiza_rule || [];
  const su = d.suMizajQuality ?? basis?.suMizaj ?? null;
  const fits = (r: TashkheesOptionRow) => !!r.suits && (!!r.suits.always || (!!su && !!r.suits.mizaj?.includes(su)) || !!r.suits.conditions?.some((c) => basis?.conditions.includes(c)));
  const chosen = rules.filter((r) => d.ghizaRules.includes(r.label));
  const suggested = rules.filter((r) => !d.ghizaRules.includes(r.label) && fits(r));
  const rest = rules.filter((r) => !d.ghizaRules.includes(r.label) && !fits(r));
  const toggle = (l: string) => set({ ghizaRules: d.ghizaRules.includes(l) ? d.ghizaRules.filter((x) => x !== l) : [...d.ghizaRules, l] });
  return (
    <section className="flex flex-col rounded-xl border border-amber-500/25 bg-amber-500/[0.04] p-3 @2xl:col-span-2 @5xl:col-span-1">
      <header className="mb-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400"><Clock className="h-4 w-4 shrink-0" />{td("g_timing")}<span className="ms-auto rounded-full bg-background/80 px-1.5 text-[11px] tabular-nums">{chosen.length}</span></p>
      </header>
      <FiveRowList>
        {chosen.map((r) => <RuleRow key={r.id} r={r} on onToggle={() => toggle(r.label)} />)}
        {suggested.length > 0 && <li className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-primary">{td("g_rules_suggested")}</li>}
        {suggested.map((r) => <RuleRow key={r.id} r={r} on={false} hint onToggle={() => toggle(r.label)} />)}
        {rest.length > 0 && (
          <li><button type="button" onClick={() => setMore((v) => !v)} className="flex items-center gap-1 px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">{td("g_rules_more")} · {rest.length}<ChevronDown className={cn("h-3 w-3 transition-transform", more && "rotate-180")} /></button></li>
        )}
        {more && rest.map((r) => <RuleRow key={r.id} r={r} on={false} onToggle={() => toggle(r.label)} />)}
      </FiveRowList>
      <div className="mt-2">
        <FloatingTextarea id="ghiza-note" label={td("g_note_ph")} rows={2} value={d.ghizaNote ?? ""} onChange={(e) => set({ ghizaNote: e.target.value })} title={td("meal_note_eg")} />
      </div>
    </section>
  );
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
  const td = useTranslations("clinic.dossier");
  const fetchPlan = useCallback(() =>
    api.get<{ plan: GhizaPlanData; method: string }>(`/api/facility/visits/${visitId}/ghiza-engine`)
      .then((r) => { setData(r); setFailed(false); })
      .catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchPlan(); }, [fetchPlan]);
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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 text-xs text-muted-foreground">
          {failed && td.rich("diet_failed", { retry: (c) => <button type="button" onClick={() => fetchPlan()} className="text-primary font-medium hover:underline">{c}</button> })}
        </p>
        <span className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? td("rerunning") : td("rerun")}</button>
          {p && leftToAccept && <Button size="sm" className="h-7" onClick={acceptAll}><Sparkles className="h-3.5 w-3.5" /> {td("accept_all")}</Button>}
        </span>
      </div>

      {/* Three columns: Prescribed · Parhez · Meal timing & hydration */}
      {/* Container query: three columns only when the panel itself is wide enough. */}
      <div className="@container">
      <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        <DietColumn tone="rec" icon={CircleCheck} title={td("g_prescribed")} count={d.ghizaRecommended.length}
          add={<FoodAddPicker where="rec" label={td("g_add_food")} suggested={suggested("rec")} foods={foods} rec={d.ghizaRecommended} avoid={d.ghizaAvoid} onPick={(l) => setFood(l, "rec")} />}>
          {d.ghizaRecommended.length === 0 ? <li className="px-1 py-2 text-[13px] text-muted-foreground">{td("g_empty_rec")}</li> : d.ghizaRecommended.map((l) => {
            const f = byLabel(l);
            return (
              <li key={l} className="group flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-background/70 p-2">
                <FoodThumb src={f?.imageUrl} alt={l} credit={f?.imageCredit} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-snug" title={l}>{l}</p>
                  <p className="mt-0.5 flex items-center gap-1.5">
                    {f?.foodMizaj && <span className="shrink-0 rounded bg-sky-500/10 px-1.5 py-px text-[11px] font-medium text-sky-700 dark:text-sky-300">{mizajTag(f.foodMizaj)}</span>}
                    {f?.action && <span title={f.action} className="min-w-0 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{f.action}</span>}
                  </p>
                  {f?.use && <p title={f.use} className="mt-0.5 truncate text-xs text-muted-foreground">{f.use}</p>}
                </div>
                <button type="button" onClick={() => setFood(l, "rec")} aria-label={td("remove_x", { label: l })} className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:text-destructive group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </DietColumn>

        <DietColumn tone="avoid" icon={Ban} title={td("parhez_avoid")} count={d.ghizaAvoid.length}
          add={<FoodAddPicker where="avoid" label={td("g_add_avoid")} suggested={suggested("avoid")} foods={foods} rec={d.ghizaRecommended} avoid={d.ghizaAvoid} onPick={(l) => setFood(l, "avoid")} />}>
          {d.ghizaAvoid.length === 0 ? <li className="px-1 py-2 text-[13px] text-muted-foreground">{td("g_empty_avoid")}</li> : d.ghizaAvoid.map((l) => {
            const f = byLabel(l);
            const hardWhy = suggested("avoid").find((x) => x.label === l && x.hard)?.reasons[0];
            return (
              <li key={l} className="group flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-background/70 p-2">
                <FoodThumb src={f?.imageUrl} alt={l} credit={f?.imageCredit} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold leading-snug" title={l}>{l}</p>
                  <p className={cn("mt-0.5 flex items-center gap-1.5", hardWhy && "flex-wrap")}>
                    {f?.foodMizaj && <span className="shrink-0 rounded bg-destructive/10 px-1.5 py-px text-[11px] font-medium text-destructive">{mizajTag(f.foodMizaj)}</span>}
                    {(hardWhy || f?.harm) && <span title={hardWhy || f?.harm || undefined} className={cn("text-[11px]", hardWhy ? "font-semibold text-destructive" : "min-w-0 truncate text-destructive/90")}>{hardWhy || f?.harm}</span>}
                  </p>
                </div>
                <button type="button" onClick={() => setFood(l, "avoid")} aria-label={td("remove_x", { label: l })} className="rounded p-0.5 text-muted-foreground opacity-60 hover:bg-muted hover:text-destructive group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
              </li>
            );
          })}
        </DietColumn>

        <MealRulesColumn state={state} basis={p?.basis ?? null} />
      </div>
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
    urgent: string[]; infoNeeded: string[]; unani: CdsCand[]; supplements: CdsCand[]; allopathic?: CdsCand[];
    excluded: { tagId: string; label: string; reason: string; verified: boolean }[];
    currentMeds: { label: string; matched: boolean }[];
    basis: { complaints: string[]; conditions: string[]; allergies: string[]; suMizaj: string | null; age: number | null; sex: string | null };
  };
  decisions?: { tagId: string; action: string; reason: string | null }[];
}

/**
 * "Clinical Decision Support — Medicines & Supplements" (doctors only).
 * Candidates from the clinic's own database that may be worth evaluating,
 * after safety checks — each with why it was found, its evidence and
 * verification status and any precautions. They sit in a search box with a
 * drop-down (like the diet); Add appends the medicine to Ilaj-bil-Dawa below.
 */
function CdsPanel({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, herbs } = state;
  const [data, setData] = useState<CdsData | null>(null);
  const [tab, setTab] = useState<"unani" | "allopathic" | "supplements" | "safety" | "info">("unani");
  const [running, setRunning] = useState(false);
  const [rejecting, setRejecting] = useState<{ tagId: string; reason: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Element;
      // Clicks inside the medicine pop-up (a dialog outside this box) keep the list open.
      if (boxRef.current && !boxRef.current.contains(t) && !t.closest?.("[role=dialog]")) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const td = useTranslations("clinic.dossier");
  const tc = useTranslations("common");
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

  const SafetyLink = ({ c }: { c: CdsCand }) => (c.safety.length === 0
    ? <span className="ms-1 inline-block align-middle"><MedicineInfoButton tagId={c.tagId} name={c.label} /></span>
    : <MedicineInfoButton tagId={c.tagId} name={c.label} patientNotes={c.safety}
        className={cn("ms-1.5 inline-flex items-center gap-1 align-middle text-xs font-medium", noteTone(c.safety))}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{td("rx_notes", { count: c.safety.length })}
      </MedicineInfoButton>);

  /** One suggested medicine as a drop-down row: Add puts it in Ilaj-bil-Dawa. */
  const renderRow = (c: CdsCand) => {
    const dec = last(c.tagId);
    const inRx = d.prescriptions.some((p) => p.tagId === c.tagId);
    const rejected = dec?.action === "rejected" && !inRx;
    return (
      <div key={c.tagId} className={cn("px-3 py-2.5 space-y-1", rejected && "opacity-60", inRx && "bg-emerald-500/5")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{c.label}{c.unaniName && c.unaniName !== c.label && <span className="ms-1.5 text-xs font-normal text-muted-foreground">{c.unaniName}</span>}<SafetyLink c={c} /></p>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {[c.herbType, c.mizaj].filter(Boolean).join(" · ")}
              {c.evidence.traditional && <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{td("traditional")}</Badge>}
              {c.evidence.clinical && <Badge variant="outline" className="h-4 px-1.5 text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-400">{td("clinical")}</Badge>}
              <Badge variant="outline" className={cn("h-4 px-1.5 text-[10px]", c.evidence.verified ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400")}>{c.evidence.verified ? td("verified") : td("unverified")}</Badge>
            </p>
            {c.reasons.length > 0 && <p className="text-xs text-emerald-700 dark:text-emerald-400">{c.reasons.join(" · ")}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {inRx ? <span className="flex items-center gap-1 rounded-md border border-emerald-500/60 bg-emerald-600 px-3 py-1 text-xs font-medium text-white"><Check className="h-3 w-3" />{td("added")}</span>
              : <button type="button" onClick={() => addToRx(c)} className="rounded-md border border-emerald-500/50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400">{td("add")}</button>}
            {!inRx && !rejected && rejecting?.tagId !== c.tagId && (
              <button type="button" onClick={() => setRejecting({ tagId: c.tagId, reason: "" })} className="rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">{td("reject_more")}</button>
            )}
            {rejected && <span className="text-xs text-muted-foreground">{td("dec_rejected")}</span>}
          </div>
        </div>
        {rejecting?.tagId === c.tagId && (
          <span className="flex items-center justify-end gap-1.5">
            <Input autoFocus value={rejecting.reason} onChange={(e) => setRejecting({ tagId: c.tagId, reason: e.target.value })} placeholder={td("reject_reason")} className="h-7 w-56 text-xs" />
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!rejecting.reason.trim()} onClick={() => { act(c, "rejected", rejecting.reason); setRejecting(null); }}>{td("reject")}</Button>
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setRejecting(null)}>{tc("cancel")}</button>
          </span>
        )}
      </div>
    );
  };

  const counts = { unani: r?.unani.length ?? 0, allopathic: r?.allopathic?.length ?? 0, supplements: r?.supplements.length ?? 0, safety: (r?.excluded.length ?? 0), info: r?.infoNeeded.length ?? 0 };
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
          <div className="inline-flex flex-wrap rounded-lg border border-border/60 bg-background/40 p-0.5" role="tablist">
            {([["unani", td("tab_unani", { count: counts.unani })], ["allopathic", td("tab_allo", { count: counts.allopathic })], ["supplements", td("tab_supp", { count: counts.supplements })], ["safety", td("tab_safety", { count: counts.safety })], ["info", td("tab_info", { count: counts.info })]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { if (k === "safety") { setSafetyOpen(true); return; } setTab(k); setOpen(k === "unani" || k === "allopathic" || k === "supplements"); }}
                className={cn("rounded-md px-3 py-1 text-[13px] font-medium transition-colors", tab === k ? (k === "safety" ? "bg-destructive text-white" : k === "info" ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground") : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>

          {(tab === "unani" || tab === "allopathic" || tab === "supplements") && (() => {
            const list = tab === "unani" ? r.unani : tab === "allopathic" ? (r.allopathic ?? []) : r.supplements;
            const ql = q.trim().toLowerCase();
            const rows = list.filter((c) => !ql || `${c.label} ${c.unaniName ?? ""} ${c.herbType ?? ""} ${c.reasons.join(" ")}`.toLowerCase().includes(ql));
            return (
              <div ref={boxRef} className="relative">
                <FloatingField id="cdsSearch" icon={Search} autoComplete="off" value={q} aria-expanded={open}
                  label={tab === "unani" ? td("cds_search_unani", { count: list.length }) : tab === "allopathic" ? td("cds_search_allo", { count: list.length }) : td("cds_search_supp", { count: list.length })}
                  onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
                  onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} />
                {open && (
                  <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[420px] overflow-y-auto rounded-xl border border-border/60 bg-popover shadow-xl divide-y divide-border/40">
                    <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{td("cds_dropdown_hint")}</p>
                    {tab === "allopathic" && <p className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/5">{td("cds_allo_note")}</p>}
                    {rows.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">{list.length === 0 ? (tab === "unani" ? td("no_unani") : tab === "allopathic" ? td("no_allo") : td("no_supp")) : td("cds_no_match", { q })}</p>}
                    {rows.map(renderRow)}
                  </div>
                )}
              </div>
            );
          })()}
          <Dialog open={safetyOpen} onOpenChange={setSafetyOpen}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle>{td("tab_safety", { count: counts.safety })}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{td("current_meds")}</p>
                {r.currentMeds.length ? (
                  <div className="flex flex-wrap gap-1.5">{r.currentMeds.map((m) => <span key={m.label} className={cn("rounded-full border px-2.5 py-0.5 text-sm", m.matched ? "border-border/60" : "border-amber-500/50 text-amber-700 dark:text-amber-400")} title={m.matched ? td("med_matched") : td("med_unmatched")}>{m.label}{!m.matched && " ⚠"}</span>)}</div>
                ) : <p className="text-sm text-muted-foreground">{td("none_recorded")}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{td("excluded", { count: r.excluded.length })}</p>
                {r.excluded.length ? (
                  <ul className="space-y-1.5">{r.excluded.map((e) => (
                    <li key={e.tagId} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"><span className="font-semibold">{e.label}</span> <span className="text-destructive">— {e.reason}</span>{!e.verified && <span className="text-muted-foreground">{td("unverified_paren")}</span>}</li>
                  ))}</ul>
                ) : <p className="text-sm text-muted-foreground">{td("nothing_excluded")}</p>}
              </div>
            </div>
            </DialogContent>
          </Dialog>
          {tab === "info" && (r.infoNeeded.length ? <ul className="space-y-1.5">{r.infoNeeded.map((x) => <li key={x} className="flex gap-2 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />{x}</li>)}</ul> : <p className="text-sm text-muted-foreground">{td("nothing_missing")}</p>)}

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
      <Panel icon={Utensils} tour="dossier.ghiza" title={td("ghiza_title")}>
        <GhizaPicker state={state} visitId={visitId} />
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
                    <p className="text-[15px] font-semibold flex flex-wrap items-center gap-1.5">{herbs.find((h) => h.id === p.tagId)?.kind === "medication" ? <Pill className="h-4 w-4 text-sky-600" /> : <Leaf className="h-4 w-4 text-primary" />}{p.name}{p.tagId && (w.length > 0
                      ? <MedicineInfoButton tagId={p.tagId} name={p.name} patientNotes={w}
                          className={cn("ms-1 inline-flex items-center gap-1.5 text-[13px] font-medium", noteTone(w))}>
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{td("rx_notes", { count: w.length })}
                        </MedicineInfoButton>
                      : <MedicineInfoButton tagId={p.tagId} name={p.name} />)}{!p.tagId && <Badge variant="outline" className="text-[11px] font-normal">{td("not_catalogue")}</Badge>}</p>
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
                </div>
              );
            })}
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
      <QuestionRow question={<Q>{td("prognosis")}</Q>}>
        <OptionDropdown id="prognosis" options={(options?.prognosis || []).map((o) => ({ label: o.label, description: o.description }))} value={d.prognosis ? [d.prognosis] : []}
          onChange={(v) => set({ prognosis: v[0] ?? null })} placeholder={td("choose_one")} />
      </QuestionRow>
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
      <QuestionRow question={<Q>{td("priority")}</Q>}>
        <Segmented value={d.priority} options={PRIORITIES.map((o) => ({ value: o.value, label: td(`pr_${o.value}`) }))} onChange={(v) => set({ priority: v ?? "routine" })} />
      </QuestionRow>
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
    ilaj: d.prescriptions.length + d.tadbeer.length + d.ghizaRecommended.length + d.ghizaAvoid.length + d.ghizaRules.length > 0,
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

      <Card ref={headerRef} className="px-4 py-3 border-border/50 bg-card/60 gap-0">
        {/* One line: title · the six steps (click jumps; description on hover) · progress and status */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary"><FileSignature className="h-4.5 w-4.5" /></div>
            <h2 className="font-serif text-lg font-semibold leading-tight">{td("title")}</h2>
          </div>
          <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label={td("jump")}>
            {TABS.map((t, i) => {
              const on = inView === t.key;
              const ok = done[t.key];
              return (
                <button key={t.key} type="button" onClick={() => jump(t.key)} title={`${i + 1}. ${tabLabel(t.key, t.label)} — ${tabSub(t.key)}${ok ? td("recorded_suffix") : ""}`}
                  aria-current={on ? "step" : undefined}
                  className={cn("flex flex-auto shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-[13px] font-medium transition-colors",
                    on ? "border-primary bg-primary/10 text-primary" : ok ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:border-emerald-500/50 dark:text-emerald-400" : "border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                  {ok ? <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-label={td("recorded")} /> : <t.icon className="h-4 w-4 shrink-0" />}
                  <span>{tabLabel(t.key, t.short)}</span>
                </button>
              );
            })}
          </nav>
          <span className="flex shrink-0 items-center gap-1.5">
            {state.autoSavedAt && d.status === "draft" && <span className="hidden xl:inline text-[11px] text-muted-foreground">{td("autosaved", { time: state.autoSavedAt.toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" }) })}</span>}
            <Badge variant="outline" className={cn("tabular-nums", doneCount === TABS.length && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400")}>{td("n_steps", { n: doneCount, total: TABS.length })}</Badge>
            {d.status === "finalized"
              ? <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/40">{td("finalised")}{d.versions?.[0] ? ` · ${td("version_n", { n: d.versions[0].version })}` : ""}</Badge>
              : <Badge variant="outline">{td("draft")}</Badge>}
          </span>
        </div>
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
