"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Loader2, Building2, User, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn, formatDateTime } from "@/lib/utils";
import { PAYMENT_STATE_LABEL, type PaymentState } from "@/lib/payments";
import { sortLabels } from "@/lib/sort-options";

interface PaymentRow {
  id: string; paymentCode: string; amount: number; net: number; mode: string; state: PaymentState; createdAt: string;
  feeName: string | null; overrideReason: string | null; refundAmount: number | null; refundReason: string | null; cancelReason: string | null; referenceNumber: string | null;
  visit: { id: string; visitCode: string; facility: { id: string; facilityName: string }; patient: { id: string; name: string; patientCode: string | null } };
  recordedBy: { id: string; name: string; staffCode: string } | null;
}
interface Bucket { key: string; name: string; net: number; received: number; refunded: number; count: number; cancelled: number }
interface Summary { net: number; received: number; refunded: number; count: number; cancelled: number; byMode: Bucket[]; byFacility: Bucket[]; byStaff: Bucket[] }
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface FacilityOption { id: string; facilityName: string }

const MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Other"];

/** Today in the admin's own time zone (toISOString would give the UTC date). */
function todayStr() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [facilityId, setFacilityId] = useState("all");
  const [mode, setMode] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    adminApi.get<{ facilities: FacilityOption[] }>("/api/admin/facilities?pageSize=100")
      .then((res) => setFacilities(res.facilities || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to, tz: String(-new Date().getTimezoneOffset()) });
    if (status !== "all") params.set("status", status);
    if (facilityId !== "all") params.set("facilityId", facilityId);
    if (mode !== "all") params.set("mode", mode);
    try {
      const res = await adminApi.get<{ payments: PaymentRow[]; summary: Summary }>(`/api/admin/payments?${params}`);
      setPayments(res.payments || []); setSummary(res.summary);
    } catch { toast.error("Could not load payments"); }
    finally { setLoading(false); }
  }, [from, to, facilityId, mode, status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" /> Payments
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Cash and payment collection across all facilities — reconcile by day, facility, mode and cashier.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-background/60 w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-background/60 w-40" />
        </div>
        <Select value={facilityId} onValueChange={setFacilityId}>
          <SelectTrigger className="w-56 bg-background/60"><SelectValue placeholder="All facilities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All facilities</SelectItem>
            {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.facilityName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="w-44 bg-background/60"><SelectValue placeholder="All modes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            {sortLabels(MODES).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-background/60"><SelectValue placeholder="Any status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {(Object.keys(PAYMENT_STATE_LABEL) as PaymentState[]).map((k) => <SelectItem key={k} value={k}>{PAYMENT_STATE_LABEL[k]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {/* Summary — net of refunds; cancelled payments count for nothing */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 border-primary/30 bg-primary/5">
              <p className="text-sm text-muted-foreground">Net collected</p>
              <p className="text-2xl font-bold mt-1 tabular-nums">{inr(summary?.net ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary?.count ?? 0} payment{summary?.count === 1 ? "" : "s"}</p>
            </Card>
            <Card className="p-4 border-border/50 bg-card/60"><p className="text-sm text-muted-foreground">Received</p><p className="text-2xl font-bold mt-1 tabular-nums">{inr(summary?.received ?? 0)}</p></Card>
            <Card className="p-4 border-border/50 bg-card/60"><p className="text-sm text-muted-foreground">Refunded</p><p className="text-2xl font-bold mt-1 tabular-nums">{inr(summary?.refunded ?? 0)}</p></Card>
            <Card className="p-4 border-border/50 bg-card/60"><p className="text-sm text-muted-foreground">Cancelled</p><p className="text-2xl font-bold mt-1 tabular-nums">{summary?.cancelled ?? 0}</p><p className="text-xs text-muted-foreground mt-1">not counted in totals</p></Card>
          </div>

          {summary && summary.count + summary.cancelled > 0 && (
            <div className="grid gap-4 lg:grid-cols-3 mb-8">
              {([["By clinic", Building2, summary.byFacility], ["By collector", User, summary.byStaff], ["By method", CreditCard, summary.byMode]] as const).map(([t, Icon, list]) => (
                <Card key={t} className="p-5 border-border/50 bg-card/60 gap-2">
                  <h2 className="font-serif text-lg font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {t}</h2>
                  {list.map((x) => (
                    <div key={x.key} className="flex items-center justify-between gap-3 rounded-lg bg-background/40 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate" title={x.name}>{x.name} <span className="text-xs text-muted-foreground">({x.count}{x.cancelled ? `, ${x.cancelled} cancelled` : ""})</span></span>
                      <span className="shrink-0 text-right font-semibold tabular-nums">{inr(x.net)}{x.refunded ? <span className="block text-[11px] font-normal text-muted-foreground">−{inr(x.refunded)} refunded</span> : null}</span>
                    </div>
                  ))}
                </Card>
              ))}
            </div>
          )}

          {/* List */}
          <Card className="border-border/50 bg-card/60 overflow-hidden">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">No payments recorded for this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-left text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="px-4 py-3">Receipt</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Facility</th>
                      <th className="px-4 py-3">Recorded by</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">For</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className={cn("border-b border-border/30 last:border-0 hover:bg-background/30 transition-colors align-top", p.state === "cancelled" && "opacity-60")}>
                        <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs">{p.paymentCode}</span><span className="block text-xs text-muted-foreground">{formatDateTime(p.createdAt)}</span></td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/patients/${p.visit.patient.id}`} className="hover:text-primary hover:underline">{p.visit.patient.name}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {p.visit.facility.facilityName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.recordedBy?.name || <span className="italic">Clinic owner</span>}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[10px] flex items-center gap-1 w-fit"><CreditCard className="h-2.5 w-2.5" /> {p.mode}</Badge></td>
                        <td className="px-4 py-3 text-xs">{p.feeName ?? "—"}{p.overrideReason && <span className="block text-amber-700 dark:text-amber-400">Changed: {p.overrideReason}</span>}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums"><span className={cn(p.state === "cancelled" && "line-through")}>{inr(p.amount)}</span>{p.refundAmount ? <span className="block text-xs font-normal text-amber-700 dark:text-amber-400">−{inr(p.refundAmount)} refunded</span> : null}</td>
                        <td className="px-4 py-3"><Badge variant="outline" title={p.cancelReason ?? p.refundReason ?? undefined}>{PAYMENT_STATE_LABEL[p.state]}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
