"use client";

import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AKHLAT, computeDrift, isAnswered, pillarIcon, questionVisible, toPercent, dominantOf,
  type AsbabAnswer, type AsbabPillarCfg, type AsbabQuestionCfg,
} from "@/lib/asbab";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      .catch((e) => { if (!cancelled) setLoadError(e.message || "Network error"); });
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
        complete ? "The assessment wasn't completed" : "The draft wasn't saved",
        `${e.message || "Network error"}. Your answers are still on screen — nothing was lost.`,
        { retry: () => save(complete), retryLabel: "Try again" },
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
function PillarIcon({ pillarKey, className }: { pillarKey: string; className?: string }) {
  return createElement(pillarIcon(pillarKey), { className });
}

export function QuestionCard({ q, index, count, pillarLabel, pillarKey, value, onChange, hints }: {
  q: AsbabQuestionCfg; index: number; count: number; pillarLabel: string; value: AsbabAnswer | undefined; onChange: (v: AsbabAnswer) => void;
  /** Show the pillar this question belongs to (Quick review lists all pillars together). */
  pillarKey?: string;
  /** option label → recorded finding that suggests it. */
  hints?: Record<string, string>;
}) {
  const choice = q.type === "single_select" || q.type === "multi_select";
  const selected = Array.isArray(value) ? value : [];
  const toggle = (label: string) => {
    if (q.type === "single_select") onChange(selected.includes(label) ? [] : [label]);
    else onChange(selected.includes(label) ? selected.filter((l) => l !== label) : [...selected, label]);
  };
  const answered = isAnswered(value);

  return (
    <Card className={cn("p-4 border-border/50 bg-card/60 gap-3", answered ? "border-l-2 border-l-emerald-500/60" : q.required && "border-l-2 border-l-amber-500/60")}>
      <div className="flex items-start gap-3">
        <span className={cn(
          "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-semibold",
          answered ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
        )} aria-label={`Question ${index + 1} of ${count}${answered ? ", answered" : ""}`}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          {pillarKey && (
            <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <PillarIcon pillarKey={pillarKey} className="h-3.5 w-3.5" /> {pillarLabel}
            </p>
          )}
          <p className="text-base font-semibold leading-snug">
            {q.label}{q.required && <span className="text-destructive"> *</span>}
            {q.labelLocal && <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">· {q.labelLocal}</span>}
          </p>
          {q.helpText && <p className="text-[13px] text-muted-foreground mt-0.5">{q.helpText}</p>}
        </div>
        {q.required && !answered && <Badge variant="outline" className="shrink-0 text-[11px] font-normal border-amber-500/40 text-amber-700 dark:text-amber-400">Required</Badge>}
      </div>

      {choice ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {q.options.map((o, i) => {
            const on = selected.includes(o.label);
            const hint = hints?.[o.label];
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.label)}
                aria-pressed={on}
                title={hint ? `Suggested — recorded earlier: ${hint}` : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                  on ? "border-emerald-500/40 bg-emerald-500/10" : hint ? "border-dashed border-primary/50 bg-primary/5 hover:border-primary" : "border-border/50 bg-background/40 hover:border-primary/30",
                )}
              >
                <span className={cn(
                  "h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-xs font-semibold",
                  on ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground",
                )}>{LETTERS[i]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{o.label}</span>
                  {o.description && <span className="block text-[13px] text-muted-foreground leading-snug">{o.description}</span>}
                  {hint && !on && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3 w-3 shrink-0" /> <span className="truncate">Suggested · {hint}</span>
                    </span>
                  )}
                </span>
                {q.type === "single_select"
                  ? (on ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />)
                  : (on ? <SquareCheck className="h-5 w-5 text-emerald-500 shrink-0" /> : <Square className="h-5 w-5 text-muted-foreground/40 shrink-0" />)}
              </button>
            );
          })}
        </div>
      ) : q.type === "numeric" ? (
        <div className="max-w-xs">
          <FloatingField id={`asbab-${q.id}`} label="Answer (number)" type="number" min={0} step="any" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      ) : (
        <FloatingTextarea id={`asbab-${q.id}`} label="Answer" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} rows={2} />
      )}
    </Card>
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

const MODE_KEY = "hekims-asbab-mode";

// Short names for the one-line pillar strip (full names show on hover). Pillars
// added later in Admin fall back to their own label and English name.
const SHORT: Record<string, [string, string]> = {
  hawa: ["Hawa", "Air"], makool: ["Makool", "Food"], harkat_badani: ["Badani", "Body"],
  harkat_nafsani: ["Nafsani", "Mind"], naum: ["Naum", "Sleep"], ihtibas: ["Ihtibas", "Excretion"],
};

/**
 * Centre of Stage 4. Two ways to fill it:
 * - Quick review (default): only each pillar's key questions — the ones
 *   marked Required in Admin — on one screen. Enough to complete the stage.
 * - Full review: every question, one pillar at a time, for a finer reading.
 * Options backed by something already recorded for the visit are marked
 * "Suggested" (never selected automatically).
 */
