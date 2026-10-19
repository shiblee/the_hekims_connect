"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AKHLAT, isAnswered, questionVisible, type AsbabAnswer, type AsbabQuestionCfg, type HumourPoints } from "@/lib/asbab";
import { DARJA, PRIORITIES, SU_MIZAJ_TYPES, type PrescriptionLine, type TadbeerLine, type TashkheesOptionRow } from "@/lib/tashkhees";
import { useAsbabAssessment } from "@/components/facility/views/asbab-assessment";
import { Card } from "@/components/ui/card";
import { LoadFailed, useNotice } from "@/components/shared/inline-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeading } from "@/components/shared/section-heading";
import { FloatingField, FloatingSelect, FloatingTextarea } from "@/components/shared/floating-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sortLabels } from "@/lib/sort-options";
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, Check, ClipboardCheck, FileSignature, HeartPulse, Leaf, Loader2, Pill, Plus,
  Search, ShieldAlert, Sparkles, Stethoscope, Trash2, Utensils, X,
} from "lucide-react";

// ---------------------------------------------------------------- state

interface Dossier {
  status: "draft" | "finalized"; finalizedAt: string | null; finalizedByName: string | null;
  mizajAsli: string | null; suMizajType: string | null; suMizajQuality: string | null; suMizajGrade: number | null;
  organs: string[]; diagnosisNote: string | null; usool: string[]; usoolNote: string | null;
  ghizaRecommended: string[]; ghizaAvoid: string[]; ghizaNote: string | null;
  tadbeer: TadbeerLine[]; prescriptions: PrescriptionLine[];
  prognosis: string | null; followUpDate: string | null; followUpNote: string | null;
  urgentDirectives: string | null; priority: string; handoverNote: string | null;
}
const EMPTY: Dossier = {
  status: "draft", finalizedAt: null, finalizedByName: null, mizajAsli: null, suMizajType: null, suMizajQuality: null, suMizajGrade: null,
  organs: [], diagnosisNote: null, usool: [], usoolNote: null, ghizaRecommended: [], ghizaAvoid: [], ghizaNote: null,
  tadbeer: [], prescriptions: [], prognosis: null, followUpDate: null, followUpNote: null, urgentDirectives: null, priority: "routine", handoverNote: null,
};
interface Herb { id: string; label: string; category: string | null; forms: string[] }
type Warn = { level: "high" | "caution" | "info"; text: string; verified: boolean };

