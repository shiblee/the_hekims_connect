"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck, Square } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import type { SafetyItem, SafetyReview } from "@/lib/safety-review";

/**
 * Stage 5 safety review: high-risk items each need the Hakim's reason for continuing before
 * the dossier can be finalised (the server enforces it too). Refreshes when `refreshKey` changes.
 */
export function SafetyReviewPanel({ visitId, refreshKey, onBlocking }: { visitId: string; refreshKey: string; onBlocking: (n: number | null) => void }) {
  const t = useTranslations("clinic.safety");
  const tc = useTranslations("clinic.case");
  const dl = useDateLocale();
  const [data, setData] = useState<SafetyReview | null>(null);
  const [failed, setFailed] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    return i.medicine ? `${i.medicine}: ${i.text}` : i.text ?? "";
  };
  const risky = (data?.items || []).filter((i) => i.level !== "info");
  const checklist = (data?.items || []).filter((i) => i.kind === "dontmiss");

  return (
    <Card className="p-5 gap-3 border-border/50 bg-card/60">
      <SectionHeading icon={data && data.blocking === 0 ? ShieldCheck : ShieldAlert} tone={data && data.blocking === 0 ? "success" : "danger"} title={t("title")}
        right={data ? <span className={cn("text-xs font-medium", data.blocking ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>{data.blocking ? t("n_to_review", { count: data.blocking }) : risky.length ? t("reviewed") : t("all_clear")}</span> : null} />
      {failed ? <p className="text-sm text-muted-foreground">{t.rich("failed", { retry: (c) => <button type="button" onClick={() => load()} className="text-primary font-medium hover:underline">{c}</button> })}</p>
        : !data ? <div className="h-12 animate-pulse rounded-lg bg-muted/50" /> : (
          <>
            {risky.length > 0 && (
              <ul className="space-y-2">
                {risky.map((i) => (
                  <li key={i.key} className={cn("rounded-lg border p-3 space-y-2", i.level === "high" ? (i.ack ? "border-destructive/25 bg-destructive/5" : "border-destructive/50 bg-destructive/10") : "border-amber-500/40 bg-amber-500/5")}>
                    <div className="flex items-start gap-2">
                      {i.level === "high" ? <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />}
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-[11px] font-semibold uppercase tracking-wide", i.level === "high" ? "text-destructive" : "text-amber-700 dark:text-amber-400")}>{t(`lv_${i.level}`)}</p>
                        <p className="text-sm">{text(i)}</p>
                      </div>
                    </div>
                    {i.ack ? (
                      <div className="flex flex-wrap items-center gap-2 ps-6">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs text-muted-foreground min-w-0 flex-1">{t("acked", { by: i.ack.byName || "—", when: new Date(i.ack.at).toLocaleString(dl, { dateStyle: "medium", timeStyle: "short" }), reason: i.ack.reason })}</span>
                        <button type="button" onClick={() => post({ key: i.key, remove: true })} disabled={busy === i.key} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">{t("withdraw")}</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 ps-6">
                        <input id={`ack-${i.key}`} value={reasons[i.key] ?? ""} onChange={(e) => setReasons((x) => ({ ...x, [i.key]: e.target.value }))} placeholder={t("reason")} maxLength={500}
                          aria-label={t("reason")} className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-sm" />
                        <Button size="sm" variant="outline" className="h-8" disabled={busy === i.key || (reasons[i.key] ?? "").trim().length < 3} onClick={() => post({ key: i.key, reason: reasons[i.key] })}>{t("acknowledge")}</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {checklist.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-background/40 p-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{t("dont_miss")}</p>
                <p className="text-xs text-muted-foreground mb-1.5">{t("dont_miss_hint")}</p>
                <ul className="space-y-1">
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
