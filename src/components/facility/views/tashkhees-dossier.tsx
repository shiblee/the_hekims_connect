"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AKHLAT, isAnswered, questionVisible, toPercent, zeroPoints, type AsbabAnswer, type AsbabQuestionCfg, type HumourPoints, type Humour } from "@/lib/asbab";
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
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, ClipboardCheck, FileSignature, HeartPulse, Leaf, Loader2, Pill, Plus,
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

const MIZAJ_FOR: Record<Humour, string> = { safra: "Safrawi", dam: "Damawi", balgham: "Balghami", sauda: "Saudawi" };

function Panel({ icon: Icon, title, aside, children }: { icon: typeof Activity; title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-5 border-border/50 bg-card/60 gap-4">
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
  items: { label: string; sub?: string | null }[]; selected: string[]; onToggle: (label: string) => void; tone?: "emerald" | "red";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = selected.includes(it.label);
        return (
          <button key={it.label} type="button" onClick={() => onToggle(it.label)} aria-pressed={on} title={it.sub || undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors text-left",
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

function DalailRow({ q, value, onChange }: { q: AsbabQuestionCfg; value: AsbabAnswer | undefined; onChange: (v: AsbabAnswer) => void }) {
  const sel = Array.isArray(value) ? value : [];
  const toggle = (l: string) => onChange(q.type === "multi_select" ? (sel.includes(l) ? sel.filter((x) => x !== l) : [...sel, l]) : (sel.includes(l) ? [] : [l]));
  return (
    <div className="grid md:grid-cols-[220px_1fr] gap-x-4 gap-y-2 py-3 border-t border-border/40 first:border-t-0">
      <div>
        <p className="text-[15px] font-medium">{q.label}{q.required && <span className="text-destructive"> *</span>}</p>
        {q.labelLocal && <p className="text-[13px] text-muted-foreground">{q.labelLocal}</p>}
      </div>
      {q.type === "text"
        ? <FloatingField id={`dalail-${q.id}`} label="Describe the finding" maxLength={500} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        : <Chips items={q.options.map((o) => ({ label: o.label }))} selected={sel} onToggle={toggle} />}
    </div>
  );
}

const DALAIL_VIEW_KEY = "hekims-dalail-view";

/**
 * Dala'il — every examination section on one screen (Nabz, Baul, Baraz,
 * Lisan, inspection), with a jump bar. "Key signs" (default) narrows each
 * section to its required findings; "All" shows every sign.
 */
function DalailTab({ state }: { state: TashkheesState }) {
  const { pillars, answers, setAnswer, drift } = state.dalail;
  const [view, setViewState] = useState<"key" | "all">(() => {
    try { return localStorage.getItem(DALAIL_VIEW_KEY) === "all" ? "all" : "key"; } catch { return "key"; }
  });
  const setView = (v: "key" | "all") => { setViewState(v); try { localStorage.setItem(DALAIL_VIEW_KEY, v); } catch { /* per-viewer convenience only */ } };
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  if (!pillars) return <Loading />;
  if (!pillars.length) return <Card className="p-5 text-sm text-muted-foreground">No examination sections are enabled — configure them in Admin → Meta → Tashkhees &amp; Ilaj.</Card>;

  const shownQs = (p: (typeof pillars)[number]) => p.questions.filter((q) => questionVisible(q, answers));
  const keyQs = (p: (typeof pillars)[number]) => { const sh = shownQs(p); const req = sh.filter((q) => q.required); return req.length ? req : sh.slice(0, 1); };
  const qsFor = (p: (typeof pillars)[number]) => (view === "key" ? keyQs(p) : shownQs(p));
  const all = pillars.flatMap((p) => qsFor(p));
  const answeredN = all.filter((q) => isAnswered(answers[q.id])).length;
  const keyTotal = pillars.reduce((n, p) => n + keyQs(p).length, 0);
  const allTotal = pillars.reduce((n, p) => n + shownQs(p).length, 0);
  const hasSigns = drift && AKHLAT.some((h) => drift.total[h.key] > 0);
  const jump = (k: string) => { const el = refs.current[k]; if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 24, behavior: "smooth" }); };

  return (
    <Panel icon={Stethoscope} title="Dala'il — Clinical Signs"
      aside={
        <span className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <span className="inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5" role="group" aria-label="Which signs to show">
            {([["key", `Key signs · ${keyTotal}`], ["all", `All · ${allTotal}`]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setView(m)} aria-pressed={view === m}
                title={m === "key" ? "Only the required finding(s) of each examination" : "Every examination finding"}
                className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors", view === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </span>
          <Badge variant="outline" className="tabular-nums">{answeredN} of {all.length} recorded</Badge>
        </span>
      }>
      {/* Jump bar */}
      <div className="flex flex-wrap gap-1.5">
        {pillars.map((p) => {
          const qs = qsFor(p);
          const a = qs.filter((q) => isAnswered(answers[q.id])).length;
          const done = qs.length > 0 && a === qs.length;
          return (
            <button key={p.key} type="button" onClick={() => jump(p.key)}
              className={cn("rounded-lg border px-3 py-1.5 text-sm transition-colors",
                done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border/50 bg-background/40 hover:border-primary/40")}>
              {p.label} <span className="text-xs tabular-nums opacity-80">{done ? "✓" : `${a}/${qs.length}`}</span>
            </button>
          );
        })}
      </div>

      {/* Every section, stacked */}
      <div className="space-y-4">
        {pillars.map((p) => {
          const qs = qsFor(p);
          if (!qs.length) return null;
          const a = qs.filter((q) => isAnswered(answers[q.id])).length;
          const done = a === qs.length;
          return (
            <div key={p.key} ref={(el) => { refs.current[p.key] = el; }}
              className={cn("rounded-xl border border-l-4 bg-background/30 px-4 pt-3 pb-1", done ? "border-border/50 border-l-emerald-500/70" : "border-border/50 border-l-primary/40")}>
              <div className="flex items-center justify-between gap-2 pb-1">
                <p className="text-[15px] font-semibold">{p.label} <span className="text-[13px] font-normal text-muted-foreground">· {p.english}</span></p>
                <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs tabular-nums", done ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-border/60 text-muted-foreground")}>{done ? "✓ Done" : `${a}/${qs.length}`}</span>
              </div>
              {qs.map((q) => <DalailRow key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />)}
            </div>
          );
        })}
      </div>

      {view === "key" && allTotal > keyTotal && (
        <p className="text-[13px] text-muted-foreground">
          Key signs are enough for the diagnosis. <button type="button" onClick={() => setView("all")} className="text-primary font-medium hover:underline">Show all {allTotal} signs</button> for a finer reading.
        </p>
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

/** Combines the three humoral readings recorded so far into one suggestion the Hakim can apply. */
function SynthesisCard({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const [sources, setSources] = useState<{ stage3: HumourPoints | null; asbab: HumourPoints | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.get<{ summary: any }>(`/api/facility/visits/${visitId}/clinical-summary`).then(({ summary }) => {
      if (cancelled) return;
      const h = summary.humoral;
      setSources({
        stage3: h ? { safra: Math.round(h.safraPercent), dam: Math.round(h.damPercent), balgham: Math.round(h.balghamPercent), sauda: Math.round(h.saudaPercent) } : null,
        asbab: summary.asbab?.drift?.percent ?? null,
      });
    }).catch(() => setSources({ stage3: null, asbab: null }));
    return () => { cancelled = true; };
  }, [visitId]);

  const dalailPct = state.dalail.drift && AKHLAT.some((h) => state.dalail.drift!.total[h.key] > 0) ? state.dalail.drift.percent : null;
  const rows = [
    { key: "stage3", label: "Complaint humoral assessment (Stages 2–3)", pct: sources?.stage3 ?? null },
    { key: "asbab", label: "Asbab-e-Sittah lifestyle drift (Stage 4)", pct: sources?.asbab ?? null },
    { key: "dalail", label: "Dala'il clinical signs (this stage)", pct: dalailPct },
  ];
  const present = rows.filter((r) => r.pct);
  const combined = useMemo(() => {
    const sum = zeroPoints();
    for (const r of present) for (const h of AKHLAT) sum[h.key] += r.pct![h.key] || 0;
    return toPercent(sum);
  }, [present]);
  const dominant = present.length ? AKHLAT.reduce((a, b) => (combined[b.key] > combined[a.key] ? b : a)) : null;
  const constitutional = dalailPct ? AKHLAT.reduce((a, b) => (dalailPct[b.key] > dalailPct[a.key] ? b : a)) : null;

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Akhlat Synthesis</p>
        <span className="text-xs text-muted-foreground">A guide — the Hakim decides</span>
      </div>
      {!sources ? <Loading /> : present.length === 0 ? (
        <p className="text-sm text-muted-foreground">No humoral readings yet — record Dala'il signs or complete the earlier stages.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            {rows.map((r) => (
              <div key={r.key} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
                <p className="text-xs text-muted-foreground mb-1.5 leading-snug">{r.label}</p>
                {r.pct ? <HumourBars pct={r.pct} compact /> : <p className="text-xs text-muted-foreground">Not recorded</p>}
              </div>
            ))}
          </div>
          {dominant && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Combined picture leans <span className={cn("font-semibold", dominant.text)}>{dominant.label} ({dominant.quality})</span> — suggests Su-e-Mizaj <span className="font-semibold">{MIZAJ_FOR[dominant.key]}</span>.</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => state.set({ suMizajQuality: MIZAJ_FOR[dominant.key] })}>Use as Su-e-Mizaj</Button>
            </div>
          )}
          {constitutional && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Constitutional signs (Dala'il) lean <span className={cn("font-semibold", constitutional.text)}>{MIZAJ_FOR[constitutional.key]}</span>.</span>
              <Button size="sm" variant="outline" className="h-7" onClick={() => state.set({ mizajAsli: MIZAJ_FOR[constitutional.key] })}>Use as Mizaj-e-Asli</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TashkheesTab({ state, visitId }: { state: TashkheesState; visitId: string }) {
  const { dossier: d, set, options } = state;
  const mizaj = (options?.mizaj || []).map((o) => ({ label: o.label, sub: o.localName || o.description }));
  return (
    <Panel icon={FileSignature} title="Tashkhees — Diagnosis" hint="Constitution, the present dyscrasia and the organs affected.">
      <SynthesisCard state={state} visitId={visitId} />
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

function UsoolTab({ state }: { state: TashkheesState }) {
  const { dossier: d, set, options } = state;
  return (
    <Panel icon={ClipboardCheck} title="Usool-e-Ilaj — Principles of Treatment" hint="The strategy the treatment below will follow.">
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
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Supplements & Herbs…" className="h-9 mb-2" />
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
      <Panel icon={Utensils} title="Ilaj-bil-Ghiza — Diet" hint="Foods to recommend and Parhez (restrictions), with meal guidance."
        aside={<Badge variant="outline" className="mt-1 shrink-0">{d.ghizaRecommended.length} advised · {d.ghizaAvoid.length} Parhez</Badge>}>
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
                <div className="min-w-0"><p className="text-sm font-medium">{f.label}</p>{f.description && <p className="text-[13px] text-muted-foreground">{f.description}</p>}</div>
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

      {/* Ilaj-bil-Dawa */}
      <Panel icon={Pill} title="Ilaj-bil-Dawa — Medicines" hint="Formulations from Supplements & Herbs. Doses are the Hakim's own entry."
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
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-2 gap-y-4 pt-2">
                    <FloatingSelect id={`rx-form-${i}`} label="Form" value={p.form || ""} onValueChange={(v) => updRx(i, { form: v })} placeholder="Choose">
                      {formOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </FloatingSelect>
                    <FloatingField id={`rx-dose-${i}`} label="Dose" value={p.dose} onChange={(e) => updRx(i, { dose: e.target.value })} title="e.g. 5 g" />
                    <FloatingSelect id={`rx-timing-${i}`} label="Timing" value={p.timing || ""} onValueChange={(v) => updRx(i, { timing: v })} placeholder="Choose">
                      {timings.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </FloatingSelect>
                    <FloatingField id={`rx-duration-${i}`} label="Duration" value={p.duration} onChange={(e) => updRx(i, { duration: e.target.value })} title="e.g. 14 days" />
                    <div className="sm:col-span-2"><FloatingField id={`rx-with-${i}`} label="Badraqa / take with" value={p.adjuvant} onChange={(e) => updRx(i, { adjuvant: e.target.value })} title="e.g. lukewarm water" /></div>
                    <div className="sm:col-span-2"><FloatingField id={`rx-instr-${i}`} label="Instructions" maxLength={500} value={p.instructions} onChange={(e) => updRx(i, { instructions: e.target.value })} /></div>
                  </div>
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
      <Panel icon={HeartPulse} title="Ilaj-bil-Tadbeer — Regimenal Therapy" hint="Hijama, Dalk, Hammam and other regimens."
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
    <Panel icon={CalendarDays} title="Prognosis & Handover" hint="Expected course, follow-up and the handover note."
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
  { key: "dalail", label: "Dala'il", sub: "Examination", icon: Stethoscope },
  { key: "tashkhees", label: "Tashkhees", sub: "Diagnosis", icon: FileSignature },
  { key: "usool", label: "Usool-e-Ilaj", sub: "Principles", icon: ClipboardCheck },
  { key: "ilaj", label: "Ilaj", sub: "Ghiza · Dawa · Tadbeer", icon: Leaf },
  { key: "handover", label: "Prognosis", sub: "& Handover", icon: CalendarDays },
] as const;

/** Centre of Stage 5: the Hakim's dossier in five steps. */
export function TashkheesDossierPanel({ state, patientId, visitId }: { state: TashkheesState; patientId: string; visitId: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("dalail");
  const d = state.dossier;
  const done: Record<string, boolean> = {
    dalail: state.dalail.progress.total > 0 && state.dalail.progress.missingRequired === 0 && state.dalail.progress.answered > 0,
    tashkhees: !!d.mizajAsli && !!d.suMizajQuality,
    usool: d.usool.length > 0,
    ilaj: d.prescriptions.length + d.tadbeer.length + d.ghizaRecommended.length + d.ghizaAvoid.length > 0,
    handover: !!d.prognosis || !!d.handoverNote,
  };
  const doneCount = Object.values(done).filter(Boolean).length;
  const tabIdx = TABS.findIndex((t) => t.key === tab);
  const go = (dir: -1 | 1) => { const t = TABS[tabIdx + dir]; if (t) { setTab(t.key); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  if (!state.options) {
    if (state.loadError) return <LoadFailed what="the dossier" detail={state.loadError} onRetry={state.reload} />;
    return <Card className="p-5 border-border/50 bg-card/60"><Loading /></Card>;
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 border-border/50 bg-card/60 gap-0">
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
        <div className="mt-3 mb-4 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / TABS.length) * 100}%` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TABS.map((t, i) => {
            const on = tab === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={cn("rounded-xl border px-3 py-2.5 text-left transition-colors", on ? "border-primary bg-primary/10" : "border-border/50 bg-background/40 hover:border-primary/30")}>
                <span className="flex items-center justify-between">
                  <t.icon className={cn("h-4 w-4", on ? "text-primary" : "text-muted-foreground")} />
                  {done[t.key] && <span className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center" aria-label="Recorded"><Check className="h-3 w-3" /></span>}
                </span>
                <span className={cn("block text-sm font-semibold mt-1.5", on && "text-primary")}>{i + 1}. {t.label}</span>
                <span className="block text-[13px] text-muted-foreground leading-tight">{t.sub}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {tab === "dalail" && <DalailTab state={state} />}
      {tab === "tashkhees" && <TashkheesTab state={state} visitId={visitId} />}
      {tab === "usool" && <UsoolTab state={state} />}
      {tab === "ilaj" && <IlajTab state={state} patientId={patientId} visitId={visitId} />}
      {tab === "handover" && <HandoverTab state={state} />}

      {/* Step through the dossier */}
      <div className="flex items-center justify-between gap-2">
        {tabIdx > 0 ? <Button variant="outline" size="sm" onClick={() => go(-1)}><ArrowLeft className="h-3.5 w-3.5" /> {TABS[tabIdx - 1].label}</Button> : <span />}
        {tabIdx < TABS.length - 1 && <Button variant="outline" size="sm" onClick={() => go(1)}>{TABS[tabIdx + 1].label} <ArrowRight className="h-3.5 w-3.5" /></Button>}
      </div>
    </div>
  );
}
