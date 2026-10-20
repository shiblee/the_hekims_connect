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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FloatingField, FloatingTextarea } from "@/components/shared/floating-field";
import { SectionHeading } from "@/components/shared/section-heading";
import { LoadFailed, useNotice } from "@/components/shared/inline-notice";
import { ArrowLeft, ArrowRight, ChevronsUpDown, CheckCircle2, Circle, Loader2, Sparkles, Square, SquareCheck, Activity, Wind } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const choice = q.type === "single_select" || q.type === "multi_select";
  const selected = Array.isArray(value) ? value : [];
  const toggle = (label: string) => {
    if (q.type === "single_select") { onChange(selected.includes(label) ? [] : [label]); setOpen(false); }
    else onChange(selected.includes(label) ? selected.filter((l) => l !== label) : [...selected, label]);
  };
  const letterOf = (label: string) => LETTERS[q.options.findIndex((o) => o.label === label)] ?? "";
  const firstHint = q.options.find((o) => hints?.[o.label]);
  const answered = isAnswered(value);
  const options = (
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
                title={hint ? t("suggested_title", { hint }) : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-3 py-2 text-start transition-colors",
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
                      <Sparkles className="h-3 w-3 shrink-0" /> <span className="truncate">{t("suggested", { hint })}</span>
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
  );

  return (
    <Wrap bare={bare} className={cn(bare ? "" : "p-4 border-border/50 bg-card/60 gap-3", !bare && (answered ? "border-s-2 border-s-emerald-500/60" : q.required && "border-s-2 border-s-amber-500/60"))}>
      <div className="flex items-start gap-3">
        <span className={cn(
          "h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-[13px] font-semibold",
          answered ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
        )} aria-label={`${t("question_n", { n: index + 1, count })}${answered ? t("answered_suffix") : ""}`}>{index + 1}</span>
        <div className="min-w-0 flex-1">
          {pillarKey && (
            <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <PillarIcon pillarKey={pillarKey} className="h-3.5 w-3.5" /> {pillarLabel}
            </p>
          )}
          <p className="text-base font-semibold leading-snug">
            {q.label}{q.required && <span className="text-destructive"> *</span>}
            {q.labelLocal && <span className="ms-1.5 text-[13px] font-normal text-muted-foreground">· {q.labelLocal}</span>}
          </p>
          {q.helpText && <p className="text-[13px] text-muted-foreground mt-0.5">{q.helpText}</p>}
        </div>
        {q.required && !answered && <Badge variant="outline" className="shrink-0 text-[11px] font-normal border-amber-500/40 text-amber-700 dark:text-amber-400">{t("required")}</Badge>}
      </div>

      {choice ? (inline ? options : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button id={`asbab-${q.id}`} type="button" aria-expanded={open} className={cn(
              "flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border bg-transparent px-3.5 py-2 text-start transition-colors",
              open ? "border-primary" : "border-input hover:border-primary/40",
            )}>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {selected.length > 0 ? selected.map((l) => (
                  <span key={l} className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500 text-[11px] font-semibold text-white">{letterOf(l)}</span>{l}
                  </span>
                )) : firstHint ? (
                  <span className="flex min-w-0 items-center gap-1 text-sm text-primary">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t("suggested_pick", { option: `${letterOf(firstHint.label)} · ${firstHint.label}` })}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">{q.type === "single_select" ? t("choose_one") : t("choose_many")}</span>
                )}
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-[60vh] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-3">{options}</PopoverContent>
        </Popover>
      )) : q.type === "numeric" ? (
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

// Short names for the one-line pillar strip (full names show on hover; the
// translated English word comes from clinic.asbab.short_*). Pillars added
// later in Admin fall back to their own label and English name.
const SHORT: Record<string, [string, string]> = {
  hawa: ["Hawa", "Air"], makool: ["Makool", "Food"], harkat_badani: ["Badani", "Body"],
  harkat_nafsani: ["Nafsani", "Mind"], naum: ["Naum", "Sleep"], ihtibas: ["Ihtibas", "Excretion"],
};

/**
 * Centre of Stage 4: every question on one screen, grouped into one card per
 * pillar — no tab switching. The one-line pillar strip is a jump bar (it
 * highlights the pillar in view and scrolls to the one clicked). "Key only"
 * narrows it to each pillar's key question (marked Required in Admin) — enough
 * to complete the stage. Options backed by something already recorded for the
 * visit are marked "Suggested" (never selected automatically).
 */
export function AsbabAssessmentPanel({ state, visitId }: { state: AsbabState; visitId?: string }) {
  const { pillars, answers, setAnswer, archived, progress, status } = state;
  const [view, setViewState] = useState<"all" | "key">(() => {
    try { return localStorage.getItem(MODE_KEY) === "key" ? "key" : "all"; } catch { return "all"; }
  });
  const setView = (v: "all" | "key") => { setViewState(v); try { localStorage.setItem(MODE_KEY, v); } catch { /* per-viewer convenience only */ } };
  const findings = useRecordedFindings(visitId);
  const t = useTranslations("clinic.asbab");
  const shortEn = (p: AsbabPillarCfg) => (t.has(`short_${p.key}`) ? t(`short_${p.key}`) : p.english);
  const [inView, setInView] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  // Floating mini jump bar: shown once the header card (with the full strip)
  // has scrolled out of view, lined up with the centre column.
  const headerRef = useRef<HTMLDivElement>(null);
  const [floatBox, setFloatBox] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    const update = () => {
      const el = headerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const panel = el.parentElement?.getBoundingClientRect();
      const showing = r.bottom < 12 && !!panel && panel.bottom > 200;
      setFloatBox(showing ? { left: r.left, width: r.width } : null);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [pillars]);

  // Scroll-spy: the pillar whose heading has most recently passed the top of the screen.
  useEffect(() => {
    if (!pillars?.length) return;
    const spy = () => {
      let current: string | null = null;
      for (const p of pillars) {
        const el = sectionRefs.current[p.key];
        if (el && el.getBoundingClientRect().top <= 160) current = p.key;
      }
      setInView(current ?? pillars[0].key);
    };
    spy();
    window.addEventListener("scroll", spy, { passive: true });
    return () => window.removeEventListener("scroll", spy);
  }, [pillars, view]);

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
  const jump = (key: string) => {
    const el = sectionRefs.current[key];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: "smooth" });
  };
  const firstOpen = all.find(({ q }) => !isAnswered(answers[q.id]));

  return (
    <div className="space-y-4">
      {floatBox && (
        <div className="fixed top-3 z-20 flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/95 px-2 py-1.5 shadow-lg backdrop-blur"
          style={{ left: floatBox.left, width: floatBox.width }} role="navigation" aria-label={t("jump")}>
          {pillars.map((p) => {
            const qs = qsFor(p);
            const a = qs.filter((q) => isAnswered(answers[q.id])).length;
            const done = qs.length > 0 && a === qs.length;
            const on = inView === p.key;
            return (
              <button key={p.key} type="button" onClick={() => jump(p.key)} title={`${p.label} — ${shortEn(p)} · ${a}/${qs.length}`}
                className={cn("flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium transition-colors",
                  on ? "bg-primary text-primary-foreground" : done ? "text-emerald-700 dark:text-emerald-400 hover:bg-muted" : "text-muted-foreground hover:bg-muted")}>
                <PillarIcon pillarKey={p.key} className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate hidden sm:inline">{SHORT[p.key]?.[0] ?? p.label}</span>
                <span className="tabular-nums opacity-80">{done ? "✓" : `${a}/${qs.length}`}</span>
              </button>
            );
          })}
          <span className="hidden md:inline shrink-0 border-s border-border/60 ps-2 text-xs tabular-nums text-muted-foreground">{answeredN}/{all.length}</span>
        </div>
      )}
      <Card ref={headerRef} className="p-5 border-border/50 bg-card/60 gap-0">
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
        <div className="mt-3 mb-3 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${all.length ? (answeredN / all.length) * 100 : 0}%` }} />
        </div>

        {/* Pillars — one line; a ring shows each pillar's progress. Click jumps to it. */}
        <div className="@container"><div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
          {pillars.map((p, i) => {
            const qs = qsFor(p);
            const a = qs.filter((q) => isAnswered(answers[q.id])).length;
            const tot = qs.length;
            const done = tot > 0 && a === tot;
            const on = inView === p.key;
            const missing = keyQs(p).some((q) => q.required && !isAnswered(answers[q.id]));
            const pct = tot ? a / tot : 0;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => jump(p.key)}
                title={t("pillar_title", { i: i + 1, label: p.label, english: shortEn(p), a, t: tot })}
                className={cn(
                  "flex min-w-[6.5rem] @xl:min-w-0 flex-1 basis-0 items-center gap-1 @3xl:gap-1.5 rounded-xl border px-1 @3xl:px-1.5 py-1.5 text-start transition-colors",
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
                  {missing && <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-amber-500" aria-label={t("missing_dot")} />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-xs @3xl:text-[13px] font-semibold leading-tight", on && "text-primary")}>{SHORT[p.key]?.[0] ?? p.label}</span>
                  <span className={cn("block truncate text-[11px] @3xl:text-xs leading-tight", done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{shortEn(p)}</span>
                </span>
              </button>
            );
          })}
        </div></div>
      </Card>

      {hintCount > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[13px] text-foreground/90">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span>{t.rich("hints", { count: hintCount, b: (c) => <b>{c}</b> })}</span>
        </p>
      )}

      {/* All pillars, one card each */}
      {pillars.map((p, i) => {
        const qs = qsFor(p);
        if (!qs.length) return null;
        const a = qs.filter((q) => isAnswered(answers[q.id])).length;
        const done = a === qs.length;
        const archivedHere = view === "all" ? archived.filter((x) => x.pillarKey === p.key) : [];
        return (
          <section key={p.key} data-pillar={p.key} ref={(el) => { sectionRefs.current[p.key] = el; }} className="scroll-mt-24">
            <Card className={cn("p-5 border-border/50 bg-card/60 gap-0 border-s-4 transition-colors", done ? "border-s-emerald-500/70" : "border-s-primary/40")}>
              <div className="flex items-center justify-between gap-3 pb-1">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
                    <PillarIcon pillarKey={p.key} className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("pillar_n", { i: i + 1, total: pillars.length })}</p>
                    <h3 className="font-serif text-lg font-semibold leading-tight">{p.label} <span className="text-sm font-sans font-normal text-muted-foreground">· {p.english}</span></h3>
                  </div>
                </div>
                <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums",
                  done ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-border/60 text-muted-foreground")}>
                  {done ? t("done") : `${a}/${qs.length}`}
                </span>
              </div>
              <div>
                {qs.map((q) => (
                  <QuestionCard key={q.id} bare q={q} index={(numberOf.get(q.id) ?? 1) - 1} count={all.length} pillarLabel={p.label}
                    value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} hints={hintsFor(q, findings)} />
                ))}
              </div>
              {archivedHere.length > 0 && (
                <div className="mt-2 rounded-lg border border-border/50 bg-background/40 p-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("archived")}</p>
                  {archivedHere.map((x, n) => (
                    <p key={n} className="text-sm"><span className="text-muted-foreground">{x.question}:</span> {Array.isArray(x.value) ? x.value.join(", ") : x.value}</p>
                  ))}
                </div>
              )}
            </Card>
          </section>
        );
      })}

      {/* Where to next */}
      <div className={cn("flex items-center justify-between gap-3 flex-wrap rounded-xl border px-4 py-3",
        firstOpen ? "border-dashed border-border/60 bg-card/40" : "border-emerald-500/40 bg-emerald-500/5")}>
        <p className="text-[13px] text-muted-foreground">
          {firstOpen
            ? <>{t("open_n", { count: all.length - answeredN })}{view === "key" ? "" : t("only_key")}.</>
            : <span className="font-medium text-emerald-700 dark:text-emerald-400">{t("all_answered", { count: all.length })}</span>}
        </p>
        {firstOpen && (
          <Button size="sm" variant="outline" onClick={() => jump(firstOpen.p.key)}>{t("next_open")} <ArrowRight className="h-3.5 w-3.5" /></Button>
        )}
      </div>
    </div>
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
