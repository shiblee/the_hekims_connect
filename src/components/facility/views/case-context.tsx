"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, CircleDot, ClipboardList, Info, ListChecks, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDateLocale, useValueLabel } from "@/lib/i18n/use-date-locale";
import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/section-heading";
import type { CaseAlert, CaseContext, ExamSection, ReadinessItem } from "@/lib/case-context";

/** Loads the Stage 5 case context; `reload` after anything that changes the record. */
export function useCaseContext(visitId: string | undefined) {
  const [ctx, setCtx] = useState<CaseContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    if (!visitId) return;
    api.get<{ context: CaseContext }>(`/api/facility/visits/${visitId}/case-context`)
      .then((r) => { setCtx(r.context); setError(null); })
      .catch((e) => setError(e.message || "error"));
  }, [visitId]);
  useEffect(() => { reload(); }, [reload]);
  const patch = async (body: { pregnancyStatus?: string | null; historyReliability?: string | null }) => {
    if (!visitId) return;
    const r = await api.patch<{ context: CaseContext }>(`/api/facility/visits/${visitId}/case-context`, body);
    setCtx(r.context);
  };
  return { ctx, error, reload, patch };
}
export type CaseContextState = ReturnType<typeof useCaseContext>;

const LEVEL = {
  high: { icon: ShieldAlert, cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  caution: { icon: AlertTriangle, cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  info: { icon: Info, cls: "border-border/60 bg-muted/40 text-muted-foreground" },
} as const;

function AlertLine({ a }: { a: CaseAlert }) {
  const t = useTranslations("clinic.case");
  const L = LEVEL[a.level];
  const params = { ...(a.params || {}) } as Record<string, string | number>;
  if (a.key === "history_unreliable" && typeof params.level === "string") params.level = t(`rel_${params.level}`).toLowerCase();
  const text = t(`a_${a.key}`, params);
  return (
    <li className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] leading-snug", L.cls)}>
      <L.icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      {a.source && <Link href={a.source.href} className="shrink-0 text-[13px] font-medium underline-offset-2 hover:underline">{t("stage_n", { n: a.source.stage })}</Link>}
    </li>
  );
}

const STATUS = {
  done: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  partial: { icon: CircleDot, cls: "text-amber-600 dark:text-amber-400" },
  missing: { icon: Circle, cls: "text-muted-foreground" },
  na: { icon: Circle, cls: "text-muted-foreground/40" },
} as const;

/** Right-column card: alerts first, then what's done, partly done or missing — each linking to where to record it. */
export function CaseReadinessCard({ state }: { state: CaseContextState }) {
  const t = useTranslations("clinic.case");
  const { ctx, error, reload, patch } = state;
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  if (error && !ctx) {
    return (
      <Card className="p-4 border-border/50 bg-card/60 text-[15px] text-muted-foreground">
        {t("load_failed", { error })} <button type="button" onClick={reload} className="text-primary font-medium hover:underline">{t("retry")}</button>
      </Card>
    );
  }
  if (!ctx) return null;
  const items = ctx.readiness.filter((r) => r.status !== "na");
  const done = items.filter((r) => r.status === "done").length;
  const save = (body: Parameters<typeof patch>[0]) => patch(body).then(() => setSaveMsg(t("saved_fact")), (e) => setSaveMsg(t("not_saved_fact", { error: e.message })));
  const showPregnancy = ctx.readiness.some((r) => r.key === "pregnancy" && r.status !== "na");
  const alerts = [...ctx.alerts].sort((a, b) => ["high", "caution", "info"].indexOf(a.level) - ["high", "caution", "info"].indexOf(b.level));

  return (
    <Card className="p-4 gap-3 border-border/50 bg-card/60" data-tour="case.readiness">
      <SectionHeading icon={ListChecks} title={t("readiness")} tone={done === items.length ? "success" : "primary"}
        right={<span className="text-[13px] font-medium tabular-nums text-muted-foreground">{t("n_ready", { done, total: items.length })}</span>} />
      <div className="h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden>
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
      </div>

      {alerts.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t("alerts")}</p>
          <ul className="space-y-1.5">{alerts.map((a, i) => <AlertLine key={`${a.key}${i}`} a={a} />)}</ul>
        </div>
      )}

      <ul className="divide-y divide-border/40">
        {items.map((r: ReadinessItem) => {
          const S = STATUS[r.status];
          return (
            <li key={r.key} className="flex items-center gap-2 py-1.5 text-[13px]">
              <S.icon className={cn("h-4 w-4 shrink-0", S.cls)} aria-label={t(`st_${r.status === "na" ? "done" : r.status}`)} />
              <span className={cn("min-w-0 flex-1", r.status === "done" && "text-muted-foreground")}>
                {t(`r_${r.key}`)}
                {r.critical && r.status !== "done" && <span className="ms-1.5 inline-block h-1.5 w-1.5 rounded-full bg-destructive align-middle" title={t("important")} />}
              </span>
              {r.status !== "done" && r.key !== "pregnancy" && (
                <Link href={r.source.href} className="shrink-0 text-[13px] font-medium text-primary hover:underline">{t("stage_n", { n: r.source.stage })}</Link>
              )}
            </li>
          );
        })}
      </ul>

      {/* The two facts recorded right here */}
      <div className="grid gap-2 border-t border-border/40 pt-3">
        {showPregnancy && (
          <label className="grid gap-1 text-[13px]">
            <span className="font-medium">{t("preg_label")}</span>
            <select id="pregnancyStatus" value={ctx.patient.pregnancyStatus ?? ""} onChange={(e) => save({ pregnancyStatus: e.target.value || null })}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-[15px]">
              <option value="">{t("choose")}</option>
              {["pregnant", "breastfeeding", "neither", "unknown"].map((v) => <option key={v} value={v}>{t(`preg_${v}`)}</option>)}
            </select>
          </label>
        )}
        <label className="grid gap-1 text-[13px]">
          <span className="font-medium">{t("rel_label")}</span>
          <select id="historyReliability" value={ctx.patient.historyReliability ?? ""} onChange={(e) => save({ historyReliability: e.target.value || null })}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-[15px]">
            <option value="">{t("choose")}</option>
            {["reliable", "limited", "unreliable"].map((v) => <option key={v} value={v}>{t(`rel_${v}`)}</option>)}
          </select>
        </label>
        {saveMsg && <p className="text-[13px] text-muted-foreground" role="status">{saveMsg}</p>}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Khulasa

function Kind({ k }: { k: "reported" | "examined" | "measured" | "document" | "history" }) {
  const t = useTranslations("clinic.case");
  return <span className="rounded-full border border-border/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t(`k_${k}`)}</span>;
}

function Block({ title, kind, href, stage, children, empty }: { title: string; kind: Parameters<typeof Kind>[0]["k"]; href?: string; stage?: number; children?: ReactNode; empty?: boolean }) {
  const t = useTranslations("clinic.case");
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <Kind k={kind} />
        {href && stage && <Link href={href} className="ms-auto shrink-0 whitespace-nowrap text-[11px] font-medium text-primary hover:underline">{t("stage_n", { n: stage })}</Link>}
      </div>
      {empty ? <p className="text-[13px] text-muted-foreground italic">{t("none_yet")}</p> : children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return <div className="flex flex-wrap gap-1">{items.map((x) => <span key={x} className="rounded-full border border-border/60 bg-card px-2 py-0.5 text-[13px]">{x}</span>)}</div>;
}

function Answers({ sections, limit = 6 }: { sections: ExamSection[]; limit?: number }) {
  const t = useTranslations("clinic.case");
  const [all, setAll] = useState(false);
  const rows = sections.flatMap((s) => s.answers.map((a) => ({ s: s.label, ...a })));
  const shown = all ? rows : rows.slice(0, limit);
  return (
    <>
      <ul className="space-y-0.5 text-[13px]">
        {shown.map((r, i) => <li key={i} className="min-w-0"><span className="text-muted-foreground">{r.question}:</span> <span className="font-medium">{r.answer}</span></li>)}
      </ul>
      {rows.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 text-[13px] font-medium text-primary hover:underline">
          {all ? t("show_less") : t("show_all", { count: rows.length })}
        </button>
      )}
    </>
  );
}

/** Centre-column case summary: everything recorded so far, grouped, sourced and labelled by kind. */
export function CaseSummaryPanel({ state }: { state: CaseContextState }) {
  const t = useTranslations("clinic.case");
  const vl = useValueLabel();
  const dl = useDateLocale();
  const [open, setOpen] = useState(true);
  const { ctx } = state;
  if (!ctx) return null;
  const pid = ctx.patient.id;
  const s2 = `/facility/patients/${pid}/record`, s3 = `/facility/mizaj?patientId=${pid}`;
  const date = (iso: string) => new Date(iso).toLocaleDateString(dl, { dateStyle: "medium" });

  return (
    <Card className="p-5 gap-3 border-border/50 bg-card/60" id="khulasa" data-tour="case.summary">
      <SectionHeading icon={ClipboardList} title={<>{t("summary")} <span className="text-muted-foreground font-normal text-base">· {t("summary_local")}</span></>}
        right={<button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><ChevronDown className={cn("h-4 w-4 transition-transform", !open && "-rotate-90")} /></button>} />
      {open && (
        <>
          <p className="text-[13px] text-muted-foreground -mt-1">{t("summary_hint")}</p>

          <Block title={t("s_presenting")} kind="reported" href={s2} stage={2} empty={!ctx.presenting.complaints.length}>
            <ul className="space-y-2">
              {ctx.presenting.complaints.map((c) => (
                <li key={c.label} className="text-[13px]">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold text-[15px]">{c.label}</span>
                    {c.primary && <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary">{t("primary")}</span>}
                    {c.severity != null && <span className="text-muted-foreground">{t("sev", { n: c.severity })}</span>}
                    {c.duration && <span className="text-muted-foreground">{t("for_dur", { d: c.duration })}</span>}
                    {c.pattern && <span className="text-muted-foreground">· {vl(c.pattern)}</span>}
                    {c.character && <span className="text-muted-foreground">· {c.character}</span>}
                  </p>
                  {c.aggravating.length > 0 && <p><span className="text-muted-foreground">{t("worse")}:</span> {c.aggravating.join(", ")}</p>}
                  {c.relieving.length > 0 && <p><span className="text-muted-foreground">{t("better")}:</span> {c.relieving.join(", ")}</p>}
                  {c.associated.length > 0 && <p><span className="text-muted-foreground">{t("with_")}:</span> {c.associated.join(", ")}</p>}
                </li>
              ))}
            </ul>
          </Block>

          {(ctx.reports.length > 0 || ctx.mizajAssessment) && (
            <div className="grid gap-3">
              {ctx.reports.length > 0 && (
                <Block title={t("s_reports")} kind="document" href={s2} stage={2}>
                  <ul className="space-y-1.5 text-[13px]">
                    {ctx.reports.slice(0, 5).map((r) => (
                      <li key={r.id}>
                        <p><span className="font-medium">{r.title}</span> <span className="text-muted-foreground">· {r.date ? date(r.date) : ""} · </span>
                          <span className={cn(r.flag === "critical" ? "text-destructive font-medium" : r.flag === "abnormal" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{t(`rf_${["normal", "abnormal", "critical"].includes(r.flag) ? r.flag : "unknown"}`)}</span>
                          {!r.reviewed && <span className="text-muted-foreground"> · {t("unreviewed")}</span>}</p>
                        {r.abnormal.length > 0 && <p className="text-[13px] text-muted-foreground">{r.abnormal.map((x) => `${x.name} ${x.value}${x.unit ? ` ${x.unit}` : ""}`).join(" · ")}</p>}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}
              {ctx.mizajAssessment && (
                <Block title={t("s_assessment")} kind="examined" href={s3} stage={3}>
                  <p className="text-[13px]">{ctx.mizajAssessment.result}</p>
                  <p className="text-[13px] text-muted-foreground">{date(ctx.mizajAssessment.date)}{ctx.mizajAssessment.pulse ? ` · ${ctx.mizajAssessment.pulse}` : ""}</p>
                </Block>
              )}
            </div>
          )}

          <Block title={t("s_previous")} kind="history">
            {ctx.previousVisits.length === 0 ? <p className="text-[13px] text-muted-foreground">{t("first_visit")}</p> : (
              <ul className="space-y-1.5 text-[13px]">
                {ctx.previousVisits.map((v) => (
                  <li key={v.id}>
                    <p><span className="font-medium">{date(v.date)}</span> <span className="text-muted-foreground">· {v.code}{v.complaints.length ? ` · ${v.complaints.join(", ")}` : ""}</span></p>
                    <p className="text-[13px] text-muted-foreground">
                      {v.dossier ? [v.dossier.diagnoses.join(", "), v.dossier.suMizaj, v.dossier.organs.join(", "), v.dossier.prognosis].filter(Boolean).join(" · ") || v.dossier.statement || t("prev_no_dossier") : t("prev_no_dossier")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </>
      )}
    </Card>
  );
}

/** Follow-up visits: the last visit's Tashkhees beside today's, and how the patient responded to that plan. */
export function FollowUpCard({ state, response, note, onChange }: { state: CaseContextState; response: string | null; note: string | null; onChange: (p: { treatmentResponse?: string | null; treatmentResponseNote?: string | null }) => void }) {
  const t = useTranslations("clinic.case");
  const dl = useDateLocale();
  const ctx = state.ctx;
  if (!ctx || !ctx.visit.followUp) return null;
  const last = ctx.previousVisits[0];
  const dx = last.dossier;
  const RESP = ["improved", "partly", "unchanged", "worse", "new_problem"] as const;
  return (
    <Card className="p-5 gap-3 border-border/50 bg-card/60">
      <SectionHeading icon={ClipboardList} title={t("fu_title")} />
      <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-[13px]">
        <p className="font-medium">{t("fu_last", { date: new Date(last.date).toLocaleDateString(dl, { dateStyle: "medium" }) })} {last.complaints.length > 0 && <span className="text-muted-foreground font-normal">· {last.complaints.join(", ")}</span>}</p>
        {dx ? <p className="text-muted-foreground mt-0.5">{[dx.diagnoses.join(", "), dx.suMizaj, dx.organs.join(", "), dx.prognosis].filter(Boolean).join(" · ") || dx.statement}</p> : <p className="text-muted-foreground mt-0.5">{t("fu_none")}</p>}
      </div>
      <div>
        <p className="text-[15px] font-medium mb-1.5">{t("fu_response")}</p>
        <div className="flex flex-wrap gap-1.5">
          {RESP.map((r) => (
            <button key={r} type="button" onClick={() => onChange({ treatmentResponse: response === r ? null : r })} aria-pressed={response === r}
              className={cn("rounded-full border px-3 py-1 text-[13px] transition-colors", response === r ? (r === "worse" || r === "new_problem" ? "border-destructive/50 bg-destructive/10 text-destructive" : r === "unchanged" ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300") : "border-border/60 text-muted-foreground hover:text-foreground")}>
              {t(`resp_${r}`)}
            </button>
          ))}
        </div>
        <input id="treatmentResponseNote" value={note ?? ""} onChange={(e) => onChange({ treatmentResponseNote: e.target.value || null })} placeholder={t("fu_note")} maxLength={1000}
          className="mt-2 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[15px]" />
      </div>
    </Card>
  );
}
