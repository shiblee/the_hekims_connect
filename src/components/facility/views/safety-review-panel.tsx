"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ClipboardList, Pill, ShieldAlert, ShieldCheck, Square, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { FiveRowList } from "@/components/shared/five-row-list";
import type { SafetyItem, SafetyReview } from "@/lib/safety-review";

/**
 * Stage 5 safety review, two columns: high-risk items each need the Hakim's reason for continuing
 * before the dossier can be finalised (the server enforces it too); cautions can be acknowledged but
 * don't block. Items still to review come first. Refreshes when `refreshKey` changes.
 */
const KIND_ICON = { case: UserRound, medicine: Pill, missing: ClipboardList, dontmiss: Square };

export function SafetyReviewPanel({ visitId, refreshKey, onBlocking }: { visitId: string; refreshKey: string; onBlocking: (n: number | null) => void }) {
  const t = useTranslations("clinic.safety");
  const tc = useTranslations("clinic.case");
  const dl = useDateLocale();
  const [data, setData] = useState<SafetyReview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ackOpen, setAckOpen] = useState<string | null>(null);

  const load = useCallback(() => api.get<SafetyReview>(`/api/facility/visits/${visitId}/safety`)
    .then((r) => { setData(r); setFailed(false); onBlocking(r.blocking); })
    .catch(() => { setFailed(true); onBlocking(null); }), [visitId, onBlocking]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const post = async (body: { key: string; reason?: string; remove?: boolean }) => {
    setBusy(body.key); setErr(null);
    try { const r = await api.post<SafetyReview>(`/api/facility/visits/${visitId}/safety`, body); setData(r); onBlocking(r.blocking); setReasons((x) => ({ ...x, [body.key]: "" })); }
    catch (e: any) { setErr(t("not_saved", { error: e.message })); load(); }
    finally { setBusy(null); }
  };

  const text = (i: SafetyItem) => {
    if (i.kind === "case" && i.alertKey) {
      const params = { ...(i.params || {}) } as Record<string, string | number>;
      if (i.alertKey === "history_unreliable" && typeof params.level === "string") params.level = tc(`rel_${params.level}`).toLowerCase();
      return tc(`a_${i.alertKey}`, params);
    }
    if (i.kind === "missing" && i.alertKey) return t(`m_${i.alertKey}`);
    return i.text ?? "";
  };
  const risky = (data?.items || []).filter((i) => i.level !== "info");
  const checklist = (data?.items || []).filter((i) => i.kind === "dontmiss");
  const inColumn = (level: "high" | "caution") => risky.filter((i) => i.level === level).sort((a, b) => Number(!!a.ack) - Number(!!b.ack));

  const ackForm = (i: SafetyItem) => (
    <div className="mt-1.5 flex items-center gap-2">
      <input id={`ack-${i.key}`} autoFocus={i.level === "caution"} value={reasons[i.key] ?? ""} onChange={(e) => setReasons((x) => ({ ...x, [i.key]: e.target.value }))} placeholder={t("reason")} maxLength={500}
        aria-label={t("reason")} className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs" />
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy === i.key || (reasons[i.key] ?? "").trim().length < 3} onClick={() => post({ key: i.key, reason: reasons[i.key] })}>{t("acknowledge")}</Button>
    </div>
  );

  const row = (i: SafetyItem) => {
    const high = i.level === "high";
    const Icon = KIND_ICON[i.kind];
    return (
      <li key={i.key} className={cn("flex items-start gap-2.5 rounded-lg border bg-background/70 p-2", i.ack ? "border-border/50" : high ? "border-destructive/40" : "border-amber-500/30")}>
        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", i.ack ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : high ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
          {i.ack ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className={cn("min-w-0 flex-1 text-[13px] leading-snug", i.ack && "text-muted-foreground")}>
              {i.medicine && <span className={cn("font-semibold", !i.ack && "text-foreground")}>{i.medicine} · </span>}{text(i)}
            </p>
            {!high && !i.ack && ackOpen !== i.key && <button type="button" onClick={() => setAckOpen(i.key)} className="shrink-0 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">{t("acknowledge")}</button>}
          </div>
          {i.ack ? (
            <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="min-w-0 flex-1 truncate" title={t("acked", { by: i.ack.byName || "—", when: new Date(i.ack.at).toLocaleString(dl, { dateStyle: "medium", timeStyle: "short" }), reason: i.ack.reason })}>{t("acked", { by: i.ack.byName || "—", when: new Date(i.ack.at).toLocaleString(dl, { dateStyle: "medium", timeStyle: "short" }), reason: i.ack.reason })}</span>
              <button type="button" onClick={() => post({ key: i.key, remove: true })} disabled={busy === i.key} className="shrink-0 font-medium hover:text-foreground hover:underline">{t("withdraw")}</button>
            </p>
          ) : (high || ackOpen === i.key) && ackForm(i)}
        </div>
      </li>
    );
  };

  const column = (level: "high" | "caution") => {
    const high = level === "high";
    const items = inColumn(level);
    const done = items.filter((i) => i.ack).length;
    const Icon = high ? ShieldAlert : AlertTriangle;
    return (
      <section className={cn("flex min-w-0 flex-col rounded-xl border p-3", high ? "border-destructive/25 bg-destructive/[0.04]" : "border-amber-500/25 bg-amber-500/[0.04]")}>
        <p className={cn("mb-2 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide", high ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>
          <Icon className="h-4 w-4 shrink-0" />{t(`lv_${level}`)}
          <span className="ms-auto rounded-full bg-background/80 px-1.5 text-[11px] tabular-nums normal-case tracking-normal">{done ? t("n_reviewed", { done, total: items.length }) : items.length}</span>
        </p>
        {items.length ? <FiveRowList>{items.map(row)}</FiveRowList> : <p className="grow px-1 py-2 text-[13px] text-muted-foreground">{t(high ? "none_high" : "none_caution")}</p>}
      </section>
    );
  };

  return (
    <Card className="p-5 gap-3 border-border/50 bg-card/60">
      <SectionHeading icon={data && data.blocking === 0 ? ShieldCheck : ShieldAlert} tone={data && data.blocking === 0 ? "success" : "danger"} title={t("title")}
        right={data ? <span className={cn("text-xs font-medium", data.blocking ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{data.blocking ? t("n_to_review", { count: data.blocking }) : risky.length ? t("reviewed") : t("all_clear")}</span> : null} />
      {failed ? <p className="text-sm text-muted-foreground">{t.rich("failed", { retry: (c) => <button type="button" onClick={() => load()} className="text-primary font-medium hover:underline">{c}</button> })}</p>
        : !data ? <div className="h-12 animate-pulse rounded-lg bg-muted/50" /> : (
          <>
            {risky.length > 0 && <div className="@container"><div className="grid gap-3 @2xl:grid-cols-2">{column("high")}{column("caution")}</div></div>}
            {checklist.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dont_miss")}<span className="ms-2 text-xs font-normal normal-case tracking-normal">{t("dont_miss_hint")}</span></p>
                <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                  {checklist.map((i) => <li key={i.key} className="flex items-start gap-2 text-[13px]"><Square className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" /><span><span className="font-medium">{i.text}</span> <span className="text-muted-foreground">— {i.why}</span></span></li>)}
                </ul>
              </div>
            )}
            {!risky.length && !checklist.length && <p className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> {t("all_clear")}</p>}
            {err && <p className="text-xs text-destructive" role="alert">{err}</p>}
          </>
        )}
    </Card>
  );
}
