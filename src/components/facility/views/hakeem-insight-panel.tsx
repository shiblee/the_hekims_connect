"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Loader2, Milestone, Scale, Quote, Check, Circle, Crown, RefreshCw, ArrowRight, HeartPulse, ListChecks,
} from "lucide-react";

interface Routing { priorityLevel: string; triageStream: string; justification: string; generatedAt?: string }
interface Humoral {
  safraPercent: number; damPercent: number; saudaPercent: number; balghamPercent: number;
  dominant: string; dominantOverride: string | null;
  aiClue: string | null; aiClueGeneratedAt: string | null;
}
interface HumorDisplayRow { humor: string; axisLabel: string; unaniLabel: string; description: string | null }

// Display order Air, Fire, Water, Earth — same as the classical wheel.
const HUMORS = [
  { key: "dam", dominant: "Dam", field: "damPercent", bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", soft: "bg-rose-500/10 border-rose-500/30" },
  { key: "safra", dominant: "Safra", field: "safraPercent", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", soft: "bg-amber-500/10 border-amber-500/30" },
  { key: "balgham", dominant: "Balgham", field: "balghamPercent", bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", soft: "bg-sky-500/10 border-sky-500/30" },
  { key: "sauda", dominant: "Sauda", field: "saudaPercent", bar: "bg-violet-500", text: "text-violet-600 dark:text-violet-400", soft: "bg-violet-500/10 border-violet-500/30" },
] as const;

/** "Priority Level 2: Standard Ambulatory Intake" → level 2 and its colour. */
function priorityTone(label: string) {
  const level = Number(/level\s*(\d)/i.exec(label)?.[1] ?? /(\d)/.exec(label)?.[1] ?? NaN);
  if (level === 1) return { level, ring: "border-red-500/40 bg-red-500/10", badge: "bg-red-500 text-white", text: "text-red-700 dark:text-red-400", word: "Urgent" };
  if (level === 2) return { level, ring: "border-amber-500/40 bg-amber-500/10", badge: "bg-amber-500 text-white", text: "text-amber-700 dark:text-amber-400", word: "Soon" };
  if (level >= 3) return { level, ring: "border-emerald-500/40 bg-emerald-500/10", badge: "bg-emerald-500 text-white", text: "text-emerald-700 dark:text-emerald-400", word: "Routine" };
  return { level: null, ring: "border-primary/30 bg-primary/5", badge: "bg-primary text-primary-foreground", text: "text-primary", word: "" };
}

const STEPS = ["Saving the latest findings", "Reading vitals, complaints & warning signs", "Weighing the four humours"];

export interface HakeemInsightPanelHandle {
  /** Re-fetch the humoral balance after the page saves the complaints (it's recomputed server-side). */
  refresh: () => void;
}

/**
 * Hakeem Insight for a visit, in one card with one button: the suggested
 * triage priority + next step, the computed humoral balance (Akhlat), and a
 * plain-language explanation of it. Generate saves the doctor's latest
 * complaints first, then runs both analyses together.
 */
export const HakeemInsightPanel = forwardRef<HakeemInsightPanelHandle, {
  visitId: string;
  hasVitals?: boolean;
  /** Persist unsaved complaint edits before generating (the humoral balance is computed from saved rows). */
  onBeforeGenerate?: () => Promise<void>;
}>(function HakeemInsightPanel({ visitId, hasVitals, onBeforeGenerate }, ref) {
  const [routing, setRouting] = useState<Routing | null>(null);
  const [humoral, setHumoral] = useState<Humoral | null>(null);
  const [display, setDisplay] = useState<HumorDisplayRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<number | null>(null); // running: index into STEPS
  const [overriding, setOverriding] = useState(false);
  const msg = useNotice();

  const loadHumoral = useCallback(async () => {
    const ca = await api.get<{ humoralAssessment: Humoral | null }>(`/api/facility/visits/${visitId}/complaint-assessments`);
    setHumoral(ca.humoralAssessment);
  }, [visitId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ routing: Routing | null }>(`/api/facility/visits/${visitId}/clinical-routing-insight`).catch(() => ({ routing: null })),
      api.get<{ humoralAssessment: Humoral | null }>(`/api/facility/visits/${visitId}/complaint-assessments`).catch(() => ({ humoralAssessment: null })),
      api.get<{ displayConfig: HumorDisplayRow[] }>("/api/facility/humor/config").catch(() => ({ displayConfig: [] })),
    ]).then(([r, ca, cfg]) => {
      if (cancelled) return;
      setRouting(r.routing);
      setHumoral(ca.humoralAssessment);
      setDisplay(cfg.displayConfig || []);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [visitId]);

  useImperativeHandle(ref, () => ({ refresh: () => { loadHumoral().catch(() => {}); } }), [loadHumoral]);

  const generate = async () => {
    msg.clear();
    setStep(0);
    try {
      if (onBeforeGenerate) {
        try { await onBeforeGenerate(); } catch {
          msg.warning("The main complaints need saving first", "They couldn't be saved — see the message in Main Complaints, then press Generate again.");
          setStep(null);
          return;
        }
      }
      setStep(1);
      const routingCall = api.post<{ routing: Routing | null; reason?: string }>(`/api/facility/visits/${visitId}/clinical-routing-insight`, {});
      await loadHumoral();
      setStep(2);
      const clueCall = api.post<{ clue: string | null; reason?: string }>(`/api/facility/visits/${visitId}/humoral-clues-insight`, {});
      const [r, c] = await Promise.allSettled([routingCall, clueCall]);
      if (r.status === "fulfilled" && r.value.routing) setRouting(r.value.routing);
      if (c.status === "fulfilled" && c.value.clue) setHumoral((h) => (h ? { ...h, aiClue: c.value.clue, aiClueGeneratedAt: new Date().toISOString() } : h));
      // Work out what didn't come back, and why.
      const rReason = r.status === "rejected" ? "error" : r.value.routing ? null : (r.value.reason || "unavailable");
      const cReason = c.status === "rejected" ? "error" : c.value.clue ? null : (c.value.reason || "unavailable");
      if (rReason === "off" || cReason === "off") {
        msg.info(
          "Hakeem Insight is switched off",
          "An administrator has turned off the AI service. Everything else on this page keeps working.",
        );
      } else if (rReason === "quota" || cReason === "quota") {
        msg.warning(
          "Hakeem Insight is paused — its AI credits have run out",
          "The Google Gemini account behind Hakeem Insight has used up its prepaid credits. An administrator can top it up in Google AI Studio; everything else on this page keeps working.",
          { retry: generate, retryLabel: "Try again" },
        );
      } else {
        const failed = [rReason && "triage priority", cReason && cReason !== "no_data" && "humoral explanation"].filter(Boolean) as string[];
        if (failed.length === 2) msg.error("Hakeem Insight isn't available right now", "Nothing was changed — try again in a moment.", { retry: generate, retryLabel: "Try again" });
        else if (failed.length) msg.warning(`The ${failed[0]} couldn't be generated`, "The rest is shown below — try again to fill it in.", { retry: generate, retryLabel: "Try again" });
        if (cReason === "no_data" && !rReason) msg.info("Fill in Main Complaints for the humoral reading", "The triage priority is ready; the humoral balance needs at least one assessed complaint.");
      }
    } catch (e: any) {
      msg.error("Hakeem Insight couldn't run", `${e.message || "Network error"}.`, { retry: generate, retryLabel: "Try again" });
    } finally {
      setStep(null);
    }
  };

  const effective = humoral ? (humoral.dominantOverride ?? humoral.dominant) : null;
  const pickHumor = async (dominant: string) => {
    if (!humoral || dominant === effective) return;
    setOverriding(true);
    try {
      await api.patch(`/api/facility/visits/${visitId}/humoral-assessment`, { dominantOverride: dominant });
      setHumoral((h) => (h ? { ...h, dominantOverride: dominant } : h));
    } catch (e: any) {
      msg.error("The doctor's pick wasn't saved", `${e.message || "Network error"}. Try again.`);
    } finally {
      setOverriding(false);
    }
  };

  const running = step !== null;
  const hasAny = !!routing || !!humoral?.aiClue;
  const tone = routing ? priorityTone(routing.priorityLevel) : null;
  const generatedAt = routing?.generatedAt || humoral?.aiClueGeneratedAt;
  const cfg = (key: string) => display.find((d) => d.humor === key);

  return (
    <Card className="p-4 gap-3 border-primary/20 bg-gradient-to-b from-primary/[0.06] to-card">
      {/* Header + the one action */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-lg font-semibold leading-tight">Hakeem Insight</h2>
            <p className="text-xs text-muted-foreground leading-tight">
              {generatedAt ? `Updated ${daysAgo(generatedAt)}` : "Triage & humoral reading"}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400 shrink-0">Preliminary</span>
      </div>

      <Button onClick={generate} disabled={running || !loaded} className="w-full">
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : hasAny ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        {running ? "Generating…" : hasAny ? "Regenerate insight" : "Generate insight"}
      </Button>

      {/* Live progress */}
      {running && (
        <ol className="space-y-1.5 rounded-lg border border-border/50 bg-background/60 p-3 animate-in fade-in">
          {STEPS.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-2 text-[13px]", i < step! ? "text-foreground" : i === step ? "text-primary font-medium" : "text-muted-foreground")}>
              {i < step! ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Circle className="h-3.5 w-3.5" />}
              {s}
            </li>
          ))}
        </ol>
      )}
      <NoticeSlot state={msg} />

      {/* Before anything is generated: what you'll get, and whether the data is there */}
      {!running && !hasAny && loaded && (
        <div className="rounded-lg border border-dashed border-border/70 p-3 space-y-2.5">
          <p className="text-sm font-semibold">One click gives you:</p>
          <ul className="space-y-1.5 text-[13px] text-muted-foreground">
            <li className="flex items-center gap-2"><Milestone className="h-3.5 w-3.5 text-primary" /> Triage priority and the next step</li>
            <li className="flex items-center gap-2"><Scale className="h-3.5 w-3.5 text-primary" /> The four-humour balance (Akhlat)</li>
            <li className="flex items-center gap-2"><Quote className="h-3.5 w-3.5 text-primary" /> A plain-language explanation</li>
          </ul>
          <div className="border-t border-border/50 pt-2 space-y-1 text-xs">
            <p className={cn("flex items-center gap-1.5", hasVitals ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
              {hasVitals ? <Check className="h-3 w-3" /> : <HeartPulse className="h-3 w-3" />} Vitals {hasVitals ? "recorded" : "not recorded yet"}
            </p>
            <p className={cn("flex items-center gap-1.5", humoral ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
              {humoral ? <Check className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />} Main complaints {humoral ? "assessed" : "— fill in for the humoral balance"}
            </p>
          </div>
        </div>
      )}

      {/* 1 — Triage */}
      {routing && tone && (
        <section className={cn("rounded-xl border p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300", tone.ring)}>
          <div className="flex items-start gap-2.5">
            <span className={cn("h-9 w-9 rounded-lg flex flex-col items-center justify-center shrink-0 leading-none", tone.badge)}>
              {tone.level != null ? <><span className="text-[9px] font-semibold uppercase opacity-80">Level</span><span className="text-base font-bold">{tone.level}</span></> : <Milestone className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className={cn("text-[11px] font-semibold uppercase tracking-wide", tone.text)}>Triage priority{tone.word && ` · ${tone.word}`}</p>
              <p className="text-sm font-semibold leading-snug">{routing.priorityLevel.replace(/^priority\s*level\s*\d\s*[:\-–]\s*/i, "")}</p>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-[13px]">
            <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <span><span className="text-muted-foreground">Next step:</span> <span className="font-medium">{routing.triageStream}</span></span>
          </p>
          <p className="text-[13px] text-muted-foreground leading-relaxed">{routing.justification}</p>
        </section>
      )}

      {/* 2 — Humoral balance */}
      {humoral && (
        <section className="rounded-xl border border-border/50 bg-card p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Scale className="h-4 w-4 text-primary" /> Humoral balance</p>
            {humoral.dominantOverride && <span className="text-[11px] text-muted-foreground">Doctor&apos;s pick · engine said {humoral.dominant}</span>}
          </div>
          <div className="space-y-1.5">
            {HUMORS.map((h) => {
              const pct = Math.round(Number(humoral[h.field as keyof Humoral]) || 0);
              const isTop = effective === h.dominant;
              const c = cfg(h.key);
              return (
                <button
                  key={h.key}
                  type="button"
                  onClick={() => pickHumor(h.dominant)}
                  disabled={overriding}
                  title={isTop ? "Current dominant humour" : `Set ${c?.unaniLabel || h.dominant} as the doctor's pick`}
                  className={cn(
                    "group w-full rounded-lg border px-2.5 py-1.5 text-start transition-colors",
                    isTop ? h.soft : "border-transparent hover:border-border/60 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-1.5 min-w-0">
                      {isTop && <Crown className={cn("h-3 w-3 shrink-0", h.text)} />}
                      <span className={cn("font-semibold", isTop && h.text)}>{c?.unaniLabel || h.dominant}</span>
                      <span className="text-muted-foreground truncate">{c?.axisLabel}{c?.description ? ` · ${c.description}` : ""}</span>
                    </span>
                    <span className={cn("font-semibold tabular-nums", isTop ? h.text : "text-muted-foreground")}>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", h.bar, !isTop && "opacity-60")} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Tap a humour to set your own pick.</p>
        </section>
      )}

      {/* 3 — Explanation */}
      {humoral?.aiClue && (
        <section className="rounded-xl border-s-4 border-primary/50 bg-primary/5 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1 mb-1"><Quote className="h-3 w-3" /> Why {cfg(HUMORS.find((h) => h.dominant === effective)?.key ?? "")?.unaniLabel || effective}?</p>
          <p className="text-sm leading-relaxed">{humoral.aiClue}</p>
        </section>
      )}

      {hasAny && (
        <p className="text-[11px] text-muted-foreground italic">Decision support only — not a diagnosis. Confirm before acting.</p>
      )}
    </Card>
  );
});
