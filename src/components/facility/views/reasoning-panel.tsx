"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Brain, Check, ChevronDown, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { Button } from "@/components/ui/button";
import type { ReasoningOutput, Removal } from "@/lib/reasoning-engine";
import type { DiagnosisRole, DossierDiagnosis } from "@/components/facility/views/marz-diagnosis";

interface Run { id: string; output: ReasoningOutput; removed: Removal[]; model: string; mode: string; createdAt: string; by: string | null; feedback: string | null }

function Box({ title, tone = "muted", children }: { title: string; tone?: "muted" | "risk" | "warn"; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border p-3 min-w-0", tone === "risk" ? "border-destructive/40 bg-destructive/5" : tone === "warn" ? "border-amber-500/40 bg-amber-500/5" : "border-border/50 bg-background/50")}>
      <p className={cn("text-[11px] font-semibold uppercase tracking-wide mb-1.5", tone === "risk" ? "text-destructive" : tone === "warn" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{title}</p>
      {children}
    </div>
  );
}

/**
 * Hakeem Insight for Stage 5 — an AI reading of the whole (de-identified) case, checked by the
 * platform before it's shown. Hidden when the clinical reasoning service is off.
 */
export function ReasoningPanel({ visitId, diagnoses, onAdd, onUseStatement, saveFirst }: {
  visitId: string; diagnoses: DossierDiagnosis[]; onAdd: (d: DossierDiagnosis) => void; onUseStatement: (s: string) => void; saveFirst: () => Promise<unknown>;
}) {
  const t = useTranslations("clinic.reasoning");
  const dl = useDateLocale();
  const [status, setStatus] = useState<"on" | "off" | "no_key" | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState<null | "standard" | "deep">(null);
  const [err, setErr] = useState<string | null>(null);
  const [used, setUsed] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [fb, setFb] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ status: "on" | "off" | "no_key"; run: Run | null }>(`/api/facility/visits/${visitId}/reasoning`)
      .then((r) => { setStatus(r.status); setRun(r.run); setFb(r.run?.feedback ?? null); }).catch(() => setStatus("off"));
  }, [visitId]);

  const analyse = useCallback(async (mode: "standard" | "deep", force: boolean) => {
    setBusy(mode); setErr(null); setUsed(false);
    try {
      await saveFirst();
      const r = await api.post<{ run: Run }>(`/api/facility/visits/${visitId}/reasoning`, { mode, force });
      setRun(r.run); setFb(r.run.feedback ?? null);
    } catch (e: any) {
      if (e?.data?.off) setStatus("off");
      setErr(t("failed", { error: e.message }));
    } finally { setBusy(null); }
  }, [visitId, saveFirst, t]);

  const feedback = async (rating: string) => {
    if (!run) return;
    setFb(rating);
    await api.post(`/api/facility/visits/${visitId}/reasoning`, { feedback: { runId: run.id, rating } }).catch(() => setFb(null));
  };

  if (status !== "on") return null;
  const o = run?.output;
  const inDx = (key: string, label: string) => diagnoses.some((d) => d.label === label || d.marzId === key);
  const add = (d: ReasoningOutput["differentials"][number], role: DiagnosisRole) => onAdd({
    marzId: d.marzId, label: d.label, localName: d.localName, role, certainty: d.certainty, evidenceFor: d.for, evidenceAgainst: d.against, note: null, source: "ai",
  });

  return (
    <div className="rounded-xl border-2 border-dashed border-sky-500/40 bg-sky-500/5 p-4 space-y-3" data-tour="dossier.reasoning">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400 flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> {t("title")}</p>
          {!run && <p className="mt-1 text-[13px] text-muted-foreground max-w-prose">{t("intro")}</p>}
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("privacy")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 border-sky-500/40" disabled={!!busy} onClick={() => analyse("standard", !!run)}>
            {busy === "standard" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {run ? t("rerun") : t("analyse")}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" disabled={!!busy} onClick={() => analyse("deep", true)} title={t("deep_hint")}>
            {busy === "deep" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />} {t("deep")}
          </Button>
        </div>
      </div>
      {busy && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> {t("running")} {t("save_first")}</p>}
      {err && <p className="text-xs text-destructive" role="alert">{err}</p>}

      {run && o && (
        <div className="space-y-2.5">
          <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-sky-700 dark:text-sky-400">{t("ai_label")}</span> · {t("meta", { model: run.model, when: new Date(run.createdAt).toLocaleString(dl, { dateStyle: "medium", timeStyle: "short" }), by: run.by || "—" })}</p>

          {o.urgent.length > 0 && (
            <Box title={t("urgent")} tone="risk">
              <ul className="space-y-1.5">{o.urgent.map((u, i) => <li key={i} className="text-[13px]"><p className="font-medium flex items-start gap-1.5"><ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />{u.issue}</p>{u.action && <p className="ps-5 text-muted-foreground">{u.action}</p>}</li>)}</ul>
            </Box>
          )}
          {o.insufficient && <p className="text-[13px] text-amber-700 dark:text-amber-400">{t("insufficient")} {o.limitations}</p>}
          {o.summary && <Box title={t("summary")}><p className="text-[13px] leading-relaxed">{o.summary}</p></Box>}

          {(o.contradictions.length > 0 || o.missing.length > 0) && (
            <div className="grid md:grid-cols-2 gap-2.5">
              {o.contradictions.length > 0 && (
                <Box title={t("contradictions")} tone="warn">
                  <ul className="space-y-1.5">{o.contradictions.map((c, i) => <li key={i} className="text-[13px]"><p className="font-medium flex items-start gap-1.5"><AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />{c.issue}</p>{c.resolve && <p className="ps-5 text-xs text-muted-foreground">{c.resolve}</p>}</li>)}</ul>
                </Box>
              )}
              {o.missing.length > 0 && (
                <Box title={t("missing")}>
                  <ul className="space-y-1">{o.missing.map((m, i) => <li key={i} className="text-[13px]"><span className={cn("me-1.5 rounded px-1 text-[10px] font-semibold uppercase", m.priority === "high" ? "bg-destructive/15 text-destructive" : m.priority === "medium" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground")}>{t(`pr_${m.priority}`)}</span><span className="font-medium">{m.item}</span>{m.why && <span className="block text-xs text-muted-foreground">{m.why}</span>}</li>)}</ul>
                </Box>
              )}
            </div>
          )}

          {o.differentials.length > 0 && (
            <Box title={t("differentials")}>
              <ul className="divide-y divide-border/40">
                {o.differentials.map((d) => (
                  <li key={d.key} className="py-2 first:pt-0 last:pb-0 space-y-1">
                    <p className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{d.label}</span>{d.localName && <span className="text-xs text-muted-foreground">{d.localName}</span>}<span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">{d.certainty}</span></p>
                    {d.reasoning && <p className="text-[13px]">{d.reasoning}</p>}
                    {d.for.length > 0 && <p className="text-xs"><span className="font-semibold text-emerald-700 dark:text-emerald-400">+</span> {d.for.join(" · ")}</p>}
                    {d.against.length > 0 && <p className="text-xs"><span className="font-semibold text-destructive">−</span> {d.against.join(" · ")}</p>}
                    {d.toConfirm.length > 0 && <p className="text-xs text-muted-foreground"><span className="font-semibold">{t("to_confirm")}:</span> {d.toConfirm.join(" · ")}</p>}
                    <div className="flex gap-1.5 pt-0.5">
                      {inDx(d.marzId, d.label) ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" /> {t("added")}</span> : (
                        <>
                          <Button size="sm" variant="outline" className="h-7" onClick={() => add(d, diagnoses.some((x) => x.role === "working") ? "secondary" : "working")}>{t("add_working")}</Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => add(d, "differential")}>{t("add_diff")}</Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Box>
          )}

          {(o.unani.reasoning || o.unani.mizajAsli || o.unani.suMizaj || o.biomedical) && (
            <div className="grid md:grid-cols-2 gap-2.5">
              {(o.unani.reasoning || o.unani.mizajAsli || o.unani.suMizaj) && (
                <Box title={t("unani")}>
                  <p className="text-[13px]">{[o.unani.mizajAsli && `Mizaj-e-Asli: ${o.unani.mizajAsli}`, o.unani.suMizaj && `Su-e-Mizaj: ${o.unani.suMizaj}`, o.unani.organs.length ? o.unani.organs.join(", ") : null].filter(Boolean).join(" · ")}</p>
                  {o.unani.sabab.length > 0 && <p className="text-xs text-muted-foreground">Sabab: {o.unani.sabab.join("; ")}</p>}
                  {o.unani.reasoning && <p className="mt-1 text-[13px] text-muted-foreground">{o.unani.reasoning}</p>}
                </Box>
              )}
              {o.biomedical && <Box title={t("biomedical")}><p className="text-[13px] text-muted-foreground">{o.biomedical}</p></Box>}
            </div>
          )}

          {o.nextQuestions.length > 0 && (
            <Box title={t("next")}><ul className="space-y-1">{o.nextQuestions.map((q, i) => <li key={i} className="text-[13px]"><span className="font-medium">{q.question}</span>{q.why && <span className="block text-xs text-muted-foreground">{q.why}</span>}</li>)}</ul></Box>
          )}

          {o.draftStatement && (
            <Box title={t("draft")}>
              <p className="text-[13px] italic">“{o.draftStatement}”</p>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7" onClick={() => { onUseStatement(o.draftStatement); setUsed(true); }}>{t("use_draft")}</Button>
                {used && <span className="text-xs text-muted-foreground">{t("used")}</span>}
              </div>
            </Box>
          )}

          {o.limitations && !o.insufficient && <p className="text-xs text-muted-foreground"><span className="font-semibold">{t("limits")}:</span> {o.limitations}</p>}
          {run.removed.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <button type="button" onClick={() => setShowRemoved((v) => !v)} className="inline-flex items-center gap-1 font-medium hover:text-foreground" aria-expanded={showRemoved}>
                <ChevronDown className={cn("h-3 w-3 transition-transform", !showRemoved && "-rotate-90")} /> {t("removed", { count: run.removed.length })}
              </button>
              {showRemoved && <ul className="mt-1 list-disc ps-5 space-y-0.5">{run.removed.map((r, i) => <li key={i}>{t("removed_line", { text: r.text, why: r.why })}</li>)}</ul>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border/40 pt-2.5">
            <span className="text-xs text-muted-foreground me-1">{t("feedback")}</span>
            {(["useful", "incomplete", "wrong", "unsafe"] as const).map((r) => (
              <button key={r} type="button" onClick={() => feedback(r)} aria-pressed={fb === r}
                className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", fb === r ? (r === "useful" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-destructive/40 bg-destructive/10 text-destructive") : "border-border/60 text-muted-foreground hover:text-foreground")}>
                {t(`fb_${r}`)}
              </button>
            ))}
            {fb && <span className="text-xs text-muted-foreground ms-1">{t("fb_thanks")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
