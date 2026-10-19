"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useDateLocale, useValueLabel } from "@/lib/i18n/use-date-locale";
import { cn, formatDateTime } from "@/lib/utils";
import { PAYMENT_STATE_LABEL, type PaymentState } from "@/lib/payments";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloatingField } from "@/components/shared/floating-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Ban, ChevronLeft, ChevronRight, Loader2, Receipt, RotateCcw, Search, Wallet } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Row {
  id: string; paymentCode: string; amount: number; net: number; mode: string; state: PaymentState; referenceNumber: string | null; createdAt: string;
  feeName: string | null; overrideReason: string | null; refundAmount: number | null; cancelReason: string | null; refundReason: string | null; collectedBy: string;
  visit: { id: string; visitCode: string; patient: { id: string; name: string; patientCode: string | null } };
}
interface ListResp { scope: "all" | "mine"; canSeeAll: boolean; canRefund: boolean; total: number; page: number; pageSize: number; totals: { net: number; count: number }; payments: Row[] }
interface Period { collected: number; refunded: number; net: number; count: number; cancelled: number }
interface Finance { today: Period; last7: Period; last30: Period; last12m: Period; byMode: { name: string; net: number; count: number }[]; byCollector: { name: string; net: number; count: number }[]; daily: { key: string; net: number }[] }

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const PERIODS = ["today", "7", "30", "365", "all"] as const;
const fromOf = (r: string) => { if (r === "all") return null; const d = new Date(); d.setHours(0, 0, 0, 0); if (r !== "today") d.setDate(d.getDate() - (Number(r) - 1)); return d.toISOString(); };
const STATE_TONE: Record<PaymentState, string> = {
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  refunded: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  partially_refunded: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

/** Payments: own collections for collectors; clinic finances and all payments for those allowed. */
export function PaymentsView() {
  const router = useRouter();
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [period, setPeriod] = useState("today");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState(""); const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [fin, setFin] = useState<Finance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<{ row: Row; kind: "cancel" | "refund" } | null>(null);
  const t = useTranslations("clinic.payments");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const val = useValueLabel();

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ scope, page: String(page) });
    const from = fromOf(period); if (from) p.set("from", from);
    if (status !== "all") p.set("status", status);
    if (query) p.set("q", query);
    try {
      const r = await api.get<ListResp>(`/api/facility/payments?${p}`);
      setData(r); setError("");
      if (r.canSeeAll) api.get<Finance>(`/api/facility/finance?tz=${-new Date().getTimezoneOffset()}`).then(setFin).catch(() => {});
    } catch (e: any) { setError(e.message || tc("network_error")); }
    finally { setLoading(false); }
  }, [scope, period, status, query, page, tc]);
  useEffect(() => { load(); }, [load]);
  const reset = (fn: () => void) => { fn(); setPage(1); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold"><Wallet className="h-6 w-6 text-primary" /> {t("title")}</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/facility/reception")}>{t("record_from_desk")}</Button>
      </div>

      {fin && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-tour="payments.totals">
            {([[t("p_today"), fin.today], [t("p_7"), fin.last7], [t("p_30"), fin.last30], [t("p_365"), fin.last12m]] as const).map(([l, x]) => (
              <Card key={l} className="gap-1 border-border/50 bg-card/60 p-4">
                <p className="text-xs text-muted-foreground">{t("net_collected")} <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">{l}</span></p>
                <p className="text-3xl font-bold tabular-nums">{inr(x.net)}</p>
                <p className="text-xs text-muted-foreground">{t("period_sub", { count: x.count, received: inr(x.collected) })}{x.refunded ? ` · ${t("refunded_amt", { amount: inr(x.refunded) })}` : ""}{x.cancelled ? ` · ${t("cancelled_n", { count: x.cancelled })}` : ""}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="gap-2 border-border/50 bg-card/60 p-4">
              <p className="text-sm font-semibold">{t("per_day")} <span className="font-normal text-muted-foreground">· {t("last_30")}</span></p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fin.daily} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <XAxis dataKey="key" tickFormatter={(k) => new Date(`${k}T00:00:00`).toLocaleDateString(dl, { day: "numeric", month: "short" })} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(v) => inr(Number(v))} labelFormatter={(k) => new Date(`${k}T00:00:00`).toLocaleDateString(dl)} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="net" name={t("net")} fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="gap-3 border-border/50 bg-card/60 p-4">
              {([[t("by_mode"), fin.byMode, true], [t("by_collector"), fin.byCollector, false]] as const).map(([title, list, isMode]) => (
                <div key={title}>
                  <p className="mb-1 text-sm font-semibold">{title} <span className="font-normal text-muted-foreground">· {t("days_30")}</span></p>
                  {list.length === 0 ? <p className="text-xs text-muted-foreground">{t("none_yet")}</p> : list.map((x) => (
                    <div key={x.name} className="flex items-center justify-between border-b border-border/60 py-1 text-sm last:border-0"><span className="text-muted-foreground">{isMode ? val(x.name) : x.name} <span className="text-xs">({x.count})</span></span><span className="font-semibold tabular-nums">{inr(x.net)}</span></div>
                  ))}
                </div>
              ))}
            </Card>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {data?.canSeeAll && (
          <div className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
            {([["all", t("all_payments")], ["mine", t("mine")]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => reset(() => setScope(k))} className={cn("rounded-md px-3 py-1.5 text-sm", scope === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
        )}
        <Select value={period} onValueChange={(v) => reset(() => setPeriod(v))}>
          <SelectTrigger className="w-40 bg-background/60" aria-label={t("period")}><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map((k) => <SelectItem key={k} value={k}>{t(`p_${k}`)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => reset(() => setStatus(v))}>
          <SelectTrigger className="w-40 bg-background/60" aria-label={t("status")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("any_status")}</SelectItem>
            {(Object.keys(PAYMENT_STATE_LABEL) as PaymentState[]).map((k) => <SelectItem key={k} value={k}>{t(`st_${k}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <form className="relative" onSubmit={(e) => { e.preventDefault(); reset(() => setQuery(q.trim())); }}>
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== query && reset(() => setQuery(q.trim()))} data-tour="payments.search" placeholder={t("search")} className="w-64 bg-background/60 ps-9" />
        </form>
        {data && <span className="ms-auto text-sm text-muted-foreground">{t("totals", { count: data.totals.count })} <b className="text-foreground">{inr(data.totals.net)}</b></span>}
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{t("load_failed", { error })} <button className="underline" onClick={load}>{tc("retry")}</button></p>}

      <div data-tour="payments.list" className="overflow-x-auto rounded-xl border border-border bg-card/60">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2.5">{t("col_receipt")}</th><th className="px-3 py-2.5">{t("col_patient")}</th><th className="px-3 py-2.5">{t("col_for")}</th><th className="px-3 py-2.5 text-end">{t("col_amount")}</th><th className="px-3 py-2.5">{t("col_method")}</th><th className="px-3 py-2.5">{t("col_by")}</th><th className="px-3 py-2.5">{t("status")}</th><th className="px-3 py-2.5 text-end">{t("col_actions")}</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground"><Loader2 className="me-2 inline h-4 w-4 animate-spin" />{tc("loading")}</td></tr>
            ) : data && data.payments.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{t("none_filtered")}</td></tr>
            ) : data?.payments.map((r) => (
              <tr key={r.id} className={cn("align-top", r.state === "cancelled" && "opacity-60")}>
                <td className="px-3 py-2.5"><p className="font-mono text-xs font-medium">{r.paymentCode}</p><p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p></td>
                <td className="px-3 py-2.5"><p className="font-medium">{r.visit.patient.name}</p><p className="text-xs text-muted-foreground">{r.visit.patient.patientCode ?? "—"} · {r.visit.visitCode}</p></td>
                <td className="px-3 py-2.5 text-xs">{r.feeName ?? "—"}{r.overrideReason && <span className="block text-amber-700 dark:text-amber-400" title={r.overrideReason}>{t("changed_amount", { reason: r.overrideReason })}</span>}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">
                  <span className={cn(r.state === "cancelled" && "line-through")}>{inr(r.amount)}</span>
                  {r.refundAmount ? <span className="block text-xs text-amber-700 dark:text-amber-400">{t("refunded_line", { amount: inr(r.refundAmount) })}</span> : null}
                </td>
                <td className="px-3 py-2.5 text-xs">{val(r.mode)}{r.referenceNumber && <span className="block text-muted-foreground">{t("ref", { ref: r.referenceNumber })}</span>}</td>
                <td className="px-3 py-2.5 text-xs">{r.collectedBy}</td>
                <td className="px-3 py-2.5"><Badge variant="outline" className={STATE_TONE[r.state]} title={r.cancelReason ?? r.refundReason ?? undefined}>{t(`st_${r.state}`)}</Badge></td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => router.push(`/facility/payments/${r.id}/receipt`)}><Receipt className="h-3.5 w-3.5" /> {t("receipt")}</Button>
                    {data.canRefund && r.state === "paid" && <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => setAction({ row: r, kind: "cancel" })}><Ban className="h-3.5 w-3.5" /> {t("cancel")}</Button>}
                    {data.canRefund && (r.state === "paid" || r.state === "partially_refunded") && <Button size="sm" variant="ghost" className="h-8 px-2 text-amber-700" onClick={() => setAction({ row: r, kind: "refund" })}><RotateCcw className="h-3.5 w-3.5" /> {t("refund")}</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t("newer")}</Button>
          {t("page_of", { page, pages })}
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>{t("older")} <ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
        </div>
      )}

      <Dialog open={!!action} onOpenChange={(o) => { if (!o) setAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{action?.kind === "cancel" ? t("cancel_title") : t("refund_title")} · {action?.row.paymentCode}</DialogTitle></DialogHeader>
          {action && <CancelRefundForm key={action.row.id + action.kind} row={action.row} kind={action.kind} onDone={() => { setAction(null); load(); }} onClose={() => setAction(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CancelRefundForm({ row, kind, onDone, onClose }: { row: Row; kind: "cancel" | "refund"; onDone: () => void; onClose: () => void }) {
  const left = Math.round((row.amount - (row.refundAmount ?? 0)) * 100) / 100;
  const [amount, setAmount] = useState(String(left));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const t = useTranslations("clinic.payments");
  const val = useValueLabel();
  const submit = async () => {
    setSaving(true); setError("");
    try { await api.post(`/api/facility/payments/${row.id}`, { action: kind, reason, amount: kind === "refund" ? amount : undefined }); onDone(); }
    catch (e: any) { setError(e.message || t("not_saved")); }
    finally { setSaving(false); }
  };
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t("by_mode_line", { name: row.visit.patient.name, amount: inr(row.amount), mode: val(row.mode) })}{" "}
        {kind === "cancel" ? t("cancel_hint") : t("refund_hint", { max: inr(left) })}
      </p>
      <div className="space-y-3 pt-1">
        {kind === "refund" && <FloatingField id="refAmount" type="number" label={t("refund_amount")} value={amount} onChange={(e) => setAmount(e.target.value)} />}
        <FloatingField id="refReason" label={t("reason_required")} value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>{t("keep")}</Button>
        <Button variant={kind === "cancel" ? "destructive" : "default"} onClick={submit} disabled={saving || reason.trim().length < 3}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {kind === "cancel" ? t("cancel_title") : t("refund_x", { amount: amount || 0 })}</Button>
      </DialogFooter>
    </>
  );
}
