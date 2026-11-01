"use client";

import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AKHLAT, computeDrift, isAnswered, pillarIcon, questionVisible, toPercent, dominantOf,
  type AsbabAnswer, type AsbabPillarCfg, type AsbabQuestionCfg,
} from "@/lib/asbab";
import { Card } from "@/components/ui/card";
import { OptionCards, OptionDropdown } from "@/components/shared/option-dropdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FloatingField, FloatingTextarea } from "@/components/shared/floating-field";
import { SectionHeading } from "@/components/shared/section-heading";
import { LoadFailed, useNotice } from "@/components/shared/inline-notice";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2, Sparkles, Square, SquareCheck, Activity, Wind } from "lucide-react";
import { hintsFor } from "@/lib/asbab-hints";

interface Archived { pillarKey: string; question: string; value: AsbabAnswer }

/** Loads the Stage 4 configuration and this visit's answers; holds the working answers. */
export function useAsbabAssessment(visitId: string | undefined, framework: "asbab" | "dalail" = "asbab") {
  const [pillars, setPillars] = useState<AsbabPillarCfg[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, AsbabAnswer>>({});
  const [archived, setArchived] = useState<Archived[]>([]);
  const [status, setStatus] = useState<"draft" | "completed" | "new">("new");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState<"draft" | "complete" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // Save/validation messages, shown by the page beside its action bar.
  const msg = useNotice();
  const t = useTranslations("clinic.asbab");
  const tc = useTranslations("common");

  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    Promise.all([
      api.get<{ pillars: AsbabPillarCfg[] }>(`/api/facility/asbab/config?framework=${framework}`),
      api.get<{ assessment: { status: "draft" | "completed"; answers: Record<string, AsbabAnswer>; archived: Archived[] } | null }>(`/api/facility/visits/${visitId}/asbab?framework=${framework}`),
    ])
      .then(([c, a]) => {
        if (cancelled) return;
        setLoadError(null);
        setPillars(c.pillars);
        if (a.assessment) { setAnswers(a.assessment.answers); setArchived(a.assessment.archived); setStatus(a.assessment.status); }
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message || tc("network_error")); });
    return () => { cancelled = true; };
  }, [visitId, framework, reloadTick]);
  const reload = () => { setLoadError(null); setReloadTick((t) => t + 1); };

  const setAnswer = useCallback((qid: string, v: AsbabAnswer) => {
    setAnswers((cur) => ({ ...cur, [qid]: v }));
    setDirty(true);
  }, []);

  const drift = useMemo(() => (pillars ? computeDrift(pillars, answers) : null), [pillars, answers]);

  const progress = useMemo(() => {
    const per: Record<string, { answered: number; total: number; missingRequired: number }> = {};
    for (const p of pillars || []) {
      const shown = p.questions.filter((q) => questionVisible(q, answers));
      per[p.key] = {
        answered: shown.filter((q) => isAnswered(answers[q.id])).length,
        total: shown.length,
        missingRequired: shown.filter((q) => q.required && !isAnswered(answers[q.id])).length,
      };
    }
    const all = Object.values(per);
    return {
      per,
      answered: all.reduce((n, x) => n + x.answered, 0),
      total: all.reduce((n, x) => n + x.total, 0),
      missingRequired: all.reduce((n, x) => n + x.missingRequired, 0),
    };
  }, [pillars, answers]);

  const save = async (complete: boolean) => {
    if (!visitId) return false;
    setSaving(complete ? "complete" : "draft");
    try {
      const res = await api.post<{ status: "draft" | "completed" }>(`/api/facility/visits/${visitId}/asbab?framework=${framework}`, { answers, complete });
      setStatus(res.status === "completed" || status === "completed" ? "completed" : "draft");
      setDirty(false);
      msg.clear();
      return true;
    } catch (e: any) {
      msg.error(
        complete ? t("not_completed") : t("draft_not_saved"),
        t("answers_on_screen", { error: e.message || tc("network_error") }),
        { retry: () => save(complete), retryLabel: tc("retry") },
      );
      return false;
    } finally {
      setSaving(null);
    }
  };

  return { pillars, answers, setAnswer, archived, status, dirty, saving, drift, progress, save, msg, loadError, reload };
}