export function AsbabAssessmentPanel({ state, visitId }: { state: AsbabState; visitId?: string }) {
  const { pillars, answers, setAnswer, archived, progress, status } = state;
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [mode, setModeState] = useState<"quick" | "full">(() => {
    try { return localStorage.getItem(MODE_KEY) === "full" ? "full" : "quick"; } catch { return "quick"; }
  });
  const setMode = (m: "quick" | "full") => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* per-viewer convenience only */ } };
  const findings = useRecordedFindings(visitId);
  const active = pillars?.find((p) => p.key === activeKey) ?? pillars?.[0];

  if (!pillars) {
    if (state.loadError) return <LoadFailed what="the Asbab-e-Sittah assessment" detail={state.loadError} onRetry={state.reload} />;
    return <Card className="p-5 border-border/50 bg-card/60"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Asbab-e-Sittah…</div></Card>;
  }
  if (!pillars.length || !active) {
    return <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No Asbab-e-Sittah pillars are enabled — configure them in Admin → Meta → Asbab-e-Sittah.</Card>;
  }

  // Key questions: those marked Required; a pillar with none uses its first question.
  const keyQs = (p: AsbabPillarCfg) => {
    const shown = p.questions.filter((q) => questionVisible(q, answers));
    const req = shown.filter((q) => q.required);
    return req.length ? req : shown.slice(0, 1);
  };
  const quickList = pillars.flatMap((p) => keyQs(p).map((q) => ({ p, q })));
  const quickAnswered = quickList.filter(({ q }) => isAnswered(answers[q.id])).length;
  const shownCount = mode === "quick" ? { answered: quickAnswered, total: quickList.length } : { answered: progress.answered, total: progress.total };
  const extraAnswered = progress.answered - quickAnswered;

  const idx = pillars.indexOf(active);
  const shown = active.questions.filter((q) => questionVisible(q, answers));
  const archivedHere = archived.filter((a) => a.pillarKey === active.key);
  const go = (d: -1 | 1) => { const p = pillars[idx + d]; if (p) { setActiveKey(p.key); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const hintCount = (mode === "quick" ? quickList.map(({ q }) => q) : shown)
    .filter((q) => !isAnswered(answers[q.id]) && Object.keys(hintsFor(q, findings)).length > 0).length;

  return (
    <div className="space-y-5">
      <Card className="p-5 border-border/50 bg-card/60 gap-0">
        <SectionHeading
          icon={Wind}
          title="Asbab-e-Sittah Zarooriya"
          right={
            <span className="flex items-center gap-1.5 shrink-0 flex-wrap">
              {status === "completed" && <Badge variant="outline" className="text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-500/40">Completed</Badge>}
              <span className="inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5" role="group" aria-label="Review mode">
                {([["quick", `Quick · ${quickList.length}`], ["full", `Full · ${progress.total}`]] as const).map(([m, label]) => (
                  <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
                    title={m === "quick" ? "Only the key question of each pillar — enough to complete this stage" : "Every question, one pillar at a time"}
                    className={cn("rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {label}
                  </button>
                ))}
              </span>
              <Badge variant="outline" className="tabular-nums">{shownCount.answered} of {shownCount.total} answered</Badge>
            </span>
          }
        />
        <div className="mt-3 mb-3 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${shownCount.total ? (shownCount.answered / shownCount.total) * 100 : 0}%` }} />
        </div>

        {/* Pillars — one line. A ring shows each pillar's progress; click opens it in Full review. */}
        <div className="@container"><div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          {pillars.map((p, i) => {
            const pr = progress.per[p.key];
            const keys = keyQs(p);
            const a = mode === "quick" ? keys.filter((q) => isAnswered(answers[q.id])).length : pr?.answered ?? 0;
            const t = mode === "quick" ? keys.length : pr?.total ?? 0;
            const done = t > 0 && a === t;
            const on = mode === "full" && p.key === active.key;
            const missing = keys.some((q) => q.required && !isAnswered(answers[q.id]));
            const pct = t ? a / t : 0;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => { setActiveKey(p.key); if (mode === "quick") setMode("full"); }}
                title={`${i + 1}. ${p.label} — ${p.english} · ${a}/${t} answered${mode === "quick" ? " (click for all its questions)" : ""}`}
                className={cn(
                  "flex min-w-[6.5rem] @xl:min-w-0 flex-1 basis-0 items-center gap-1 @3xl:gap-1.5 rounded-xl border px-1 @3xl:px-1.5 py-1.5 text-left transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border/50 bg-background/40 hover:border-primary/40",
                )}
              >
                <span className="relative h-8 w-8 @3xl:h-9 @3xl:w-9 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
                    <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" className="stroke-muted" />
                    <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
                      className={done ? "stroke-emerald-500" : "stroke-primary"} strokeDasharray={`${pct * 97.4} 97.4`} />
                  </svg>
                  <span className={cn("absolute inset-0 flex items-center justify-center", done ? "text-emerald-600 dark:text-emerald-400" : on ? "text-primary" : "text-muted-foreground")}>
                    <PillarIcon pillarKey={p.key} className="h-4 w-4" />
                  </span>
                  {missing && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-amber-500" aria-label="Required question unanswered" />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-xs @3xl:text-[13px] font-semibold leading-tight", on && "text-primary")}>{SHORT[p.key]?.[0] ?? p.label}</span>
                  <span className={cn("block truncate text-[11px] @3xl:text-xs leading-tight", done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{SHORT[p.key]?.[1] ?? p.english}</span>
                </span>
              </button>
            );
          })}
        </div></div>
      </Card>

      {hintCount > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px] text-foreground/90">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span><b>{hintCount} {hintCount === 1 ? "question has" : "questions have"} a suggested answer</b> from what&apos;s already recorded (complaints, onset, other symptoms). Tap a suggestion to confirm it.</span>
        </p>
      )}

      {mode === "quick" ? (
        <>
          {quickList.map(({ p, q }, i) => (
            <QuestionCard key={q.id} q={q} index={i} count={quickList.length} pillarLabel={p.label} pillarKey={p.key}
              value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} hints={hintsFor(q, findings)} />
          ))}
          <Card className="p-4 border-dashed border-border/60 bg-card/40 flex-row items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] text-muted-foreground">
              Key questions are enough to complete this stage.
              {` ${progress.total - quickList.length} more questions are optional for a finer humoral reading`}
              {extraAnswered > 0 ? ` (${extraAnswered} already answered).` : "."}
            </p>
            <Button size="sm" variant="outline" onClick={() => { setActiveKey(pillars[0].key); setMode("full"); }}>Open full review <ArrowRight className="h-3.5 w-3.5" /></Button>
          </Card>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 px-1">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary"><PillarIcon pillarKey={active.key} className="h-4.5 w-4.5" /></div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pillar {idx + 1} of {pillars.length}</p>
              <h3 className="font-serif text-lg font-semibold leading-tight">{active.label} <span className="text-sm font-sans font-normal text-muted-foreground">· {active.english}</span></h3>
            </div>
          </div>

          {shown.length === 0
            ? <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No questions are enabled for this pillar.</Card>
            : shown.map((q, i) => (
              <QuestionCard key={q.id} q={q} index={i} count={shown.length} pillarLabel={active.label} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} hints={hintsFor(q, findings)} />
            ))}

          {archivedHere.length > 0 && (
            <Card className="p-4 border-border/50 bg-card/40 gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recorded earlier (question since disabled)</p>
              {archivedHere.map((a, i) => (
                <p key={i} className="text-sm"><span className="text-muted-foreground">{a.question}:</span> {Array.isArray(a.value) ? a.value.join(", ") : a.value}</p>
              ))}
            </Card>
          )}

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={idx === 0}><ArrowLeft className="h-3.5 w-3.5" /> {idx > 0 ? pillars[idx - 1].label : "Previous"}</Button>
            <Button variant="outline" size="sm" onClick={() => go(1)} disabled={idx === pillars.length - 1}>{idx < pillars.length - 1 ? pillars[idx + 1].label : "Next"} <ArrowRight className="h-3.5 w-3.5" /></Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Right column: live humoral drift from the Asbab-e-Sittah answers. */
export function AsbabDriftCard({ state }: { state: AsbabState }) {
  const { drift, pillars } = state;
  if (!drift || !pillars) return null;
  const dominant = drift.dominant ? AKHLAT.find((h) => h.key === drift.dominant) : null;
  const hasPoints = AKHLAT.some((h) => drift.total[h.key] > 0);

  return (
    <Card className="p-4 border-border/50 bg-card/60 gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-serif text-base font-semibold flex items-center gap-2">
          <span className="h-7 w-7 rounded-lg flex items-center justify-center bg-primary/10 text-primary"><Activity className="h-4 w-4" /></span> Humoral Drift
        </p>
        <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Live</Badge>
      </div>
      {!hasPoints ? (
        <p className="text-sm text-muted-foreground">Answer the Asbab-e-Sittah questions to see which Akhlat the patient&apos;s lifestyle is pushing towards.</p>
      ) : (
        <>
          {dominant && (
            <p className="text-sm">Leaning towards <span className={cn("font-semibold", dominant.text)}>{dominant.label}</span> <span className="text-muted-foreground">({dominant.english} · {dominant.quality})</span></p>
          )}
          <div className="space-y-2">
            {AKHLAT.map((h) => (
              <div key={h.key} className="grid grid-cols-[70px_1fr_40px] items-center gap-2 text-[13px]">
                <span className={cn(drift.dominant === h.key ? cn("font-semibold", h.text) : "text-muted-foreground")}>{h.label}</span>
                <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full transition-all", h.bar)} style={{ width: `${drift.percent[h.key]}%` }} /></span>
                <span className="text-right tabular-nums">{drift.percent[h.key]}%</span>
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
          <p className="text-xs text-muted-foreground">Weighted from each answer&apos;s humoral points (set in Admin). A guide for the Hakim, not a diagnosis.</p>
        </>
      )}
    </Card>
  );
}
