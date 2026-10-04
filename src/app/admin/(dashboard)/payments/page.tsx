"use client";

import { useEffect, useState } from "react";
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
import { formatDateTime } from "@/lib/utils";

interface PaymentRow {
  id: string; paymentCode: string; amount: number; mode: string; status: string; createdAt: string;
  visit: { id: string; visitCode: string; facility: { id: string; facilityName: string }; patient: { id: string; name: string } };
  recordedBy: { id: string; name: string; staffCode: string } | null;
}

interface Summary {
  total: number; count: number;
  byMode: Record<string, { total: number; count: number }>;
  byStaff: { staffId: string | null; staffName: string; total: number; count: number }[];
}

interface FacilityOption { id: string; facilityName: string }

const MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Other"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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

  useEffect(() => {
    adminApi.get<{ facilities: FacilityOption[] }>("/api/admin/facilities?pageSize=100")
      .then((res) => setFacilities(res.facilities || []))
      .catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ from, to });
    if (facilityId !== "all") params.set("facilityId", facilityId);
    if (mode !== "all") params.set("mode", mode);
    adminApi.get<{ payments: PaymentRow[]; summary: Summary }>(`/api/admin/payments?${params}`)
      .then((res) => { setPayments(res.payments || []); setSummary(res.summary); })
      .catch(() => toast.error("Could not load payments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [from, to, facilityId, mode]);

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
            {MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 border-primary/30 bg-primary/5">
              <p className="text-sm text-muted-foreground">Total collected</p>
              <p className="font-serif text-2xl font-bold mt-1">₹{summary?.total.toFixed(2) ?? "0.00"}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary?.count ?? 0} payment{summary?.count === 1 ? "" : "s"}</p>
            </Card>
            {MODES.slice(0, 3).map((m) => (
              <Card key={m} className="p-4 border-border/50 bg-card/60">
                <p className="text-sm text-muted-foreground">{m}</p>
                <p className="font-serif text-2xl font-bold mt-1">₹{(summary?.byMode[m]?.total ?? 0).toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary?.byMode[m]?.count ?? 0} payment{summary?.byMode[m]?.count === 1 ? "" : "s"}</p>
              </Card>
            ))}
          </div>

          {/* By cashier/staff */}
          {summary && summary.byStaff.length > 0 && (
            <Card className="p-5 border-border/50 bg-card/60 mb-8">
              <h2 className="font-serif text-lg font-semibold mb-3 flex items-center gap-2"><User className="h-4 w-4 text-primary" /> By cashier / staff</h2>
              <div className="space-y-1.5">
                {summary.byStaff.map((s) => (
                  <div key={s.staffId ?? "unattributed"} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg bg-background/40">
                    <span className={s.staffId ? "" : "text-muted-foreground italic"}>{s.staffName}</span>
                    <span className="font-semibold">₹{s.total.toFixed(2)} <span className="text-xs text-muted-foreground font-normal">({s.count})</span></span>
                  </div>
                ))}
              </div>
            </Card>
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
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Facility</th>
                      <th className="px-4 py-3">Recorded by</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-background/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/patients/${p.visit.patient.id}`} className="hover:text-primary hover:underline">{p.visit.patient.name}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {p.visit.facility.facilityName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.recordedBy?.name || <span className="italic">Unattributed</span>}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-[10px] flex items-center gap-1 w-fit"><CreditCard className="h-2.5 w-2.5" /> {p.mode}</Badge></td>
                        <td className="px-4 py-3 text-right font-semibold">₹{p.amount.toFixed(2)}</td>
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
