"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, AlertOctagon, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, Bell, BookOpen, Bot, Building2, CalendarDays,
  CheckCircle2, ClipboardCheck, Clock, FileText, Globe2, HeartPulse, IndianRupee, Info, Languages, Leaf, ListChecks, Loader2, LogIn, Mail,
  Pill, RefreshCw, Settings, ShieldAlert, ShieldCheck, Siren, Sparkles, Stethoscope, TrendingUp, Users, UserPlus, XCircle,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { useAdminStore } from "@/lib/admin-store";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import type { Insight } from "@/lib/admin-insights";

// ---------------------------------------------------------------- types (mirror /api/admin/dashboard)
type NP = { now: number; prev: number };
type LN = { label: string; n: number };
interface ClinicRow { id: string; name: string; avatarColor: string; city: string | null; state: string | null; active: boolean; visits: number; visitsPrev: number; patients: number; revenue: number; score: number; health: "thriving" | "steady" | "at_risk" | "dormant"; plan: string; daysLeft: number | null; lastActivity: string | null }
interface Dash {
  days: number; generatedAt: string; health: number;
  kpis: {
    clinics: { total: number; active: number; new: number; healthy: number }; staff: number;
    patients: { total: number; new: number; prev: number }; visits: NP & { forecast: number }; revenue: NP; appointments: NP; finalised: NP; referrals: NP; prescriptions: number;
  };
  series: { weekly: boolean; labels: string[]; visits: number[]; patients: number[]; revenue: number[] };
  funnel: { key: string; label: string; count: number }[];
  clinics: { bands: Record<ClinicRow["health"], number>; plans: Record<string, number>; expiringSoon: number; rows: ClinicRow[] };
  patients: { gender: LN[]; ages: LN[]; ageUnknown: number; states: LN[]; returning: { returning: number; withVisits: number } };
  complaints: { label: string; now: number; prev: number }[];
  mizaj: LN[];
  heat: number[][];
  payments: { byMode: { label: string; amount: number }[]; byStatus: LN[]; refunds: { count: number; amount: number } };
  safety: { screenings: LN[]; referralsByUrgency: LN[]; amaDeclines: number; acknowledgements: number; cds: LN[]; reports: { total: number; abnormal: number; unreviewed: number } };
  catalogue: { unani: number; allopathic: number; avgCompleteness: number; safety: { verified: number; unverified: number; total: number }; amraz: { approved: number; draft: number }; usoolDrafts: number };
  translations: { code: string; language: string; coverage: number }[]; translationKeys: number;
  system: { ai: { provider: string; on: boolean; hasKey: boolean }[]; aiOn: boolean; email: { configured: boolean; active: boolean; provider: string | null }; notifications: { sent: number; failed: number }; logins: { clinic: number; staff: number; patient: number; failed: number } };
  insights: Insight[];
}
interface LoginStats { total: number; successful: number; failed: number; lastLogin: string | null }
interface ActivityRow { id: string; action: string; description: string | null; createdAt: string }