type AsbabState = ReturnType<typeof useAsbabAssessment>;

const LETTERS = "ABCDEFGHIJ";

/** A pillar's icon (looked up by key, outside render so it's a stable component). */
/** A question's frame: its own card, or a divided row inside a pillar card. */
function Wrap({ bare, className, children }: { bare?: boolean; className?: string; children: ReactNode }) {
  return bare
    ? <div className={cn("space-y-3 border-t border-border/40 py-4 first:border-t-0 first:pt-2 last:pb-1", className)}>{children}</div>
    : <Card className={className}>{children}</Card>;
}

function PillarIcon({ pillarKey, className }: { pillarKey: string; className?: string }) {
  return createElement(pillarIcon(pillarKey), { className });
}

export function QuestionCard({ q, index, count, pillarLabel, pillarKey, value, onChange, hints, bare, inline }: {
  q: AsbabQuestionCfg; index: number; count: number; pillarLabel: string; value: AsbabAnswer | undefined; onChange: (v: AsbabAnswer) => void;
  /** Show the pillar this question belongs to (Quick review lists all pillars together). */
  pillarKey?: string;
  /** option label → recorded finding that suggests it. */
  hints?: Record<string, string>;
  /** Render as a row inside a pillar card instead of its own card. */
  bare?: boolean;
  /** Show the option cards on the page instead of in a drop-down (Admin preview). */
  inline?: boolean;
}) {
  const t = useTranslations("clinic.asbab");
  const choice = q.type === "single_select" || q.type === "multi_select";
  const multiple = q.type === "multi_select";
  const selected = Array.isArray(value) ? value : [];
  const toggle = (label: string) => onChange(multiple
    ? (selected.includes(label) ? selected.filter((l) => l !== label) : [...selected, label])
    : (selected.includes(label) ? [] : [label]));
  const answered = isAnswered(value);
  const items = q.options.map((o) => ({ label: o.label, description: o.description }));
  const options = <OptionCards twoColumns options={items} selected={selected} multiple={multiple} onToggle={toggle} hints={hints} />;

  return (
    <Wrap bare={bare} className={cn(bare ? "" : "p-4 border-border/50 bg-card/60 gap-3", !bare && (answered ? "border-s-2 border-s-emerald-500/60" : q.required && "border-s-2 border-s-amber-500/60"))}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn(
          "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-semibold",
          answered ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
        )} aria-label={`${t("question_n", { n: index + 1, count })}${answered ? t("answered_suffix") : ""}`}>{index + 1}</span>
        <div className="min-w-[12rem] flex-1">
          {pillarKey && (
            <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <PillarIcon pillarKey={pillarKey} className="h-3.5 w-3.5" /> {pillarLabel}
            </p>
          )}
          <p className="text-base font-semibold leading-snug">
            {q.label}{q.required && <span className="text-destructive">&nbsp;*</span>}
            {q.labelLocal && <span className="ms-1.5 text-[13px] font-normal text-muted-foreground">· {q.labelLocal}</span>}
          </p>
          {q.helpText && <p className="text-[13px] text-muted-foreground mt-0.5">{q.helpText}</p>}
        </div>
        {q.required && !answered && (inline || !choice) && <Badge variant="outline" className="shrink-0 text-[11px] font-normal border-amber-500/40 text-amber-700 dark:text-amber-400">{t("required")}</Badge>}
        {choice && !inline && (
          <div className="w-full sm:w-[60%] sm:shrink-0">
            <OptionDropdown id={`asbab-${q.id}`} options={items} value={selected} multiple={multiple} hints={hints} onChange={onChange} />
          </div>
        )}
      </div>

      {choice ? (inline ? options : null) : q.type === "numeric" ? (
        <div className="max-w-xs">
          <FloatingField id={`asbab-${q.id}`} label={t("answer_number")} type="number" min={0} step="any" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : (
        <FloatingTextarea id={`asbab-${q.id}`} label={t("answer")} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} rows={2} />
      )}
    </Wrap>
  );
}

