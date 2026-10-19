"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { canOpenPage } from "@/lib/staff-permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, ArrowUpRight, CalendarCheck, ClipboardList, History, Info, Loader2, RefreshCw, Search, ShieldAlert,
  Stethoscope, UserPlus, UserRoundCheck, Users, Wallet,
} from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point { key: string; newPatients: number; visits: number }
interface Money { amount: number; count: number }
interface Data {
  generatedAt: string;
  patients: { newToday: number; newYesterday: number; new7: number; new30: number; new12m: number; returningToday: number; totalEver: number };
  visits: { today: number; yesterday: number; waitingVitals: number; inAssessment: number; completed: number; referred: number };
  money: { today: Money; last7: Money; last30: Money } | null;
  trend: { d7: Point[]; d30: Point[]; m12: Point[] };
  mine: { visitsToday: number; visits7: number; collectedToday: Money; actionsToday: number } | null;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const vsYesterday = (t: number, y: number) => (y === t ? "same as yesterday" : `${t > y ? "+" : "−"}${Math.abs(t - y)} vs yesterday (${y})`);

/** Reception workspace at the top of the dashboard: today's flow, registrations over time, quick actions. */
export function ReceptionDashboard() {
  const router = useRouter();
  const perms = useAppStore((s) => (s.staff && s.permissions !== null ? s.permissions : null));
  const can = (path: string) => canOpenPage(perms, path);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"d7" | "d30" | "m12">("d7");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.get<Data>(`/api/facility/reception?tz=${-new Date().getTimezoneOffset()}`)); setError(""); }
    catch (e: any) { setError(e.message || "Network error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const go = (path: string) => router.push(path);
  const actions = [
    { label: "Register new patient", icon: UserPlus, path: "/facility/patients/register", primary: true },
    { label: "Find existing patient", icon: Search, path: "/facility/patients" },
    { label: "Reception desk (7 days)", icon: CalendarCheck, path: "/facility/reception" },
    { label: "In progress", icon: Stethoscope, path: "/facility/patients?filter=progress" },
    { label: "My activity", icon: History, path: "/facility/profile/activity" },
  ].filter((a) => can(a.path.split("?")[0]));

  const fmtKey = (k: string) => period === "m12"
    ? new Date(`${k}-01T00:00:00`).toLocaleDateString(undefined, { month: "short" })
    : new Date(`${k}T00:00:00`).toLocaleDateString(undefined, period === "d7" ? { weekday: "short", day: "numeric" } : { day: "numeric", month: "short" });

  return (
    <section className="space-y-4" aria-label="Reception">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">Reception</h2>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{data && ` · updated ${new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}</p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</Button>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2" data-tour="dashboard.actions">
        {actions.map((a) => (
          <Button key={a.label} variant={a.primary ? "default" : "outline"} onClick={() => go(a.path)} className={cn(!a.primary && "bg-card/60")}>
            <a.icon className="h-4 w-4" /> {a.label}
          </Button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Reception figures couldn&apos;t be loaded — {error}. <button className="underline" onClick={load}>Try again</button></p>}

      {!data && loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading today&apos;s figures…</div>
      ) : data && (
        <>
          {/* Today */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-tour="dashboard.today">
            <Stat label="New patients" range="Today" value={data.patients.newToday} sub={vsYesterday(data.patients.newToday, data.patients.newYesterday)} icon={UserPlus} tone="primary" onClick={() => go("/facility/patients?filter=today")} />
            <Stat label="Returning patients" range="Today" value={data.patients.returningToday} sub="seen here before" icon={UserRoundCheck} tone="accent" onClick={() => go("/facility/patients?filter=today")} />
            <Stat label="Visits" range="Today" value={data.visits.today} sub={vsYesterday(data.visits.today, data.visits.yesterday)} icon={ClipboardList} tone="primary" onClick={() => go("/facility/patients?filter=today")} />
            {data.money ? (
              <Stat label="Collected" range="Today" value={inr(data.money.today.amount)} sub={`${data.money.today.count} payment${data.money.today.count === 1 ? "" : "s"} · 7 days ${inr(data.money.last7.amount)}`} icon={Wallet} tone="emerald" />
            ) : (
              <Stat label="Waiting for vitals" range="Today" value={data.visits.waitingVitals} sub="registered, vitals not yet taken" icon={Activity} tone="amber" onClick={() => go("/facility/patients?filter=progress")} />
            )}
          </div>

          {/* Patient flow today */}
          <Card className="gap-3 border-border/50 bg-card/60 p-4">
            <p className="text-sm font-semibold">Today&apos;s patient flow <span className="font-normal text-muted-foreground">· {data.visits.today} visit{data.visits.today === 1 ? "" : "s"}</span></p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["Waiting for vitals", data.visits.waitingVitals, "bg-amber-500", "progress"],
                ["In assessment", data.visits.inAssessment, "bg-sky-500", "progress"],
                ["Completed", data.visits.completed, "bg-emerald-500", "done"],
                ["Referred out", data.visits.referred, "bg-red-500", "referred"],
              ] as const).map(([l, n, dot, f]) => (
                <button key={l} type="button" onClick={() => go(`/facility/patients?filter=${f}`)} className="rounded-lg border border-border bg-background/60 px-3 py-2.5 text-start transition-colors hover:border-primary/40">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", dot)} />{l}</p>
                  <p className="mt-0.5 font-serif text-2xl font-bold">{n}</p>
                </button>
              ))}
            </div>
            {data.visits.today > 0 && (
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                {[[data.visits.waitingVitals, "bg-amber-500"], [data.visits.inAssessment, "bg-sky-500"], [data.visits.completed, "bg-emerald-500"], [data.visits.referred, "bg-red-500"]].map(([n, c], i) => (
                  <span key={i} className={String(c)} style={{ width: `${(Number(n) / data.visits.today) * 100}%` }} />
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
            {/* Trend */}
            <Card className="gap-3 border-border/50 bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">New patients &amp; visits</p>
                <div className="inline-flex rounded-lg border border-border bg-background/60 p-0.5 text-xs">
                  {([["d7", "7 days"], ["d30", "30 days"], ["m12", "12 months"]] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setPeriod(k)} className={cn("rounded-md px-2.5 py-1 transition-colors", period === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data.trend[period]} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="key" tickFormatter={fmtKey} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip labelFormatter={(k) => fmtKey(String(k))} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="newPatients" name="New patients" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line dataKey="visits" name="Visits" type="monotone" stroke="var(--color-accent)" strokeWidth={2} dot={period === "d7"} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            <div className="space-y-4">
              {/* Registrations over time */}
              <Card className="gap-2 border-border/50 bg-card/60 p-4">
                <p className="text-sm font-semibold">New patients</p>
                {([["Yesterday", data.patients.newYesterday], ["Last 7 days", data.patients.new7], ["Last 30 days", data.patients.new30], ["Last 12 months", data.patients.new12m], ["All time", data.patients.totalEver]] as const).map(([l, n]) => (
                  <div key={l} className="flex items-center justify-between border-b border-border/60 py-1 text-sm last:border-0"><span className="text-muted-foreground">{l}</span><span className="font-semibold tabular-nums">{n}</span></div>
                ))}
                {data.money && (
                  <div className="mt-1 flex items-center justify-between rounded-md bg-emerald-500/10 px-2 py-1.5 text-sm"><span className="text-muted-foreground">Collected, 30 days</span><span className="font-semibold">{inr(data.money.last30.amount)}</span></div>
                )}
              </Card>

              {/* My workload */}
              {data.mine && (
                <Card className="gap-2 border-primary/25 bg-primary/5 p-4">
                  <p className="text-sm font-semibold">My work</p>
                  {([["Visits I registered today", data.mine.visitsToday], ["Visits I registered, 7 days", data.mine.visits7], ["My recorded actions today", data.mine.actionsToday]] as const).map(([l, n]) => (
                    <div key={l} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{l}</span><span className="font-semibold tabular-nums">{n}</span></div>
                  ))}
                  {data.mine.collectedToday.count > 0 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">I collected today</span><span className="font-semibold">{inr(data.mine.collectedToday.amount)}</span></div>}
                </Card>
              )}
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>A <b className="font-medium text-foreground">new patient</b> is someone whose first visit to this clinic was in that period — counted once. A <b className="font-medium text-foreground">returning patient</b> was seen here before. <b className="font-medium text-foreground">Visits</b> count every visit, so one person can have several. Days follow this device&apos;s time zone.</span>
          </p>
          {data.visits.referred > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400"><ShieldAlert className="h-3.5 w-3.5" /> {data.visits.referred} patient{data.visits.referred === 1 ? " was" : "s were"} referred out today.</p>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, range, value, sub, icon: Icon, tone, onClick }: { label: string; range: string; value: number | string; sub: string; icon: typeof Users; tone: "primary" | "accent" | "amber" | "emerald"; onClick?: () => void }) {
  const tones = { primary: "bg-primary/15 text-primary", accent: "bg-accent/15 text-accent", amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400", emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  const Comp = onClick ? "button" : "div";
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick} className={cn("group rounded-xl border border-border/60 bg-card/60 p-4 text-start transition-colors", onClick && "hover:border-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{label} <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">{range}</span></p>
          {/* The serif face has no ₹ glyph — amounts use the regular face. */}
          <p className={cn("mt-1 text-3xl font-bold", typeof value === "string" && value.startsWith("₹") ? "font-sans tabular-nums" : "font-serif")}>{value}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}><Icon className="h-5 w-5" /></span>
      </div>
      {onClick && <p className="mt-2 flex items-center gap-1 text-[11px] text-primary opacity-0 transition-opacity group-hover:opacity-100">Open list <ArrowUpRight className="h-3 w-3" /></p>}
    </Comp>
  );
}