/** Dossier + Dala'il answers + option lists for Stage 5. */
export function useTashkhees(visitId: string | undefined) {
  const dalail = useAsbabAssessment(visitId, "dalail");
  const [options, setOptions] = useState<Record<string, TashkheesOptionRow[]> | null>(null);
  const [herbs, setHerbs] = useState<Herb[]>([]);
  const [dossier, setDossier] = useState<Dossier>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"draft" | "finalize" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const msg = useNotice();

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    Promise.all([
      api.get<{ options: Record<string, TashkheesOptionRow[]>; herbs: Herb[] }>("/api/facility/tashkhees/options"),
      api.get<{ dossier: Dossier | null }>(`/api/facility/visits/${visitId}/dossier`),
    ])
      .then(([o, d]) => {
        if (cancelled) return;
        setLoadError(null);
        setOptions(o.options); setHerbs(o.herbs);
        if (d.dossier) setDossier({ ...EMPTY, ...d.dossier, followUpDate: d.dossier.followUpDate ? d.dossier.followUpDate.slice(0, 10) : null });
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || "Network error"); });
    return () => { cancelled = true; };
  }, [visitId, reloadTick]);
  const reload = () => { setLoadError(null); setReloadTick((t) => t + 1); if (dalail.loadError) dalail.reload(); };

  const set = useCallback((patch: Partial<Dossier>) => { setDossier((d) => ({ ...d, ...patch })); setDirty(true); }, []);

  const save = async (finalize: boolean) => {
    if (!visitId) return false;
    setSaving(finalize ? "finalize" : "draft");
    try {
      const [res, dalailOk] = await Promise.all([
        api.post<{ dossier: Dossier }>(`/api/facility/visits/${visitId}/dossier`, { ...dossier, finalize }),
        dalail.save(false),
      ]);
      setDossier({ ...EMPTY, ...res.dossier, followUpDate: res.dossier.followUpDate ? res.dossier.followUpDate.slice(0, 10) : null });
      setDirty(false);
      dalail.msg.clear();
      if (!dalailOk) {
        msg.error("The dossier was saved, but the Dala'il examination answers weren't", "They're still on screen in the Dala'il tab — save again to keep them.", { retry: () => save(finalize), retryLabel: "Save again" });
        return false;
      }
      msg.clear();
      return true;
    } catch (e: any) {
      msg.error(
        finalize ? "The dossier wasn't finalised" : "The draft wasn't saved",
        `${e.message || "Network error"}. Everything you entered is still on screen — nothing was lost.`,
        { retry: () => save(finalize), retryLabel: "Try again" },
      );
      return false;
    } finally {
      setSaving(null);
    }
  };

  return { dalail, options, herbs, dossier, set, dirty: dirty || dalail.dirty, saving, save, msg, loadError: loadError || dalail.loadError, reload };
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
              "rounded-full border px-3 py-1 text-sm leading-snug transition-colors text-left",
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
          <span className="text-right tabular-nums">{pct[h.key]}%</span>
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
  const sel = Array.isArray(value) ? value : [];
  const toggle = (l: string) => onChange(q.type === "multi_select" ? (sel.includes(l) ? sel.filter((x) => x !== l) : [...sel, l]) : (sel.includes(l) ? [] : [l]));
  return (
    <div className="grid md:grid-cols-[230px_1fr] gap-x-4 gap-y-2 py-3 border-t border-border/40 first:border-t-0">
      <div>
        <p className="text-[15px] font-medium">
          {q.label}{q.required && <span className="text-destructive"> *</span>}
          {tag === "safety" && <span className="ml-1.5 align-middle rounded-full bg-destructive/10 border border-destructive/30 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-destructive">Safety</span>}
          {tag === "new" && <span className="ml-1.5 align-middle rounded-full bg-primary/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">New</span>}
        </p>
        {q.labelLocal && <p className="text-[13px] text-muted-foreground">{q.labelLocal}</p>}
        {reason && (
          <p className="mt-0.5 flex items-start gap-1 text-xs text-primary/90"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" /><span>{reason}</span></p>
        )}
        {tag === "added" && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">Added by you
            {onRemove && <button type="button" onClick={onRemove} className="text-primary hover:underline">remove</button>}
          </p>
        )}
        {tag === "earlier" && <p className="mt-0.5 text-xs text-muted-foreground">Recorded earlier on this visit</p>}
      </div>
      {q.type === "text"
        ? <FloatingField id={`dalail-${q.id}`} label="Describe the finding" maxLength={500} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
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

  const fetchSel = useCallback((refresh: boolean) =>
    api.get<{ selection: DalailSelectionData }>(`/api/facility/visits/${visitId}/dalail-selection${refresh ? "?refresh=1" : ""}`)
      .then((r) => { setSel(r.selection); setSelError(false); })
      .catch(() => setSelError(true)), [visitId]);
  const load = (refresh: boolean) => { setRefreshing(true); fetchSel(refresh).finally(() => setRefreshing(false)); };
  useEffect(() => { fetchSel(false); }, [fetchSel]);

  if (!pillars) return <Loading />;
  if (!pillars.length) return <Card className="p-5 text-sm text-muted-foreground">No examination sections are enabled — configure them in Admin → Meta → Tashkhees &amp; Ilaj.</Card>;

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
    <Panel icon={Stethoscope} tour="dossier.dalail" title="Dala'il — Clinical Signs"
      aside={
        <span className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {sel && !selError && (
            <span className="inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5" role="group" aria-label="Which signs to show">
              {([["selected", `For this patient · ${sel.questionIds.length + sel.addedIds.filter((x) => !sel.questionIds.includes(x)).length}`], ["all", `All · ${allQs.length}`]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setView(m)} aria-pressed={view === m}
                  className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors", view === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {label}
                </button>
              ))}
            </span>
          )}
          <Badge variant="outline" className="tabular-nums">{answeredN} of {shown.length} recorded</Badge>
        </span>
      }>

      {/* What the selection was based on */}
      {sel && !selError && mode === "selected" && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-[13px] font-semibold text-primary flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Selected for this patient</p>
            <button type="button" onClick={() => load(true)} disabled={refreshing} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">
              {refreshing ? "Re-checking…" : "Re-check"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sel.context.complaints.map((c) => (
              <span key={c.label} className={cn("rounded-full border px-2.5 py-0.5 text-xs", c.primary ? "border-primary/50 bg-primary/10 font-semibold text-primary" : "border-border/60 bg-background/50")}>{c.label}</span>
            ))}
            {sel.context.symptoms.map((x) => <span key={x} className="rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5 text-xs">{x}</span>)}
            {sel.context.regions.map((x) => <span key={x} className="rounded-full border border-dashed border-border/70 px-2.5 py-0.5 text-xs text-muted-foreground">{x}</span>)}
            {sel.context.complaints.length + sel.context.symptoms.length + sel.context.regions.length === 0 && (
              <span className="text-xs text-muted-foreground">No complaints or symptoms recorded yet — showing the core examination signs.</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {sel.questionIds.length} of {sel.eligibleCount} relevant signs from a bank of {sel.bankSize}
            {" · "}{sel.method === "ranked" ? "ordered by Hakeem Insight" : "chosen by clinical rules"}
            {sel.method === "rules-fallback" && " (Hakeem Insight unavailable right now)"}
          </p>
        </div>
      )}
      {selError && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-400">
          The focused selection couldn&apos;t be loaded, so every examination sign is shown. <button type="button" onClick={() => load(false)} className="font-medium underline">Try again</button>
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
                className={cn("rounded-xl border border-l-4 bg-background/30 px-4 pt-3 pb-1", done ? "border-border/50 border-l-emerald-500/70" : "border-border/50 border-l-primary/40")}>
                <div className="flex items-center justify-between gap-2 pb-1">
                  <p className="text-[15px] font-semibold">{p.label} <span className="text-[13px] font-normal text-muted-foreground">· {p.english}</span></p>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs tabular-nums", done ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-border/60 text-muted-foreground")}>{done ? "✓ Done" : `${a}/${qs.length}`}</span>
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
              <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> Add a question</Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-2" align="start">
              <Input autoFocus value={addQuery} onChange={(e) => setAddQuery(e.target.value)} placeholder="Search examination questions…" className="h-9 mb-2" />
              <div className="max-h-72 overflow-y-auto space-y-0.5">
                {addable.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">{aq ? "No other question matches." : "Every approved question is already shown."}</p>}
                {addable.slice(0, 60).map(({ p, q }) => (
                  <button key={q.id} type="button" onClick={() => { changeAdded(q.id, true); setAddOpen(false); setAddQuery(""); }}
                    className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                    {q.label}<span className="block text-xs text-muted-foreground">{p.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <button type="button" onClick={() => setView("all")} className="text-[13px] text-primary font-medium hover:underline">Show all {allQs.length} signs</button>
        </div>
      )}

      {hasSigns && drift && (
        <div className="rounded-xl border border-border/50 bg-background/40 p-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Signs point towards</p>
          <HumourBars pct={drift.percent} compact />
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- tab 2: Tashkhees

// ---------------------------------------------------------------- Tashkhees engine card

type EngPoints = Record<"safra" | "dam" | "balgham" | "sauda", number>;
interface EngTemperament { label: string | null; humour: string | null; percent: EngPoints; lead: number; confidence: "strong" | "moderate" | "weak"; evidence: { label: string; humour: string; points: number }[]; note?: string }
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
  const [data, setData] = useState<{ suggestion: EngSuggestion; method: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);

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
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize", CONF_STYLE[c])}>{c} evidence</span>
  );
  const Ev = ({ items }: { items: { label: string; humour: string }[] }) => items.length ? (
    <ul className="mt-1.5 space-y-0.5">
      {items.slice(0, 3).map((e, i) => {
        const h = AKHLAT.find((x) => x.key === e.humour);
        return <li key={i} className="text-xs text-muted-foreground">• {e.label}{h && <span className={cn("ml-1 font-medium", h.text)}>→ {h.label}</span>}</li>;
      })}
    </ul>
  ) : null;
  const Apply = ({ applied, onClick, label = "Accept" }: { applied: boolean; onClick: () => void; label?: string }) => applied
    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Applied</span>
    : <Button size="sm" variant="outline" className="h-7" onClick={onClick}>{label}</Button>;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Tashkhees Engine</p>
        <span className="flex items-center gap-2">
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? "Re-running…" : "Re-run"}</button>
          {canApplyAll && <Button size="sm" className="h-7" onClick={applyAll}>Accept all</Button>}
        </span>
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">The suggestion couldn&apos;t be loaded — fill in the diagnosis below as usual. <button type="button" onClick={() => fetchEngine()} className="text-primary font-medium hover:underline">Try again</button></p>
      ) : !s ? <Loading /> : (
        <>
          {/* The three humoral readings and how much each counts */}
          <div className="grid sm:grid-cols-3 gap-2.5">
            {s.sources.map((r) => (
              <div key={r.key} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
                <p className="text-xs text-muted-foreground leading-snug">{r.label}</p>
                <p className="text-[11px] text-muted-foreground/80 mb-1.5">{r.percent ? `counts ×${r.weight}` : "not recorded"}</p>
                {r.percent && <HumourBars pct={r.percent} compact />}
              </div>
            ))}
          </div>

          {/* Suggestions */}
          <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-background/50">
            <div className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mizaj-e-Asli · constitution</p>
                {asli?.label ? (
                  <>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2"><span className="text-base font-semibold">{asli.label}</span>{local(asli.label) && <span className="text-xs text-muted-foreground">{local(asli.label)}</span>}<Conf c={asli.confidence} /></p>
                    {asli.note && <p className="mt-1 text-xs text-muted-foreground">{asli.note}</p>}
                    <Ev items={asli.evidence} />
                  </>
                ) : <p className="mt-0.5 text-sm text-muted-foreground">{s.insufficient.find((x) => x.includes("Mizaj-e-Asli")) || "No suggestion"}</p>}
              </div>
              {asli?.label && <Apply applied={asliApplied} onClick={applyAsli} />}
            </div>

            <div className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Su-e-Mizaj · present dyscrasia</p>
                {su?.label ? (
                  <>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{su.type} · {su.label}{su.darja ? ` · Darja ${su.darja}` : ""}</span>
                      {local(su.label) && <span className="text-xs text-muted-foreground">{local(su.label)}</span>}
                      <Conf c={su.confidence} />
                    </p>
                    {su.type === "Maddi" && su.maddiSigns.length > 0 && (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Morbid-matter signs: {su.maddiSigns.slice(0, 3).join("; ")}</p>
                    )}
                    {su.note && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{su.note}</p>}
                    <Ev items={su.evidence} />
                  </>
                ) : <p className="mt-0.5 text-sm text-muted-foreground">{s.insufficient.find((x) => x.includes("Su-e-Mizaj")) || "No suggestion"}</p>}
              </div>
              {su?.label && <Apply applied={suApplied} onClick={applySu} />}
            </div>

            <div className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Udw-e-Mutathir · organs</p>
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
                ) : <p className="mt-0.5 text-sm text-muted-foreground">{s.insufficient.find((x) => x.includes("organ")) || "No suggestion"}</p>}
                {s.organs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{s.organs[0].reason}{s.organs.length > 1 ? " · hover an organ for its reason" : ""}</p>}
              </div>
              {s.organs.length > 0 && <Apply applied={newOrgans.length === 0} onClick={applyOrgans} label={`Add ${newOrgans.length}`} />}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A guide from the saved findings{data?.method === "ranked" ? " · organs ordered by Hakeem Insight" : ""} — the Hakim decides. Re-run after changing the examination to update it.
          </p>
        </>
      )}
    </div>
  );
}

function TashkheesTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  const mizaj = (options?.mizaj || []).map((o) => ({ label: o.label, sub: o.localName || o.description }));
  return (
    <Panel icon={FileSignature} tour="dossier.diagnosis" title="Tashkhees — Diagnosis" hint="Constitution, the present dyscrasia and the organs affected.">
      <EngineCard state={state} visitId={visitId} />
      <div><Label required>Mizaj-e-Asli (baseline temperament)</Label>
        <Chips items={mizaj} selected={d.mizajAsli ? [d.mizajAsli] : []} onToggle={(l) => set({ mizajAsli: d.mizajAsli === l ? null : l })} /></div>
      <div className="space-y-3">
        <Label required>Su-e-Mizaj (present dyscrasia)</Label>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={d.suMizajType} options={SU_MIZAJ_TYPES.map((t) => ({ value: t.value, label: t.value }))} onChange={(v) => set({ suMizajType: v })} />
          <span className="text-[13px] text-muted-foreground">{SU_MIZAJ_TYPES.find((t) => t.value === d.suMizajType)?.description ?? "Sada (simple) or Maddi (with morbid matter)"}</span>
        </div>
        <Chips items={mizaj} selected={d.suMizajQuality ? [d.suMizajQuality] : []} onToggle={(l) => set({ suMizajQuality: d.suMizajQuality === l ? null : l })} />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Darja (degree)</span>
          <Segmented value={d.suMizajGrade} options={DARJA.map((n) => ({ value: n, label: `${n}` }))} onChange={(v) => set({ suMizajGrade: v })} />
        </div>
      </div>
      <div><Label>Udw-e-Mutathir (affected organs)</Label>
        <Chips items={(options?.organ || []).map((o) => ({ label: o.label, sub: o.description }))} selected={d.organs}
          onToggle={(l) => set({ organs: d.organs.includes(l) ? d.organs.filter((x) => x !== l) : [...d.organs, l] })} /></div>
      <FloatingTextarea id="tashkhees-statement" label="Tashkhees statement" rows={3} value={d.diagnosisNote ?? ""} onChange={(e) => set({ diagnosisNote: e.target.value })}
        title="e.g. Su-e-Mizaj Maddi Safrawi with Hararat-e-Meda (gastric heat) and secondary Sahar" />
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
const USOOL_PHASES: Record<number, string> = { 1: "Remove the cause", 2: "Concoction · Nuzj", 3: "Evacuation · Istifragh", 4: "Correct the temperament", 5: "Strengthen · Taqwiyat", 6: "Relieve symptoms" };

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
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Suggested treatment plan</p>
        <span className="flex items-center gap-2">
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? "Re-running…" : "Re-run"}</button>
          {missing.length > 0 && <Button size="sm" className="h-7" onClick={() => add(missing)}>Accept plan ({missing.length})</Button>}
        </span>
      </div>
      {failed ? (
        <p className="text-sm text-muted-foreground">The plan couldn&apos;t be loaded — choose the principles below as usual. <button type="button" onClick={() => fetchPlan()} className="text-primary font-medium hover:underline">Try again</button></p>
      ) : !p ? <Loading /> : (
        <>
          <p className="text-xs text-muted-foreground">
            Based on {b?.suMizaj ? <span className="font-medium text-foreground">Su-e-Mizaj {[b.type, b.suMizaj, b.darja ? `Darja ${b.darja}` : null].filter(Boolean).join(" · ")}</span> : "no diagnosis yet"}
            {b && b.organs.length > 0 && <> · organs <span className="font-medium text-foreground">{b.organs.join(", ")}</span></>}
            {b?.fromEngine && <span className="text-amber-700 dark:text-amber-400"> — the engine&apos;s suggested diagnosis; record the Tashkhees above for a firmer plan</span>}
          </p>
          {p.plan.length > 0 && (
            <ol className="space-y-1.5">
              {p.plan.map((x, i) => {
                const on = d.usool.includes(x.label);
                const newPhase = i === 0 || p.plan[i - 1].phase !== x.phase;
                return (
                  <li key={x.label}>
                    {newPhase && <p className="mt-1 mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Step {x.phase} · {USOOL_PHASES[x.phase] ?? ""}</p>}
                    <div className={cn("flex items-start justify-between gap-3 rounded-lg border px-3 py-2", on ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/50")}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{x.label}{x.localName && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{x.localName}</span>}</p>
                        {x.description && <p className="text-xs text-muted-foreground">{x.description}</p>}
                        <p className="mt-0.5 text-xs text-primary/90 flex items-center gap-1"><Sparkles className="h-3 w-3 shrink-0" />{x.reason}</p>
                      </div>
                      {on
                        ? <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> Added</span>
                        : <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => add([x.label])}>Add</Button>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {p.cautions.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Use with caution — not included in the plan</p>
              {p.cautions.map((x) => (
                <div key={x.label} className="flex items-start justify-between gap-3">
                  <p className="text-xs"><span className="font-semibold">{x.label}</span> <span className="text-muted-foreground">— {x.caution}</span></p>
                  {!d.usool.includes(x.label) && <button type="button" onClick={() => add([x.label])} className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline">Add anyway</button>}
                </div>
              ))}
            </div>
          )}
          {p.insufficient.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
          <p className="text-[11px] text-muted-foreground">A guide{data?.method === "ranked" ? " · ordered by Hakeem Insight" : ""} — the Hakim decides. Re-run after changing the diagnosis.</p>
        </>
      )}
    </div>
  );
}

function UsoolTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  return (
    <Panel icon={ClipboardCheck} tour="dossier.usool" title="Usool-e-Ilaj — Principles of Treatment" hint="The strategy the treatment below will follow.">
      <UsoolEngineCard state={state} visitId={visitId} />
      <div className="grid sm:grid-cols-2 gap-2">
        {(options?.usool || []).map((o) => {
          const on = d.usool.includes(o.label);
          return (
            <button key={o.id} type="button" aria-pressed={on} onClick={() => set({ usool: on ? d.usool.filter((x) => x !== o.label) : [...d.usool, o.label] })}
              className={cn("flex items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                on ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/40 hover:border-primary/30")}>
              <span className="min-w-0"><span className="block text-sm font-semibold">{o.label}</span>{o.description && <span className="block text-[13px] text-muted-foreground mt-0.5">{o.description}</span>}</span>
              <span className={cn("mt-0.5 h-4.5 w-4.5 rounded-full border shrink-0 flex items-center justify-center", on ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/40")}>{on && <Check className="h-3 w-3" />}</span>
            </button>
          );
        })}
      </div>
      <FloatingTextarea id="usool-note" label="Plan note" rows={2} value={d.usoolNote ?? ""} onChange={(e) => set({ usoolNote: e.target.value })}
        title="e.g. Munzij for 7 days, then Mushil; cooling diet throughout" />
    </Panel>
  );
}

// ---------------------------------------------------------------- tab 4: Ilaj trinity

function HerbPicker({ herbs, onPick }: { herbs: Herb[]; onPick: (h: { id: string | null; label: string; forms: string[] }) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const results = herbs.filter((h) => !q.trim() || h.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5" /> Add medicine</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Unani medicines…" className="h-9 mb-2" />
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {results.map((h) => (
            <button key={h.id} type="button" onClick={() => { onPick({ id: h.id, label: h.label, forms: h.forms }); setOpen(false); setQ(""); }}
              className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
              {h.label}{h.category && <span className="block text-[11px] text-muted-foreground">{h.category}</span>}
            </button>
          ))}
          {q.trim() && !herbs.some((h) => h.label.toLowerCase() === q.trim().toLowerCase()) && (
            <button type="button" onClick={() => { onPick({ id: null, label: q.trim(), forms: [] }); setOpen(false); setQ(""); }}
              className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted/60 text-primary">Add &quot;{q.trim()}&quot; (not in catalogue)</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------- Ilaj-bil-Ghiza engine card

/** A food photo (with its credit as a tooltip), or a neutral tile when there's none. */
function FoodThumb({ src, alt, credit, className }: { src?: string | null; alt: string; credit?: string | null; className?: string }) {
  return src
    ? <img src={src} alt={alt} title={credit || undefined} loading="lazy" className={cn("shrink-0 rounded-lg object-cover bg-muted", className)} />
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
function GhizaEngineCard({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set } = state;
  const [data, setData] = useState<{ plan: GhizaPlanData; method: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [running, setRunning] = useState(false);
  const fetchPlan = useCallback(() =>
    api.get<{ plan: GhizaPlanData; method: string }>(`/api/facility/visits/${visitId}/ghiza-engine`)
      .then((r) => { setData(r); setFailed(false); })
      .catch(() => setFailed(true)), [visitId]);
  useEffect(() => { fetchPlan(); }, [fetchPlan]);
  const rerun = async () => { setRunning(true); try { await state.save(false); await fetchPlan(); } finally { setRunning(false); } };
  const record = (labels: string[]) => { if (labels.length) api.post(`/api/facility/visits/${visitId}/ghiza-engine`, { accepted: labels }).catch(() => {}); };
  const put = (labels: string[], where: "rec" | "avoid") => {
    const rec = d.ghizaRecommended.filter((x) => !labels.includes(x) || where === "rec");
    const avoid = d.ghizaAvoid.filter((x) => !labels.includes(x) || where === "avoid");
    const target = where === "rec" ? rec : avoid;
    const fresh = labels.filter((l) => !target.includes(l));
    if (!fresh.length) return;
    target.push(...fresh);
    set({ ghizaRecommended: rec, ghizaAvoid: avoid });
    record(fresh);
  };
  const p = data?.plan;
  const recLeft = (p?.recommended || []).filter((x) => !d.ghizaRecommended.includes(x.label)).map((x) => x.label);
  const avoidLeft = (p?.avoid || []).filter((x) => !d.ghizaAvoid.includes(x.label)).map((x) => x.label);

  const Tile = ({ x, kind }: { x: GhizaPick; kind: "rec" | "avoid" }) => {
    const on = kind === "rec" ? d.ghizaRecommended.includes(x.label) : d.ghizaAvoid.includes(x.label);
    return (
      <div className={cn("flex gap-2.5 rounded-lg border p-2",
        on ? (kind === "rec" ? "border-emerald-500/50 bg-emerald-500/10" : "border-destructive/50 bg-destructive/10")
          : x.hard ? "border-destructive/50 bg-destructive/5" : "border-border/50 bg-background/60")}>
        <FoodThumb src={x.imageUrl} alt={x.label} credit={x.imageCredit} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{x.label}</p>
          {x.foodMizaj && <p className="text-[11px] text-muted-foreground">{x.foodMizaj}{x.category ? ` · ${x.category}` : ""}</p>}
          <p className={cn("mt-0.5 text-xs leading-snug", x.hard ? "font-medium text-destructive" : kind === "rec" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive/90")}>{x.reasons.slice(0, 2).join(" · ")}</p>
        </div>
        <div className="shrink-0 self-center">
          {on
            ? <Check className={cn("h-4 w-4", kind === "rec" ? "text-emerald-600" : "text-destructive")} />
            : <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => put([x.label], kind)}>{kind === "rec" ? "Add" : "Parhez"}</Button>}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Diet for this patient</p>
        <span className="flex items-center gap-2">
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? "Re-running…" : "Re-run"}</button>
          {(recLeft.length > 0 || avoidLeft.length > 0) && <Button size="sm" className="h-7" onClick={() => { put(recLeft, "rec"); put(avoidLeft, "avoid"); }}>Accept all</Button>}
        </span>
      </div>
      {failed ? (
        <p className="text-sm text-muted-foreground">The diet advice couldn&apos;t be loaded — choose foods below as usual. <button type="button" onClick={() => fetchPlan()} className="text-primary font-medium hover:underline">Try again</button></p>
      ) : !p ? <Loading /> : (
        <>
          <p className="text-xs text-muted-foreground">
            Based on {p.basis.suMizaj ? <span className="font-medium text-foreground">{p.basis.suMizaj}</span> : "no Su-e-Mizaj yet"}
            {p.basis.fromEngine && <span className="text-amber-700 dark:text-amber-400"> (suggested)</span>}
            {p.basis.conditions.length > 0 && <> · history: <span className="font-medium text-foreground">{p.basis.conditions.join(", ")}</span></>}
            {p.basis.allergies.length > 0 && <> · allergies: <span className="font-medium text-destructive">{p.basis.allergies.join(", ")}</span></>}
          </p>
          <div className="grid lg:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 flex items-center justify-between">Recommended · {p.recommended.length}
                {recLeft.length > 0 && <button type="button" onClick={() => put(recLeft, "rec")} className="normal-case tracking-normal font-medium hover:underline">Add all</button>}</p>
              {p.recommended.length ? p.recommended.map((x) => <Tile key={x.label} x={x} kind="rec" />) : <p className="text-xs text-muted-foreground">No clear recommendations yet.</p>}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive flex items-center justify-between">Parhez (avoid) · {p.avoid.length}
                {avoidLeft.length > 0 && <button type="button" onClick={() => put(avoidLeft, "avoid")} className="normal-case tracking-normal font-medium hover:underline">Add all</button>}</p>
              {p.avoid.length ? p.avoid.map((x) => <Tile key={x.label} x={x} kind="avoid" />) : <p className="text-xs text-muted-foreground">Nothing specific to avoid.</p>}
            </div>
          </div>
          {p.insufficient.map((n) => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
          <p className="text-[11px] text-muted-foreground">A guide{data?.method === "ranked" ? " · ordered by Hakeem Insight" : ""} — the Hakim decides. Food photos: Wikimedia Commons (hover a photo for its credit).</p>
        </>
      )}
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
            <p className="text-[15px] font-semibold leading-snug">{c.label}{c.unaniName && c.unaniName !== c.label && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{c.unaniName}</span>}</p>
            <p className="text-xs text-muted-foreground">{[c.herbType, c.mizaj].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {c.evidence.traditional && <Badge variant="outline" className="text-[10px]">Traditional use</Badge>}
            {c.evidence.clinical && <Badge variant="outline" className="text-[10px] border-sky-500/40 text-sky-700 dark:text-sky-400">Clinical evidence</Badge>}
            <Badge variant="outline" className={cn("text-[10px]", c.evidence.verified ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400")}>{c.evidence.verified ? "Verified" : "Unverified"}</Badge>
          </div>
        </div>
        <ul className="space-y-0.5">{c.reasons.map((x) => <li key={x} className="text-xs text-foreground/85">• {x}</li>)}</ul>
        {c.safety.length > 0 && (
          <ul className="space-y-0.5 rounded-lg bg-background/60 px-2 py-1.5">
            {c.safety.map((n, i) => (
              <li key={i} className={cn("text-xs flex gap-1.5", NOTE_STYLE[n.level])}>
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /><span>{n.text}{!n.verified && <span className="opacity-70"> (unverified)</span>}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-muted-foreground mr-auto">Profile {c.completeness}% complete{dec ? ` · ${dec.action === "added_to_prescription" ? "added to prescription" : dec.action === "accepted" ? "accepted for evaluation" : dec.action}` : ""}</span>
          {rejecting?.tagId === c.tagId ? (
            <span className="flex items-center gap-1.5">
              <Input autoFocus value={rejecting.reason} onChange={(e) => setRejecting({ tagId: c.tagId, reason: e.target.value })} placeholder="Reason for rejecting" className="h-7 w-48 text-xs" />
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!rejecting.reason.trim()} onClick={() => { act(c, "rejected", rejecting.reason); setRejecting(null); }}>Reject</Button>
              <button type="button" className="text-xs text-muted-foreground" onClick={() => setRejecting(null)}>Cancel</button>
            </span>
          ) : (
            <>
              {!dec && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => act(c, "considered")}>Considered</Button>}
              {dec?.action !== "accepted" && dec?.action !== "added_to_prescription" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => act(c, "accepted")}>Accept for evaluation</Button>}
              {dec?.action !== "rejected" && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => setRejecting({ tagId: c.tagId, reason: "" })}>Reject…</Button>}
              {(dec?.action === "accepted" || dec?.action === "added_to_prescription") && (
                inRx ? <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> In prescription</span>
                  : <Button size="sm" className="h-7 text-xs" onClick={() => addToRx(c)}><Plus className="h-3 w-3" /> Add to prescription</Button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  const counts = { unani: r?.unani.length ?? 0, supplements: r?.supplements.length ?? 0, safety: (r?.excluded.length ?? 0), info: r?.infoNeeded.length ?? 0 };
  return (
    <Panel icon={ShieldAlert} tour="dossier.cds" title="Clinical Decision Support — Medicines & Supplements"
      aside={
        <span className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">Pilot · data under review</Badge>
          <button type="button" onClick={rerun} disabled={running} className="text-xs font-medium text-primary hover:underline disabled:opacity-50">{running ? "Re-checking…" : "Re-check"}</button>
        </span>
      }>
      {failed || !r ? (
        failed ? <p className="text-sm text-muted-foreground">Decision support couldn&apos;t be loaded — the prescription below works as usual. <button type="button" onClick={() => fetchCds()} className="text-primary font-medium hover:underline">Try again</button></p> : <Loading />
      ) : (
        <>
          {r.urgent.map((u) => (
            <p key={u} className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />{u}</p>
          ))}
          <p className="text-xs text-muted-foreground">
            For <span className="font-medium text-foreground">{r.basis.complaints.join(", ") || "no complaints recorded"}</span>
            {r.basis.suMizaj && <> · Su-e-Mizaj {r.basis.suMizaj}</>}
            {r.basis.conditions.length > 0 && <> · history: {r.basis.conditions.join(", ")}</>}
            {r.basis.allergies.length > 0 && <> · allergies: <span className="text-destructive">{r.basis.allergies.join(", ")}</span></>}
            {r.basis.age != null && <> · {r.basis.age} yrs{r.basis.sex ? `, ${r.basis.sex}` : ""}</>}
            {data?.changed && <span className="text-primary"> · updated after new findings</span>}
          </p>
          <div className="inline-flex flex-wrap rounded-lg border border-border/60 bg-background/40 p-0.5" role="tablist">
            {([["unani", `Unani medicines · ${counts.unani}`], ["supplements", `Supplements · ${counts.supplements}`], ["safety", `Safety & exclusions · ${counts.safety}`], ["info", `More information needed · ${counts.info}`]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn("rounded-md px-3 py-1 text-[13px] font-medium transition-colors", tab === k ? (k === "safety" ? "bg-destructive text-white" : k === "info" ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground") : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>

          {tab === "unani" && (r.unani.length ? <div className="grid lg:grid-cols-2 gap-2.5">{r.unani.map((c) => <div key={c.tagId}>{renderCard(c)}</div>)}</div> : <p className="text-sm text-muted-foreground">No eligible Unani medicine found for the recorded findings.</p>)}
          {tab === "supplements" && (r.supplements.length ? <div className="grid lg:grid-cols-2 gap-2.5">{r.supplements.map((c) => <div key={c.tagId}>{renderCard(c)}</div>)}</div> : <p className="text-sm text-muted-foreground">No supplement candidates.</p>)}
          {tab === "safety" && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Current medicines (allopathic shown for safety only)</p>
                {r.currentMeds.length ? (
                  <div className="flex flex-wrap gap-1.5">{r.currentMeds.map((m) => <span key={m.label} className={cn("rounded-full border px-2.5 py-0.5 text-xs", m.matched ? "border-border/60" : "border-amber-500/50 text-amber-700 dark:text-amber-400")} title={m.matched ? "Found in the database — interactions checked" : "Not found in the database — interactions not checked"}>{m.label}{!m.matched && " ⚠"}</span>)}</div>
                ) : <p className="text-xs text-muted-foreground">None recorded.</p>}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Excluded for safety ({r.excluded.length})</p>
                {r.excluded.length ? (
                  <ul className="space-y-1">{r.excluded.map((e) => (
                    <li key={e.tagId} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs"><span className="font-semibold">{e.label}</span> <span className="text-destructive">— {e.reason}</span>{!e.verified && <span className="text-muted-foreground"> (unverified)</span>}</li>
                  ))}</ul>
                ) : <p className="text-xs text-muted-foreground">Nothing excluded.</p>}
              </div>
            </div>
          )}
          {tab === "info" && (r.infoNeeded.length ? <ul className="space-y-1.5">{r.infoNeeded.map((x) => <li key={x} className="flex gap-2 text-sm"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />{x}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing missing for this check.</p>)}

          <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            Decision support for the treating doctor — not a prescription. Candidates come only from the clinic&apos;s database; indications and safety data are still being clinically reviewed and are marked &ldquo;Unverified&rdquo; until verified. Safety checks run before anything is shown and can&apos;t be overridden by ranking{data?.method === "ranked" ? " (order assisted by Hakeem Insight)" : ""}. No doses are suggested.
          </p>
        </>
      )}
    </Panel>
  );
}

function IlajTab({ state, patientId, visitId }: { state: TashkheesState; patientId: string; visitId: string }) {
  const { dossier: d, set, options, herbs } = state;
  const [warnings, setWarnings] = useState<Record<string, Warn[]>>({});
  const tagKey = d.prescriptions.map((p) => p.tagId).filter(Boolean).join(",");
  const reqRef = useRef(0);

  // Safety check whenever the set of catalogue medicines changes.
  useEffect(() => {
    const ids = tagKey ? tagKey.split(",") : [];
    const n = ++reqRef.current;
    if (!ids.length) { queueMicrotask(() => setWarnings({})); return; }
    api.post<{ warnings: Record<string, Warn[]> }>("/api/facility/tashkhees/prescription-check", { patientId, visitId, tagIds: ids })
      .then((r) => { if (n === reqRef.current) setWarnings(r.warnings); })
      .catch(() => {});
  }, [tagKey, patientId, visitId]);

  const [foodQuery, setFoodQuery] = useState("");
  const fq = foodQuery.trim().toLowerCase();
  const foods = (options?.ghiza || []).filter((f) => !fq || f.label.toLowerCase().includes(fq) || (f.description || "").toLowerCase().includes(fq) || (f.localName || "").toLowerCase().includes(fq));
  const setFood = (label: string, where: "rec" | "avoid") => {
    const rec = d.ghizaRecommended.filter((x) => x !== label);
    const avoid = d.ghizaAvoid.filter((x) => x !== label);
    const was = where === "rec" ? d.ghizaRecommended.includes(label) : d.ghizaAvoid.includes(label);
    if (!was) (where === "rec" ? rec : avoid).push(label);
    set({ ghizaRecommended: rec, ghizaAvoid: avoid });
  };
  const updRx = (i: number, patch: Partial<PrescriptionLine>) => set({ prescriptions: d.prescriptions.map((p, n) => (n === i ? { ...p, ...patch } : p)) });
  const updTd = (i: number, patch: Partial<TadbeerLine>) => set({ tadbeer: d.tadbeer.map((t, n) => (n === i ? { ...t, ...patch } : t)) });
  const forms = (options?.dosage_form || []).map((o) => o.label);
  const timings = (options?.timing || []).map((o) => o.label);

  return (
    <div className="space-y-5">
      {/* Ilaj-bil-Ghiza */}
      <Panel icon={Utensils} tour="dossier.ghiza" title="Ilaj-bil-Ghiza — Diet" hint="Foods to recommend and Parhez (restrictions), with meal guidance."
        aside={<Badge variant="outline" className="mt-1 shrink-0">{d.ghizaRecommended.length} advised · {d.ghizaAvoid.length} Parhez</Badge>}>
        <GhizaEngineCard state={state} visitId={visitId} />
        {(d.ghizaRecommended.length > 0 || d.ghizaAvoid.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-3">
            {([["rec", "Recommended", d.ghizaRecommended], ["avoid", "Parhez (avoid)", d.ghizaAvoid]] as const).map(([k, title, list]) => (
              <div key={k} className={cn("rounded-xl border p-3", k === "rec" ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5")}>
                <p className={cn("text-[13px] font-semibold mb-1.5", k === "rec" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive")}>{title} · {list.length}</p>
                {list.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {list.map((l) => (
                      <span key={l} className={cn("inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-[13px]", k === "rec" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : "border-destructive/40 text-destructive")}>
                        {l}
                        <button type="button" onClick={() => setFood(l, k)} aria-label={`Remove ${l}`} className="rounded-full p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                ) : <p className="text-[13px] text-muted-foreground">None yet</p>}
              </div>
            ))}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)} placeholder={`Search ${options?.ghiza?.length ?? 0} foods — e.g. barley, milk, dates…`} className="h-11 pl-10 bg-background/60" aria-label="Search foods" />
        </div>
        <div className="rounded-xl border border-border/50 divide-y divide-border/40 max-h-[340px] overflow-y-auto">
          {foods.length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground">No food matches &quot;{foodQuery}&quot;.</p>}
          {foods.map((f) => {
            const rec = d.ghizaRecommended.includes(f.label);
            const avoid = d.ghizaAvoid.includes(f.label);
            return (
              <div key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <FoodThumb src={f.imageUrl} alt={f.label} credit={f.imageCredit} className="h-11 w-11" />
                  <div className="min-w-0"><p className="text-sm font-medium">{f.label}{f.foodMizaj && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{f.foodMizaj}</span>}</p>{f.description && <p className="text-[13px] text-muted-foreground">{f.description}</p>}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => setFood(f.label, "rec")} className={cn("rounded-md border px-2.5 py-1 text-xs", rec ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-border/60 text-muted-foreground hover:text-foreground")}>Recommend</button>
                  <button type="button" onClick={() => setFood(f.label, "avoid")} className={cn("rounded-md border px-2.5 py-1 text-xs", avoid ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border/60 text-muted-foreground hover:text-foreground")}>Parhez</button>
                </div>
              </div>
            );
          })}
        </div>
        <FloatingTextarea id="ghiza-note" label="Meal timing & hydration guidance" rows={2} value={d.ghizaNote ?? ""} onChange={(e) => set({ ghizaNote: e.target.value })}
          title="e.g. 4 small meals, no iced water after meals" />
      </Panel>

      {/* Clinical decision support — doctors only, pilot switch in Admin */}
      <CdsPanel state={state} visitId={visitId} />

      {/* Ilaj-bil-Dawa */}
      <Panel icon={Pill} tour="dossier.dawa" title="Ilaj-bil-Dawa — Medicines" hint="Formulations from Unani Medicine. Doses are the Hakim's own entry."
        aside={<HerbPicker herbs={herbs} onPick={(h) => set({ prescriptions: [...d.prescriptions, { tagId: h.id, name: h.label, form: h.forms[0] ?? "", dose: "", timing: "", duration: "", adjuvant: "", instructions: "" }] })} />}>
        {d.prescriptions.length === 0 ? <p className="text-sm text-muted-foreground">No medicines added yet.</p> : (
          <div className="space-y-3">
            {d.prescriptions.map((p, i) => {
              const w = p.tagId ? warnings[p.tagId] || [] : [];
              const formOptions = [...new Set([...(herbs.find((h) => h.id === p.tagId)?.forms || []), ...forms])];
              return (
                <div key={i} className={cn("rounded-xl border p-3 space-y-2.5", w.some((x) => x.level === "high") ? "border-destructive/40 bg-card" : "border-border/50 bg-card")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[15px] font-semibold flex items-center gap-1.5"><Leaf className="h-4 w-4 text-primary" />{p.name}{!p.tagId && <Badge variant="outline" className="text-[11px] font-normal">not in catalogue</Badge>}</p>
                    <button type="button" onClick={() => set({ prescriptions: d.prescriptions.filter((_, n) => n !== i) })} aria-label={`Remove ${p.name}`} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {/* One line where there's room (six fields), otherwise three per row. */}
                  <div className="@container"><div className="grid grid-cols-2 @min-[28rem]:grid-cols-3 @min-[34rem]:grid-cols-[0.9fr_0.75fr_1.3fr_0.95fr_0.95fr_1.2fr] gap-x-2 gap-y-4 pt-2">
                    <FloatingSelect id={`rx-form-${i}`} label="Form" value={p.form || ""} onValueChange={(v) => updRx(i, { form: v })} placeholder="Choose">
                      {sortLabels(formOptions).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </FloatingSelect>
                    <FloatingField id={`rx-dose-${i}`} label="Dose" value={p.dose} onChange={(e) => updRx(i, { dose: e.target.value })} title="e.g. 5 g" />
                    <FloatingSelect id={`rx-timing-${i}`} label="Timing" value={p.timing || ""} onValueChange={(v) => updRx(i, { timing: v })} placeholder="Choose">
                      {timings.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </FloatingSelect>
                    <FloatingField id={`rx-duration-${i}`} label="Duration" value={p.duration} onChange={(e) => updRx(i, { duration: e.target.value })} title="e.g. 14 days" />
                    <FloatingField id={`rx-with-${i}`} label="Badraqa" value={p.adjuvant} onChange={(e) => updRx(i, { adjuvant: e.target.value })} title="Badraqa / take with — e.g. lukewarm water" />
                    <FloatingField id={`rx-instr-${i}`} label="Instructions" maxLength={500} value={p.instructions} onChange={(e) => updRx(i, { instructions: e.target.value })} title={p.instructions || "Instructions"} />
                  </div></div>
                  {w.length > 0 && (
                    <div className="space-y-1">
                      {w.map((x, n) => (
                        <p key={n} className={cn("text-[13px] flex items-start gap-1.5", x.level === "high" ? "text-destructive" : x.level === "caution" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{x.text}{!x.verified && <span className="opacity-70"> (from the herb&apos;s reference profile — unverified)</span>}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">Safety notes compare each herb&apos;s reference profile with this patient&apos;s recorded allergies, current medicines, sex and age. They are prompts to check — the Hakim decides.</p>
          </div>
        )}
      </Panel>

      {/* Ilaj-bil-Tadbeer */}
      <Panel icon={HeartPulse} tour="dossier.tadbeer" title="Ilaj-bil-Tadbeer — Regimenal Therapy" hint="Hijama, Dalk, Hammam and other regimens."
        aside={
          <Select value="" onValueChange={(v) => set({ tadbeer: [...d.tadbeer, { label: v, frequency: "", duration: "", notes: "" }] })}>
            <SelectTrigger className="h-9 w-48 bg-background/60"><SelectValue placeholder="+ Add regimen" /></SelectTrigger>
            <SelectContent>{(options?.tadbeer || []).filter((o) => !d.tadbeer.some((t) => t.label === o.label)).map((o) => <SelectItem key={o.id} value={o.label}>{o.label}{o.description ? ` — ${o.description}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        }>
        {d.tadbeer.length === 0 ? <p className="text-sm text-muted-foreground">No regimens added yet.</p> : (
          <div className="space-y-2">
            {d.tadbeer.map((t, i) => (
              <div key={t.label} className="rounded-xl border border-border/50 bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[15px] font-semibold">{t.label} <span className="text-[13px] font-normal text-muted-foreground">{options?.tadbeer?.find((o) => o.label === t.label)?.description}</span></p>
                  <button type="button" onClick={() => set({ tadbeer: d.tadbeer.filter((_, n) => n !== i) })} aria-label={`Remove ${t.label}`} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="grid sm:grid-cols-3 gap-2 pt-2">
                  <FloatingField id={`td-freq-${i}`} label="Frequency" value={t.frequency} onChange={(e) => updTd(i, { frequency: e.target.value })} title="e.g. weekly" />
                  <FloatingField id={`td-dur-${i}`} label="Duration" value={t.duration} onChange={(e) => updTd(i, { duration: e.target.value })} title="e.g. 3 sessions" />
                  <FloatingField id={`td-notes-${i}`} label="Site / notes" value={t.notes} onChange={(e) => updTd(i, { notes: e.target.value })} />
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
  return (
    <Panel icon={CalendarDays} tour="dossier.handover" title="Prognosis & Handover" hint="Expected course, follow-up and the handover note."
      aside={d.status === "finalized" ? <Badge variant="outline" className="mt-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">Finalised</Badge> : undefined}>
      <div><Label>Prognosis (Inzar)</Label>
        <Chips items={(options?.prognosis || []).map((o) => ({ label: o.label, sub: o.description }))} selected={d.prognosis ? [d.prognosis] : []}
          onToggle={(l) => set({ prognosis: d.prognosis === l ? null : l })} /></div>
      <div className="grid sm:grid-cols-[220px_1fr] gap-3 pt-1">
        <div className="relative h-14 rounded-lg border border-input focus-within:border-primary flex items-center transition-colors">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 ml-3.5" />
          <input id="followup-date" type="date" value={d.followUpDate ?? ""} onChange={(e) => set({ followUpDate: e.target.value || null })}
            className="peer h-full flex-1 min-w-0 bg-transparent pl-2.5 pr-3 text-base font-medium outline-none" />
          {/* A date box always shows its dd/mm/yyyy mask, so the label sits on the border. */}
          <label htmlFor="followup-date" className="pointer-events-none absolute left-3 top-0 -translate-y-1/2 bg-card px-1.5 whitespace-nowrap text-sm font-semibold text-muted-foreground peer-focus:text-primary">Follow-up date</label>
        </div>
        <FloatingField id="followup-note" label="Follow-up plan" maxLength={500} value={d.followUpNote ?? ""} onChange={(e) => set({ followUpNote: e.target.value })}
          title="e.g. Re-assess Nabz, tongue coating and bowel habit" />
      </div>
      <div><Label>Priority</Label>
        <Segmented value={d.priority} options={PRIORITIES} onChange={(v) => set({ priority: v ?? "routine" })} /></div>
      <FloatingTextarea id="urgent-directives" label="🚨 Urgent directives for the patient" rows={2} value={d.urgentDirectives ?? ""} onChange={(e) => set({ urgentDirectives: e.target.value })}
        title="Warning signs that need immediate attention — e.g. vomiting blood, severe abdominal pain" />
      <FloatingTextarea id="handover-note" label="Handover note" rows={4} value={d.handoverNote ?? ""} onChange={(e) => set({ handoverNote: e.target.value })}
        title="Summary for the treating / senior Hakim — presentation, key findings, diagnosis and plan" />
      {d.status === "finalized" && d.finalizedByName && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5 text-emerald-500" /> Finalised by {d.finalizedByName}{d.finalizedAt && ` · ${new Date(d.finalizedAt).toLocaleString()}`}</p>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- shell

function Loading() {
  return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
}

const TABS = [
  { key: "dalail", label: "Dala'il", short: "Dala'il", sub: "Examination", icon: Stethoscope },
  { key: "tashkhees", label: "Tashkhees", short: "Tashkhees", sub: "Diagnosis", icon: FileSignature },
  { key: "usool", label: "Usool-e-Ilaj", short: "Usool", sub: "Principles", icon: ClipboardCheck },
  { key: "ilaj", label: "Ilaj", short: "Ilaj", sub: "Ghiza · Dawa · Tadbeer", short2: "Treatment", icon: Leaf },
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
  const done: Record<string, boolean> = {
    // Adaptive selection means not every question is shown — any recorded finding counts.
    dalail: state.dalail.progress.answered > 0,
    tashkhees: !!d.mizajAsli && !!d.suMizajQuality,
    usool: d.usool.length > 0,
    ilaj: d.prescriptions.length + d.tadbeer.length + d.ghizaRecommended.length + d.ghizaAvoid.length > 0,
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
    if (state.loadError) return <LoadFailed what="the dossier" detail={state.loadError} onRetry={state.reload} />;
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
          style={{ left: floatBox.left, width: floatBox.width }} role="navigation" aria-label="Jump to step">
          {TABS.map((t, i) => {
            const on = inView === t.key;
            return (
              <button key={t.key} type="button" onClick={() => jump(t.key)} title={`${i + 1}. ${t.label} — ${t.sub}`}
                className={cn("flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium transition-colors",
                  on ? "bg-primary text-primary-foreground" : done[t.key] ? "text-emerald-700 dark:text-emerald-400 hover:bg-muted" : "text-muted-foreground hover:bg-muted")}>
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate hidden sm:inline">{t.short}</span>
                {done[t.key] && <Check className="h-3 w-3 shrink-0" />}
              </button>
            );
          })}
          <span className="hidden md:inline shrink-0 border-l border-border/60 pl-2 text-xs tabular-nums text-muted-foreground">{doneCount}/{TABS.length}</span>
        </div>
      )}

      <Card ref={headerRef} className="p-5 border-border/50 bg-card/60 gap-0">
        <SectionHeading
          icon={FileSignature}
          title="Tashkhees & Handover Dossier"
          right={
            <span className="flex items-center gap-1.5 shrink-0">
              <Badge variant="outline">{doneCount} of {TABS.length} steps</Badge>
              {d.status === "finalized"
                ? <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/40">Finalised</Badge>
                : <Badge variant="outline">Draft</Badge>}
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
              <button key={t.key} type="button" onClick={() => jump(t.key)} title={`${i + 1}. ${t.label} — ${t.sub}${ok ? " · recorded" : ""}`}
                className={cn("flex min-w-[7rem] @xl:min-w-0 flex-1 basis-0 items-center gap-1.5 @3xl:gap-2 rounded-xl border px-1.5 @3xl:px-2 py-1.5 text-left transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border/50 bg-background/40 hover:border-primary/40")}>
                <span className={cn("relative h-8 w-8 @3xl:h-9 @3xl:w-9 shrink-0 rounded-full border-2 flex items-center justify-center",
                  ok ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : on ? "border-primary text-primary" : "border-muted text-muted-foreground")}>
                  <t.icon className="h-4 w-4" />
                  {ok && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-card" aria-label="Recorded"><Check className="h-2 w-2" /></span>}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-xs @3xl:text-[13px] font-semibold leading-tight", on && "text-primary")}>{t.short}</span>
                  <span className={cn("block truncate text-[11px] @3xl:text-xs leading-tight", ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{"short2" in t ? t.short2 : t.sub}</span>
                </span>
              </button>
            );
          })}
        </div></div>
      </Card>

      <section ref={(el) => { refs.current.dalail = el; }}><DalailTab state={state} visitId={visitId} /></section>
      <section ref={(el) => { refs.current.tashkhees = el; }}><TashkheesTab state={state} visitId={visitId} /></section>
      <section ref={(el) => { refs.current.usool = el; }}><UsoolTab state={state} visitId={visitId} /></section>
      <section ref={(el) => { refs.current.ilaj = el; }}><IlajTab state={state} patientId={patientId} visitId={visitId} /></section>
      <section ref={(el) => { refs.current.handover = el; }}><HandoverTab state={state} /></section>

      {/* Where to next */}
      <div className={cn("flex items-center justify-between gap-3 flex-wrap rounded-xl border px-4 py-3",
        firstOpen ? "border-dashed border-border/60 bg-card/40" : "border-emerald-500/40 bg-emerald-500/5")}>
        <p className="text-[13px] text-muted-foreground">
          {firstOpen
            ? <>{TABS.length - doneCount} {TABS.length - doneCount === 1 ? "step is" : "steps are"} still open — next: <span className="font-medium text-foreground">{firstOpen.label}</span>.</>
            : <span className="font-medium text-emerald-700 dark:text-emerald-400">All five steps recorded — Save Draft or Finalise &amp; hand over below.</span>}
        </p>
        {firstOpen && <Button size="sm" variant="outline" onClick={() => jump(firstOpen.key)}>Go to {firstOpen.label} <ArrowRight className="h-3.5 w-3.5" /></Button>}
      </div>
    </div>
  );
}