/** Findings already recorded for this visit (Stages 1–3), as short phrases for answer hints. */
function useRecordedFindings(visitId: string | undefined) {
  const [findings, setFindings] = useState<string[]>([]);
  useEffect(() => {
    if (!visitId) return;
    let cancelled = false;
    api.get<{ summary: any }>(`/api/facility/visits/${visitId}/clinical-summary`).then(({ summary: s }) => {
      if (cancelled) return;
      setFindings([
        ...(s.complaints || []).flatMap((c: any) => [c.label, ...(c.aggravating || []).map((a: string) => `Worse with ${a}`), ...(c.relieving || [])]),
        ...(s.chronology?.patterns || []),
        ...(s.acuteSymptoms || []),
        ...(s.residentNotes || []),
      ].filter(Boolean));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [visitId]);
  return findings;
}

const MODE_KEY = "hekims-asbab-view";

/** Stage 4 table row: # · question (local term, help) · answer — no card of its own. */
function QuestionRow({ q, n, count, value, onChange, hints }: {
  q: AsbabQuestionCfg; n: number; count: number; value: AsbabAnswer | undefined; onChange: (v: AsbabAnswer) => void; hints?: Record<string, string>;
}) {
  const t = useTranslations("clinic.asbab");
  const choice = q.type === "single_select" || q.type === "multi_select";
  const selected = Array.isArray(value) ? value : [];
  const answered = isAnswered(value);
  const text = typeof value === "string" ? value : "";
  return (
    <div id={`asbab-q-${q.id}`} className="grid scroll-mt-24 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-3 py-2 md:grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1.15fr)]">
      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
        answered ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : q.required ? "bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/40 dark:text-amber-400" : "bg-muted text-muted-foreground")}
        aria-label={`${t("question_n", { n, count })}${answered ? t("answered_suffix") : ""}`}>{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">
          {q.label}{q.required && <span className="text-destructive" title={t("required")}>&nbsp;*</span>}
          {q.labelLocal && <span className="ms-1.5 text-xs font-normal text-muted-foreground">· {q.labelLocal}</span>}
        </p>
        {q.helpText && <p className="text-xs leading-snug text-muted-foreground">{q.helpText}</p>}
      </div>
      <div className="col-start-2 min-w-0 md:col-start-auto">
        {choice ? (
          <OptionDropdown compact id={`asbab-${q.id}`} options={q.options.map((o) => ({ label: o.label, description: o.description }))}
            value={selected} multiple={q.type === "multi_select"} hints={hints} onChange={onChange} />
        ) : q.type === "numeric" ? (
          <Input id={`asbab-${q.id}`} type="number" min={0} step="any" value={text} onChange={(e) => onChange(e.target.value)}
            placeholder={t("answer_number")} className="h-9 max-w-48" />
        ) : (
          <Textarea id={`asbab-${q.id}`} rows={1} value={text} onChange={(e) => onChange(e.target.value)}
            placeholder={t("answer")} className="min-h-9 resize-y py-1.5 text-sm" />
        )}
      </div>
    </div>
  );
}

/**
 * Centre of Stage 4: every question in one compact table, grouped by pillar
 * (Factor · # · Question · Answer), with no box per question or pillar. "Key
 * only" narrows it to each pillar's key question (marked Required in Admin) —
 * enough to complete the stage. Options backed by something already recorded
 * for the visit are marked "Suggested" (never selected automatically).
 */
export function AsbabAssessmentPanel({ state, visitId }: { state: AsbabState; visitId?: string }) {
  const { pillars, answers, setAnswer, archived, status } = state;
  const [view, setViewState] = useState<"all" | "key">(() => {
    try { return localStorage.getItem(MODE_KEY) === "key" ? "key" : "all"; } catch { return "all"; }
  });
  const setView = (v: "all" | "key") => { setViewState(v); try { localStorage.setItem(MODE_KEY, v); } catch { /* per-viewer convenience only */ } };
  const findings = useRecordedFindings(visitId);
  const t = useTranslations("clinic.asbab");

  if (!pillars) {
    if (state.loadError) return <LoadFailed what={t("the_assessment")} detail={state.loadError} onRetry={state.reload} />;
    return <Card className="p-5 border-border/50 bg-card/60"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}</div></Card>;
  }
  if (!pillars.length) {
    return <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">{t("no_pillars")}</Card>;
  }

  // Key questions: those marked Required; a pillar with none uses its first question.
  const shownQs = (p: AsbabPillarCfg) => p.questions.filter((q) => questionVisible(q, answers));
  const keyQs = (p: AsbabPillarCfg) => { const sh = shownQs(p); const req = sh.filter((q) => q.required); return req.length ? req : sh.slice(0, 1); };
  const qsFor = (p: AsbabPillarCfg) => (view === "key" ? keyQs(p) : shownQs(p));
  const all = pillars.flatMap((p) => qsFor(p).map((q) => ({ p, q })));
  const answeredN = all.filter(({ q }) => isAnswered(answers[q.id])).length;
  const keyTotal = pillars.reduce((n, p) => n + keyQs(p).length, 0);
  const allTotal = pillars.reduce((n, p) => n + shownQs(p).length, 0);
  const hintCount = all.filter(({ q }) => !isAnswered(answers[q.id]) && Object.keys(hintsFor(q, findings)).length > 0).length;
  const numberOf = new Map(all.map(({ q }, i) => [q.id, i + 1]));
  const firstOpen = all.find(({ q }) => !isAnswered(answers[q.id]));
  const jumpTo = (qid: string) => {
    const el = document.getElementById(`asbab-q-${qid}`);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
    el.querySelector<HTMLElement>("button, input, textarea")?.focus({ preventScroll: true });
  };
  const COLS = "md:grid-cols-[17rem_minmax(0,1fr)]";

  return (
    <Card className="gap-0 overflow-hidden p-0 border-border bg-card shadow-xs">
      <div className="px-4 pt-4 pb-3">
        <SectionHeading
          icon={Wind}
          title={t("title")}
          right={
            <span className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {status === "completed" && <Badge variant="outline" className="text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40">{t("completed")}</Badge>}
              <span className="inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5" role="group" aria-label={t("which")}>
                {([["all", t("view_all", { count: allTotal })], ["key", t("view_key", { count: keyTotal })]] as const).map(([m, label]) => (
                  <button key={m} type="button" onClick={() => setView(m)} aria-pressed={view === m}
                    title={m === "key" ? t("view_key_title") : t("view_all_title")}
                    className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors", view === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {label}
                  </button>
                ))}
              </span>
              <Badge variant="outline" className="tabular-nums">{t("n_of_answered", { n: answeredN, total: all.length })}</Badge>
            </span>
          }
        />
        <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${all.length ? (answeredN / all.length) * 100 : 0}%` }} />
        </div>
        {hintCount > 0 && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-foreground/90">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span>{t.rich("hints", { count: hintCount, b: (c) => <b>{c}</b> })}</span>
          </p>
        )}
      </div>

      {/* Column headings */}
      <div className={cn("hidden border-y border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid", COLS)}>
        <span className="px-3 py-2">{t("col_pillar")}</span>
        <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1.15fr)] gap-x-3 border-s border-border px-3 py-2">
          <span className="text-center">#</span><span>{t("col_question")}</span><span>{t("col_answer")}</span>
        </div>
      </div>

      {/* One group of rows per pillar */}
      <div className="divide-y divide-border border-b border-border md:border-b-0">
        {pillars.map((p, i) => {
          const qs = qsFor(p);
          if (!qs.length) return null;
          const a = qs.filter((q) => isAnswered(answers[q.id])).length;
          const done = a === qs.length;
          const archivedHere = view === "all" ? archived.filter((x) => x.pillarKey === p.key) : [];
          return (
            <section key={p.key} data-pillar={p.key} className={cn("grid", COLS)}>
              <div className="flex items-start gap-2.5 bg-muted/20 px-3 py-2.5">
                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
                  <PillarIcon pillarKey={p.key} className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-[15px] font-semibold leading-tight" title={t("pillar_n", { i: i + 1, total: pillars.length })}>{p.label}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{p.english}</p>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2 py-px text-[11px] font-medium tabular-nums",
                  done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border/60 text-muted-foreground")}>
                  {done ? t("done") : `${a}/${qs.length}`}
                </span>
              </div>
              <div className="min-w-0 divide-y divide-border/60 md:border-s md:border-border">
                {qs.map((q) => (
                  <QuestionRow key={q.id} q={q} n={numberOf.get(q.id) ?? 1} count={all.length} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} hints={hintsFor(q, findings)} />
                ))}
                {archivedHere.length > 0 && (
                  <div className="space-y-0.5 bg-muted/20 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("archived")}</p>
                    {archivedHere.map((x, n) => (
                      <p key={n} className="text-[13px]"><span className="text-muted-foreground">{x.question}:</span> {Array.isArray(x.value) ? x.value.join(", ") : x.value}</p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Where to next */}
      <div className={cn("flex items-center justify-between gap-3 flex-wrap border-t border-border px-4 py-2.5", firstOpen ? "bg-muted/20" : "bg-emerald-500/5")}>
        <p className="text-[13px] text-muted-foreground">
          {firstOpen
            ? <>{t("open_n", { count: all.length - answeredN })}{view === "key" ? "" : t("only_key")}.</>
            : <span className="font-medium text-emerald-700 dark:text-emerald-400">{t("all_answered", { count: all.length })}</span>}
        </p>
        {firstOpen && (
          <Button size="sm" variant="outline" onClick={() => jumpTo(firstOpen.q.id)}>{t("next_open")} <ArrowRight className="h-3.5 w-3.5" /></Button>
        )}
      </div>
    </Card>
  );
}

/** Right column: live humoral drift from the Asbab-e-Sittah answers. */
export function AsbabDriftCard({ state }: { state: AsbabState }) {
  const { drift, pillars } = state;
  const t = useTranslations("clinic.asbab");
  if (!drift || !pillars) return null;
  const dominant = drift.dominant ? AKHLAT.find((h) => h.key === drift.dominant) : null;
  const hasPoints = AKHLAT.some((h) => drift.total[h.key] > 0);

  return (
    <Card className="p-4 border-border/50 bg-card/60 gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-serif text-base font-semibold flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg flex items-center justify-center bg-primary/10 text-primary"><Activity className="h-4 w-4" /></span> {t("drift")}
        </p>
        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">{t("live")}</Badge>
      </div>
      {!hasPoints ? (
        <p className="text-sm text-muted-foreground">{t("drift_empty")}</p>
      ) : (
        <>
          {dominant && (
            <p className="text-sm">{t.rich("leaning", { label: dominant.label, b: (c) => <span className={cn("font-semibold", dominant.text)}>{c}</span> })} <span className="text-muted-foreground">({t(`h_${dominant.key}_en`)} · {t(`h_${dominant.key}_q`)})</span></p>
          )}
          <div className="space-y-2">
            {AKHLAT.map((h) => (
              <div key={h.key} className="grid grid-cols-[70px_1fr_40px] items-center gap-2 text-[13px]">
                <span className={cn(drift.dominant === h.key ? cn("font-semibold", h.text) : "text-muted-foreground")}>{h.label}</span>
                <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full transition-all", h.bar)} style={{ width: `${drift.percent[h.key]}%` }} /></span>
                <span className="text-end tabular-nums">{drift.percent[h.key]}%</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border/40 pt-2 space-y-1">
            {pillars.map((p) => {
              const d = dominantOf(drift.perPillar[p.key]);
              const h = d ? AKHLAT.find((x) => x.key === d)! : null;
              const pct = d ? toPercent(drift.perPillar[p.key])[d] : 0;
              return (
                <div key={p.key} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="text-muted-foreground truncate">{p.label}</span>
                  {h ? <span className={cn("font-medium shrink-0", h.text)}>{h.label} {pct}%</span> : <span className="text-muted-foreground/60 shrink-0">—</span>}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t("drift_note")}</p>
        </>
      )}
    </Card>
  );
}