const PERIODS = [{ d: 7, l: "7 days" }, { d: 30, l: "30 days" }, { d: 90, l: "90 days" }, { d: 365, l: "12 months" }] as const;
const PERIOD_KEY = "hekims-admin-dash-days";
const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const compact = (n: number) => (n >= 100000 ? `${(n / 100000).toFixed(1)}L` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
const pct = (now: number, prev: number) => (prev > 0 ? Math.round(((now - prev) / prev) * 100) : null);
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};
const HEALTH: Record<ClinicRow["health"], { label: string; bar: string; text: string }> = {
  thriving: { label: "Thriving", bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  steady: { label: "Steady", bar: "bg-sky-500", text: "text-sky-700 dark:text-sky-400" },
  at_risk: { label: "At risk", bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  dormant: { label: "Dormant", bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
};
const SEV: Record<Insight["severity"], { icon: typeof Info; box: string; icn: string; label: string }> = {
  critical: { icon: AlertOctagon, box: "border-destructive/40 bg-destructive/5", icn: "text-destructive", label: "Critical" },
  warning: { icon: AlertTriangle, box: "border-amber-500/40 bg-amber-500/5", icn: "text-amber-600", label: "Attention" },
  positive: { icon: TrendingUp, box: "border-emerald-500/40 bg-emerald-500/5", icn: "text-emerald-600", label: "Good news" },
  info: { icon: Info, box: "border-border/60 bg-background/40", icn: "text-primary", label: "Note" },
};

// ---------------------------------------------------------------- small building blocks
function Panel({ title, icon: Icon, action, className, children }: { title: string; icon: typeof Users; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("gap-4 border-border/60 bg-card/60 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}
function MoreLink({ href, children = "Open" }: { href: string; children?: ReactNode }) {
  return <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">{children} <ArrowRight className="h-3.5 w-3.5" /></Link>;
}
function Delta({ now, prev }: { now: number; prev: number }) {
  const p = pct(now, prev);
  if (p === null) return <span className="text-xs text-muted-foreground">{now > 0 ? "new" : "—"}</span>;
  const up = p >= 0;
  return <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>{up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(p)}%</span>;
}
function Spark({ data, className }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data), w = 100, h = 28;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full", className)} aria-hidden>
      <polyline points={`0,${h} ${pts} ${w},${h}`} className="fill-primary/10 stroke-none" />
      <polyline points={pts} className="fill-none stroke-primary" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
function Kpi({ icon: Icon, label, value, sub, delta, spark, href, tone = "primary" }: { icon: typeof Users; label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode; spark?: number[]; href?: string; tone?: "primary" | "rose" | "amber" | "emerald" | "sky" | "violet" }) {
  const toneCls = { primary: "bg-primary/12 text-primary", rose: "bg-rose-500/12 text-rose-600", amber: "bg-amber-500/12 text-amber-600", emerald: "bg-emerald-500/12 text-emerald-600", sky: "bg-sky-500/12 text-sky-600", violet: "bg-violet-500/12 text-violet-600" }[tone];
  const body = (
    <Card className="h-full gap-2 border-border/60 bg-card/60 p-4 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", toneCls)}><Icon className="h-4 w-4" /></span>
        {delta}
      </div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="font-serif text-2xl font-bold leading-none tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {spark && <Spark data={spark} />}
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
function Ring({ value, size = 112, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, value)) / 100);
  const color = value >= 70 ? "stroke-emerald-500" : value >= 45 ? "stroke-amber-500" : "stroke-rose-500";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className="fill-none stroke-muted" strokeWidth={10} />
        <circle cx={size / 2} cy={size / 2} r={r} className={cn("fill-none transition-all", color)} strokeWidth={10} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-3xl font-bold tabular-nums">{value}</span>
        {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
function Bars({ items, format = (n: number) => String(n), tone = "bg-primary", max }: { items: { label: string; n: number; hint?: ReactNode }[]; format?: (n: number) => string; tone?: string; max?: number }) {
  const m = max ?? Math.max(1, ...items.map((x) => x.n));
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing recorded in this period.</p>;
  return (
    <ul className="space-y-2">
      {items.map((x) => (
        <li key={x.label} className="text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-2"><span className="min-w-0 truncate">{x.label}</span><span className="shrink-0 font-medium tabular-nums">{format(x.n)}{x.hint}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", tone)} style={{ width: `${(x.n / m) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return <div className="rounded-lg border border-border/50 bg-background/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={cn("mt-0.5 font-serif text-xl font-bold tabular-nums", tone)}>{value}</p></div>;
}
const title = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// ---------------------------------------------------------------- page
export function CommandCentre() {
  const admin = useAdminStore((s) => s.admin);
  const [days, setDays] = useState<number>(() => { try { return Number(localStorage.getItem(PERIOD_KEY)) || 30; } catch { return 30; } });
  const [data, setData] = useState<Dash | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState<"visits" | "patients" | "revenue">("visits");
  const [allInsights, setAllInsights] = useState(false);
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);

  const fetchDash = useCallback((d: number) =>
    adminApi.get<Dash>(`/api/admin/dashboard?days=${d}`).then((r) => { setData(r); setFailed(false); }).catch(() => setFailed(true)).finally(() => setLoading(false)), []);
  useEffect(() => { fetchDash(days); }, [days, fetchDash]);
  const load = (d: number) => { setLoading(true); fetchDash(d); };
  useEffect(() => {
    adminApi.get<{ stats: LoginStats }>("/api/admin/history/logins").then((r) => setStats(r.stats)).catch(() => {});
    adminApi.get<{ activity: ActivityRow[] }>("/api/admin/history/activity").then((r) => setActivity(r.activity.slice(0, 6))).catch(() => {});
  }, []);
  const pick = (d: number) => { if (d !== days) setLoading(true); setDays(d); try { localStorage.setItem(PERIOD_KEY, String(d)); } catch { /* convenience only */ } };

  const chart = useMemo(() => data ? data.series.labels.map((l, i) => ({
    label: new Date(l).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    value: data.series[metric][i],
  })) : [], [data, metric]);

  if (!admin) return null;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const periodLabel = PERIODS.find((p) => p.d === days)?.l ?? `${days} days`;

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:px-12">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">{greet}, {admin.name}</h1>
          <p className="mt-1 text-muted-foreground">Everything happening across The Hekim's Connect — the last {periodLabel} against the {periodLabel} before.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/60 bg-card/60 p-0.5" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button key={p.d} type="button" onClick={() => pick(p.d)} aria-pressed={days === p.d}
                className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", days === p.d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{p.l}</button>
            ))}
          </div>
          <button type="button" onClick={() => load(days)} disabled={loading} aria-label="Refresh"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> {data ? new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Refresh"}
          </button>
        </div>
      </div>

      {failed && !data && <Card className="p-6 text-sm text-muted-foreground">The dashboard couldn't load. <button type="button" onClick={() => load(days)} className="font-medium text-primary hover:underline">Try again</button></Card>}
      {!data && !failed && <div className="flex items-center gap-2 py-24 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Gathering the platform's figures…</div>}

      {data && (
        <div className={cn("space-y-5 transition-opacity", loading && "opacity-60")}>
          {/* Health + insights */}
          <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
            <Card className="items-center gap-3 border-border/60 bg-card/60 p-5 text-center">
              <p className="flex items-center gap-2 font-serif text-lg font-semibold"><HeartPulse className="h-4 w-4 text-primary" /> Platform health</p>
              <Ring value={data.health} size={140} label="out of 100" />
              <div className="grid w-full grid-cols-2 gap-2 text-start text-xs">
                {(Object.keys(HEALTH) as ClinicRow["health"][]).map((k) => (
                  <div key={k} className="flex items-center gap-2 rounded-md border border-border/50 bg-background/40 px-2 py-1.5">
                    <span className={cn("h-2.5 w-2.5 rounded-full", HEALTH[k].bar)} /><span className="flex-1">{HEALTH[k].label} clinics</span><span className="font-semibold tabular-nums">{data.clinics.bands[k]}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Clinic engagement, journeys completed, catalogue quality and open critical issues.</p>
            </Card>

            <Card className="gap-3 border-primary/25 bg-gradient-to-br from-primary/[0.06] via-card/60 to-card/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Hakeem Insight — what needs you today</h2>
                <span className="text-xs text-muted-foreground">{data.insights.length} findings · computed on the server, no AI cost</span>
              </div>
              <ul className="grid gap-2 lg:grid-cols-2">
                {(allInsights ? data.insights : data.insights.slice(0, 6)).map((i) => {
                  const s = SEV[i.severity];
                  return (
                    <li key={i.id} className={cn("flex items-start gap-3 rounded-xl border px-3 py-2.5", s.box)}>
                      <s.icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.icn)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">{i.title}</p>
                        <p className="text-[13px] leading-snug text-muted-foreground">{i.detail}</p>
                      </div>
                      {i.href && <Link href={i.href} className="shrink-0 self-center rounded-md border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-medium hover:border-primary/50 hover:text-primary">{i.action ?? "Open"}</Link>}
                    </li>
                  );
                })}
              </ul>
              {data.insights.length > 6 && (
                <button type="button" onClick={() => setAllInsights((v) => !v)} className="self-start text-sm font-medium text-primary hover:underline">
                  {allInsights ? "Show fewer" : `Show all ${data.insights.length} findings`}
                </button>
              )}
            </Card>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
            <Kpi icon={Stethoscope} label="Visits" value={data.kpis.visits.now} delta={<Delta {...data.kpis.visits} />} sub={`~${data.kpis.visits.forecast} expected next ${periodLabel}`} spark={data.series.visits} href="/admin/facilities" />
            <Kpi icon={UserPlus} label="New patients" value={data.kpis.patients.new} delta={<Delta now={data.kpis.patients.new} prev={data.kpis.patients.prev} />} sub={`${data.kpis.patients.total} in total`} spark={data.series.patients} href="/admin/patients" tone="sky" />
            <Kpi icon={IndianRupee} label="Collections" value={inr(data.kpis.revenue.now)} delta={<Delta {...data.kpis.revenue} />} sub={`${inr(data.kpis.revenue.prev)} before`} spark={data.series.revenue} href="/admin/payments" tone="emerald" />
            <Kpi icon={Building2} label="Clinics" value={data.kpis.clinics.total} sub={`${data.kpis.clinics.active} active · ${data.kpis.clinics.healthy} engaged`} href="/admin/facilities" tone="violet" />
            <Kpi icon={ClipboardCheck} label="Dossiers finalised" value={data.kpis.finalised.now} delta={<Delta {...data.kpis.finalised} />} sub={`${data.kpis.prescriptions} prescriptions`} />
            <Kpi icon={CalendarDays} label="Appointments" value={data.kpis.appointments.now} delta={<Delta {...data.kpis.appointments} />} tone="sky" />
            <Kpi icon={Siren} label="Emergency referrals" value={data.kpis.referrals.now} delta={<Delta {...data.kpis.referrals} />} sub={`${data.safety.amaDeclines} declined by family`} href="/admin/screening" tone="rose" />
            <Kpi icon={Users} label="Active staff" value={data.kpis.staff} sub="across all clinics" href="/admin/staff" tone="amber" />
          </div>

          {/* Trend + journey */}
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Trend" icon={Activity}
              action={
                <div className="inline-flex rounded-lg border border-border/60 bg-background/40 p-0.5">
                  {([["visits", "Visits"], ["patients", "New patients"], ["revenue", "Collections"]] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setMetric(k)} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", metric === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                  ))}
                </div>
              }>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
                    <defs><linearGradient id="dashFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--color-primary, #10b981)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--color-primary, #10b981)" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => (metric === "revenue" ? compact(v) : String(v))} />
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v: number) => [metric === "revenue" ? inr(v) : v, metric === "visits" ? "Visits" : metric === "patients" ? "New patients" : "Collections"]} />
                    <Area type="monotone" dataKey="value" stroke="var(--color-primary, #10b981)" strokeWidth={2} fill="url(#dashFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">{data.series.weekly ? "Weekly totals." : "Daily totals."} Indian Standard Time.</p>
            </Panel>

            <Panel title="Clinical journey" icon={ListChecks} action={<span className="text-xs text-muted-foreground">visits in the period</span>}>
              <ul className="space-y-2">
                {data.funnel.map((f, i) => {
                  const base = data.funnel[0].count || 1;
                  const prev = i ? data.funnel[i - 1].count : f.count;
                  const drop = i && prev ? Math.round(((prev - f.count) / prev) * 100) : 0;
                  return (
                    <li key={f.key}>
                      <div className="mb-1 flex items-baseline justify-between text-sm"><span>{i + 1}. {f.label}</span><span className="tabular-nums"><b>{f.count}</b> <span className="text-xs text-muted-foreground">({Math.round((f.count / base) * 100)}%)</span>{drop > 0 && <span className="ms-1.5 text-xs text-rose-600">−{drop}%</span>}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500" style={{ width: `${(f.count / base) * 100}%` }} /></div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          {/* Clinics */}
          <Panel title="Clinics" icon={Building2} action={<MoreLink href="/admin/facilities">All clinics</MoreLink>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Stat label="Premium plans" value={data.clinics.plans.premium ?? 0} />
              <Stat label="On trial" value={data.clinics.plans.trial ?? 0} />
              <Stat label="Expired plans" value={data.clinics.plans.expired ?? 0} tone={(data.clinics.plans.expired ?? 0) > 0 ? "text-rose-600" : undefined} />
              <Stat label="Ending in 14 days" value={data.clinics.expiringSoon} tone={data.clinics.expiringSoon > 0 ? "text-amber-600" : undefined} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b border-border/60 text-start text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 text-start font-semibold">Clinic</th><th className="text-end font-semibold">Visits</th><th className="text-end font-semibold">Change</th><th className="text-end font-semibold">Patients</th><th className="text-end font-semibold">Collections</th><th className="text-start ps-4 font-semibold">Engagement</th><th className="text-start font-semibold">Plan</th><th className="text-end font-semibold">Last active</th>
                </tr></thead>
                <tbody>
                  {data.clinics.rows.slice(0, 10).map((c) => (
                    <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30">
                      <td className="py-2.5">
                        <Link href={`/admin/facilities/${c.id}`} className="flex items-center gap-2.5">
                          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white", avatarGradient(c.avatarColor))}>{initials(c.name)}</span>
                          <span className="min-w-0"><span className="block truncate font-medium hover:text-primary">{c.name}</span><span className="block truncate text-xs text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</span></span>
                        </Link>
                      </td>
                      <td className="text-end font-semibold tabular-nums">{c.visits}</td>
                      <td className="text-end"><Delta now={c.visits} prev={c.visitsPrev} /></td>
                      <td className="text-end tabular-nums">{c.patients}</td>
                      <td className="text-end tabular-nums">{inr(c.revenue)}</td>
                      <td className="ps-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", HEALTH[c.health].bar)} style={{ width: `${c.score}%` }} /></div><span className={cn("text-xs font-medium", HEALTH[c.health].text)}>{HEALTH[c.health].label}</span></div></td>
                      <td className="text-xs capitalize">{c.plan}{c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 14 && <span className="ms-1 text-amber-600">· {c.daysLeft}d left</span>}</td>
                      <td className="text-end text-xs text-muted-foreground">{ago(c.lastActivity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Patients · complaints · temperament */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Patients" icon={Users} action={<MoreLink href="/admin/patients" />}>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Registered" value={data.kpis.patients.total} />
                <Stat label="Returning" value={`${data.patients.returning.withVisits ? Math.round((data.patients.returning.returning / data.patients.returning.withVisits) * 100) : 0}%`} />
              </div>
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Age</p><Bars items={data.patients.ages} tone="bg-sky-500" /></div>
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gender</p><Bars items={data.patients.gender} tone="bg-violet-500" /></div>
              {data.patients.states.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where they live</p><Bars items={data.patients.states} tone="bg-emerald-500" /></div>}
            </Panel>
            <Panel title="Top complaints" icon={Stethoscope} action={<span className="text-xs text-muted-foreground">{periodLabel}</span>}>
              <Bars items={data.complaints.map((c) => ({ label: c.label, n: c.now, hint: c.prev || c.now ? <span className={cn("ms-1.5 text-xs", c.now >= c.prev ? "text-emerald-600" : "text-rose-600")}>{c.prev ? `${c.now >= c.prev ? "+" : ""}${c.now - c.prev}` : "new"}</span> : null }))} />
            </Panel>
            <Panel title="Su-e-Mizaj seen" icon={Leaf} action={<span className="text-xs text-muted-foreground">from Tashkhees</span>}>
              <Bars items={data.mizaj} tone="bg-amber-500" />
              <div className="mt-auto">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Busiest hours (IST)</p>
                <Heatmap heat={data.heat} />
              </div>
            </Panel>
          </div>

          {/* Payments · safety */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Payments" icon={IndianRupee} action={<MoreLink href="/admin/payments" />}>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Collected" value={inr(data.kpis.revenue.now)} tone="text-emerald-600" />
                <Stat label="Avg per visit" value={inr(data.kpis.visits.now ? data.kpis.revenue.now / data.kpis.visits.now : 0)} />
                <Stat label="Refunded" value={inr(data.payments.refunds.amount)} tone={data.payments.refunds.amount ? "text-rose-600" : undefined} />
              </div>
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By payment mode</p><Bars items={data.payments.byMode.map((m) => ({ label: m.label, n: m.amount }))} format={inr} tone="bg-emerald-500" /></div>
            </Panel>
            <Panel title="Clinical safety" icon={ShieldAlert} action={<MoreLink href="/admin/screening">Screening</MoreLink>}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Referrals" value={data.kpis.referrals.now} tone={data.kpis.referrals.now ? "text-rose-600" : undefined} />
                <Stat label="Declined by family" value={data.safety.amaDeclines} />
                <Stat label="Safety overrides" value={data.safety.acknowledgements} />
                <Stat label="Abnormal reports" value={data.safety.reports.abnormal} tone={data.safety.reports.abnormal ? "text-amber-600" : undefined} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warning-sign screens</p><Bars items={data.safety.screenings.map((x) => ({ label: title(x.label), n: x.n }))} tone="bg-rose-500" /></div>
                <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medicine suggestions used</p><Bars items={data.safety.cds.map((x) => ({ label: title(x.label), n: x.n }))} tone="bg-primary" /></div>
              </div>
            </Panel>
          </div>

          {/* Catalogue · content · system */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Medicine & disease catalogue" icon={Pill} action={<MoreLink href="/admin/meta/supplements">Review</MoreLink>}>
              <div className="flex items-center gap-4">
                <Ring value={data.catalogue.avgCompleteness} size={92} label="complete" />
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <Stat label="Unani & supplements" value={data.catalogue.unani} />
                  <Stat label="Allopathic" value={data.catalogue.allopathic} />
                </div>
              </div>
              <Bars max={1} format={(n) => `${Math.round(n * 100)}%`} items={[
                { label: `Safety notes verified (${data.catalogue.safety.verified} of ${data.catalogue.safety.total})`, n: data.catalogue.safety.total ? data.catalogue.safety.verified / data.catalogue.safety.total : 0 },
                { label: `Disease entries approved (${data.catalogue.amraz.approved} of ${data.catalogue.amraz.approved + data.catalogue.amraz.draft})`, n: data.catalogue.amraz.approved + data.catalogue.amraz.draft ? data.catalogue.amraz.approved / (data.catalogue.amraz.approved + data.catalogue.amraz.draft) : 0 },
              ]} tone="bg-amber-500" />
              <p className="text-xs text-muted-foreground">{data.catalogue.usoolDrafts} treatment principles in draft · <Link href="/admin/meta/tashkhees?tab=amraz" className="text-primary hover:underline">Review diseases</Link></p>
            </Panel>
            <Panel title="Languages" icon={Languages} action={<MoreLink href="/admin/languages" />}>
              <Bars items={data.translations.map((t) => ({ label: t.language, n: t.coverage }))} format={(n) => `${n}%`} max={100} tone="bg-sky-500" />
              <p className="text-xs text-muted-foreground">{data.translationKeys.toLocaleString("en-IN")} texts in the app.</p>
            </Panel>
            <Panel title="System" icon={Settings} action={<MoreLink href="/admin/settings">Settings</MoreLink>}>
              <ul className="space-y-2 text-sm">
                {data.system.ai.length === 0 && <li className="flex items-center gap-2"><Bot className="h-4 w-4 text-muted-foreground" /> AI services not configured</li>}
                {data.system.ai.map((a) => (
                  <li key={a.provider} className="flex items-center gap-2"><Bot className="h-4 w-4 text-muted-foreground" /><span className="flex-1 capitalize">{a.provider}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", a.on ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>{a.on ? "On" : a.hasKey ? "Off (key saved)" : "Off"}</span></li>
                ))}
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><span className="flex-1">Email {data.system.email.provider ? `(${data.system.email.provider.toUpperCase()})` : ""}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", data.system.email.active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700")}>{data.system.email.configured ? (data.system.email.active ? "Active" : "Off") : "Not set"}</span></li>
                <li className="flex items-center gap-2"><Bell className="h-4 w-4 text-muted-foreground" /><span className="flex-1">Emails sent / failed</span><span className="tabular-nums"><b className="text-emerald-600">{data.system.notifications.sent}</b> / <b className={data.system.notifications.failed ? "text-rose-600" : ""}>{data.system.notifications.failed}</b></span></li>
                <li className="flex items-center gap-2"><LogIn className="h-4 w-4 text-muted-foreground" /><span className="flex-1">Sign-ins: clinics · staff · patients</span><span className="tabular-nums">{data.system.logins.clinic} · {data.system.logins.staff} · {data.system.logins.patient}</span></li>
                <li className="flex items-center gap-2"><XCircle className="h-4 w-4 text-muted-foreground" /><span className="flex-1">Failed sign-ins</span><b className={cn("tabular-nums", data.system.logins.failed ? "text-rose-600" : "")}>{data.system.logins.failed}</b></li>
              </ul>
            </Panel>
          </div>

          {/* Quick actions + your account */}
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Quick actions" icon={Sparkles}>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["/admin/facilities", Building2, "Clinics"], ["/admin/patients", Users, "Patients"], ["/admin/payments", IndianRupee, "Payments"], ["/admin/screening", ShieldCheck, "Screening"],
                  ["/admin/meta", BookOpen, "Metadata"], ["/admin/guidance", FileText, "Guidance"], ["/admin/languages", Globe2, "Languages"], ["/admin/notifications", Bell, "Notifications"],
                ] as const).map(([href, Icon, l]) => (
                  <Link key={href} href={href} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/40 px-3 py-2.5 text-sm font-medium hover:border-primary/50 hover:text-primary"><Icon className="h-4 w-4" />{l}</Link>
                ))}
              </div>
            </Panel>
            <Panel title="Your sign-ins" icon={ShieldCheck} action={<MoreLink href="/admin/history/logins">History</MoreLink>}>
              {stats ? (
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Total" value={stats.total} />
                  <Stat label="Successful" value={stats.successful} tone="text-primary" />
                  <Stat label="Failed" value={stats.failed} tone={stats.failed ? "text-destructive" : undefined} />
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3"><p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Last sign-in</p><p className="mt-1 text-sm font-semibold">{stats.lastLogin ? new Date(stats.lastLogin).toLocaleString() : "—"}</p></div>
                </div>
              ) : <p className="text-sm text-muted-foreground">Loading…</p>}
            </Panel>
            <Panel title="Your recent activity" icon={ListChecks} action={<MoreLink href="/admin/history/activity">All</MoreLink>}>
              {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
                <ul className="space-y-2.5">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 text-sm">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"><BadgeCheck className="h-3.5 w-3.5" /></span>
                      <span className="min-w-0 flex-1 truncate">{a.description || title(a.action)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5" /> Figures are live from the database each time this page loads. Insights are rules and statistics on the server — no AI service is called.</p>
        </div>
      )}
    </div>
  );
}

function Heatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat());
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM – 9 PM
  return (
    <div className="space-y-0.5">
      {heat.map((row, d) => (
        <div key={d} className="flex items-center gap-0.5">
          <span className="w-8 shrink-0 text-[10px] text-muted-foreground">{DAYS[d]}</span>
          {hours.map((h) => (
            <span key={h} title={`${DAYS[d]} ${h}:00 — ${row[h]} visits`} className="h-3.5 flex-1 rounded-[3px] bg-primary" style={{ opacity: row[h] ? 0.15 + 0.85 * (row[h] / max) : 0.06 }} />
          ))}
        </div>
      ))}
      <div className="flex gap-0.5 ps-[34px] text-[9px] text-muted-foreground"><span className="flex-1">7am</span><span className="flex-1 text-center">2pm</span><span className="flex-1 text-end">9pm</span></div>
    </div>
  );
}
