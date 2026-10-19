"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
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
const PERIODS = [["today", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["365", "Last 12 months"], ["all", "All time"]] as const;
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
    } catch (e: any) { setError(e.message || "Network error"); }
    finally { setLoading(false); }
  }, [scope, period, status, query, page]);
  useEffect(() => { load(); }, [load]);
  const reset = (fn: () => void) => { fn(); setPage(1); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold"><Wallet className="h-6 w-6 text-primary" /> Payments</h1>
          <p className="text-sm text-muted-foreground">{data?.canSeeAll ? "Clinic collections, receipts, cancellations and refunds." : "Payments you collected, with their receipts."} Payments are never deleted — a cancellation or refund is recorded with its reason.</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/facility/reception")}>Record a payment from the Reception desk</Button>
      </div>

      {fin && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([["Today", fin.today], ["Last 7 days", fin.last7], ["Last 30 days", fin.last30], ["Last 12 months", fin.last12m]] as const).map(([l, x]) => (
              <Card key={l} className="gap-1 border-border/50 bg-card/60 p-4">
                <p className="text-xs text-muted-foreground">Net collected <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">{l}</span></p>
                <p className="text-3xl font-bold tabular-nums">{inr(x.net)}</p>
                <p className="text-xs text-muted-foreground">{x.count} payment{x.count === 1 ? "" : "s"} · received {inr(x.collected)}{x.refunded ? ` · refunded ${inr(x.refunded)}` : ""}{x.cancelled ? ` · ${x.cancelled} cancelled` : ""}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card className="gap-2 border-border/50 bg-card/60 p-4">
              <p className="text-sm font-semibold">Net collected per day <span className="font-normal text-muted-foreground">· last 30 days</span></p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={fin.daily} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                  <XAxis dataKey="key" tickFormatter={(k) => new Date(`${k}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip formatter={(v) => inr(Number(v))} labelFormatter={(k) => new Date(`${k}T00:00:00`).toLocaleDateString()} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="net" name="Net" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="gap-3 border-border/50 bg-card/60 p-4">
              {([["By payment method", fin.byMode], ["By collector", fin.byCollector]] as const).map(([t, list]) => (
                <div key={t}>
                  <p className="mb-1 text-sm font-semibold">{t} <span className="font-normal text-muted-foreground">· 30 days</span></p>
                  {list.length === 0 ? <p className="text-xs text-muted-foreground">No payments yet.</p> : list.map((x) => (
                    <div key={x.name} className="flex items-center justify-between border-b border-border/60 py-1 text-sm last:border-0"><span className="text-muted-foreground">{x.name} <span className="text-xs">({x.count})</span></span><span className="font-semibold tabular-nums">{inr(x.net)}</span></div>
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
            {([["all", "All payments"], ["mine", "Collected by me"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => reset(() => setScope(k))} className={cn("rounded-md px-3 py-1.5 text-sm", scope === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
        )}
        <Select value={period} onValueChange={(v) => reset(() => setPeriod(v))}>
          <SelectTrigger className="w-40 bg-background/60" aria-label="Period"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => reset(() => setStatus(v))}>
          <SelectTrigger className="w-40 bg-background/60" aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {(Object.keys(PAYMENT_STATE_LABEL) as PaymentState[]).map((k) => <SelectItem key={k} value={k}>{PAYMENT_STATE_LABEL[k]}</SelectItem>)}
          </SelectContent>
        </Select>
        <form className="relative" onSubmit={(e) => { e.preventDefault(); reset(() => setQuery(q.trim())); }}>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== query && reset(() => setQuery(q.trim()))} placeholder="Receipt, patient, visit, reference…" className="w-64 bg-background/60 pl-9" />
        </form>
        {data && <span className="ml-auto text-sm text-muted-foreground">{data.totals.count} payment{data.totals.count === 1 ? "" : "s"} · net <b className="text-foreground">{inr(data.totals.net)}</b></span>}
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Payments couldn&apos;t be loaded — {error}. <button className="underline" onClick={load}>Try again</button></p>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2.5">Receipt</th><th className="px-3 py-2.5">Patient</th><th className="px-3 py-2.5">For</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5">Method</th><th className="px-3 py-2.5">Collected by</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</td></tr>
            ) : data && data.payments.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">No payments for these filters.</td></tr>
            ) : data?.payments.map((r) => (
              <tr key={r.id} className={cn("align-top", r.state === "cancelled" && "opacity-60")}>
                <td className="px-3 py-2.5"><p className="font-mono text-xs font-medium">{r.paymentCode}</p><p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p></td>
                <td className="px-3 py-2.5"><p className="font-medium">{r.visit.patient.name}</p><p className="text-xs text-muted-foreground">{r.visit.patient.patientCode ?? "—"} · {r.visit.visitCode}</p></td>
                <td className="px-3 py-2.5 text-xs">{r.feeName ?? "—"}{r.overrideReason && <span className="block text-amber-700 dark:text-amber-400" title={r.overrideReason}>Changed amount: {r.overrideReason}</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={cn(r.state === "cancelled" && "line-through")}>{inr(r.amount)}</span>
                  {r.refundAmount ? <span className="block text-xs text-amber-700 dark:text-amber-400">−{inr(r.refundAmount)} refunded</span> : null}
                </td>
                <td className="px-3 py-2.5 text-xs">{r.mode}{r.referenceNumber && <span className="block text-muted-foreground">Ref {r.referenceNumber}</span>}</td>
                <td className="px-3 py-2.5 text-xs">{r.collectedBy}</td>
                <td className="px-3 py-2.5"><Badge variant="outline" className={STATE_TONE[r.state]} title={r.cancelReason ?? r.refundReason ?? undefined}>{PAYMENT_STATE_LABEL[r.state]}</Badge></td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => router.push(`/facility/payments/${r.id}/receipt`)}><Receipt className="h-3.5 w-3.5" /> Receipt</Button>
                    {data.canRefund && r.state === "paid" && <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600" onClick={() => setAction({ row: r, kind: "cancel" })}><Ban className="h-3.5 w-3.5" /> Cancel</Button>}
                    {data.canRefund && (r.state === "paid" || r.state === "partially_refunded") && <Button size="sm" variant="ghost" className="h-8 px-2 text-amber-700" onClick={() => setAction({ row: r, kind: "refund" })}><RotateCcw className="h-3.5 w-3.5" /> Refund</Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}><ChevronLeft className="h-4 w-4" /> Newer</Button>
          Page {page} of {pages}
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>Older <ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      <Dialog open={!!action} onOpenChange={(o) => { if (!o) setAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{action?.kind === "cancel" ? "Cancel payment" : "Refund payment"} · {action?.row.paymentCode}</DialogTitle></DialogHeader>
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
  const submit = async () => {
    setSaving(true); setError("");
    try { await api.post(`/api/facility/payments/${row.id}`, { action: kind, reason, amount: kind === "refund" ? amount : undefined }); onDone(); }
    catch (e: any) { setError(e.message || "Not saved"); }
    finally { setSaving(false); }
  };
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {row.visit.patient.name} · {inr(row.amount)} by {row.mode}.{" "}
        {kind === "cancel" ? "Use this when the payment was recorded by mistake — the whole amount is void. The receipt stays, marked Cancelled." : `Money returned to the patient (up to ${inr(left)}). The receipt shows the refund.`}
      </p>
      <div className="space-y-3 pt-1">
        {kind === "refund" && <FloatingField id="refAmount" type="number" label="Refund amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        <FloatingField id="refReason" label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>Keep as is</Button>
        <Button variant={kind === "cancel" ? "destructive" : "default"} onClick={submit} disabled={saving || reason.trim().length < 3}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} {kind === "cancel" ? "Cancel payment" : `Refund ₹${amount || 0}`}</Button>
      </DialogFooter>
    </>
  );
}
