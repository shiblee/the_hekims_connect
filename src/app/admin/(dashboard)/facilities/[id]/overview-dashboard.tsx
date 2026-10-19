"use client";

import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, BedDouble, Building2, CalendarDays, CheckCircle2, Circle, Clock, FileText, Gauge, Hash, IndianRupee, Loader2, LogIn,
  MapPin, Siren, Sparkles, Stethoscope, Users, XCircle, Ambulance, ShieldAlert, ArrowRight, Leaf,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { avatarGradient, initials } from "@/lib/avatar";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { DAY_ORDER, HEALTH_STYLE, parseList, useFacilityDetail, type FacilityDetail } from "./facility-detail-context";
import { DAY, ScoreRing, Trend, ago, inr } from "./detail-ui";

const DAY_SHORT: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
const time12 = (t: string | null) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

function hoursSummary(f: FacilityDetail): string {
  if (f.is24x7) return "Open 24×7";
  const open = DAY_ORDER.filter((d) => f.operatingHours.find((h) => h.dayOfWeek === d)?.isOpen);
  if (!open.length) return "Hours not set";
  const runs: number[][] = [];
  for (const d of open) { const last = runs.at(-1); const prev = last?.at(-1); if (last && prev !== undefined && DAY_ORDER.indexOf(d) === DAY_ORDER.indexOf(prev) + 1) last.push(d); else runs.push([d]); }
  const days = runs.map((r) => (r.length > 2 ? `${DAY_SHORT[r[0]]}–${DAY_SHORT[r.at(-1)!]}` : r.map((d) => DAY_SHORT[d]).join(", "))).join(", ");
  const slots = open.map((d) => { const h = f.operatingHours.find((x) => x.dayOfWeek === d)!; return `${time12(h.openingTime)}–${time12(h.closingTime)}${h.openingTime2 && h.closingTime2 ? `, ${time12(h.openingTime2)}–${time12(h.closingTime2)}` : ""}`; });
  return new Set(slots).size === 1 ? `${days} · ${slots[0]}` : days;
}

function Panel({ title, icon: Icon, action, className, children }: { title: string; icon: typeof Users; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <Card className={cn("gap-4 border-border bg-card/60 p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

const ACTOR_DOT: Record<string, string> = { facility: "bg-primary", staff: "bg-sky-500", admin: "bg-violet-500", system: "bg-muted-foreground" };

export function OverviewDashboard() {
  const { facility: f, insights } = useFacilityDetail();
  if (!insights) return <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading activity…</div>;

  const m = insights.metrics;
  const now = Date.now();
  const weeks = m.weekly.map((v, i) => {
    const end = new Date(now - (m.weekly.length - 1 - i) * 7 * DAY);
    return { week: end.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), visits: v };
  });
  const done = insights.checklist.filter((c) => c.done).length;
  const sub = f.subscriptions[0];
  const planStart = sub ? Date.parse(sub.startDate) : 0, planEnd = sub ? Date.parse(sub.endDate) : 0;
  const planPct = sub ? Math.min(100, Math.max(0, ((now - planStart) / Math.max(1, planEnd - planStart)) * 100)) : 0;
  const daysLeft = sub ? Math.ceil((planEnd - now) / DAY) : null;
  const specs = parseList(f.specializations), services = parseList(f.services);
  const modeMax = Math.max(1, ...m.byMode.map((x) => x.amount));
  const base = `/admin/facilities/${f.id}`;
  const edit = (section: string) => <Link href={`${base}/${section}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Edit <ArrowRight className="h-3 w-3" /></Link>;

  return (
    <div className="space-y-4">
      {/* Visits + engagement */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Patient visits" icon={Activity} className="xl:col-span-2" action={<span className="text-xs text-muted-foreground">Last 12 weeks</span>}>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div><p className="text-xs text-muted-foreground">Last 30 days</p><p className="text-2xl font-bold tabular-nums">{m.visits30}</p><p className="text-xs"><Trend now={m.visits30} prev={m.visitsPrev30} /></p></div>
            <div><p className="text-xs text-muted-foreground">All time</p><p className="text-2xl font-bold tabular-nums">{m.visits.toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">{m.firstVisitAt ? `since ${formatDate(m.firstVisitAt)}` : "no visits yet"}</p></div>
            <div><p className="text-xs text-muted-foreground">Patients</p><p className="text-2xl font-bold tabular-nums">{m.patients.toLocaleString("en-IN")}</p><p className="text-xs text-muted-foreground">{m.newPatients30} new in 30 days</p></div>
            <div><p className="text-xs text-muted-foreground">Clinical records</p><p className="text-2xl font-bold tabular-nums">{m.prescriptions + m.assessments}</p><p className="text-xs text-muted-foreground">{m.prescriptions} prescriptions · {m.assessments} Mizaj</p></div>
          </div>
          <div className="h-56 w-full">
            {m.visits === 0 ? (
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
                <Stethoscope className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">No patient visits yet</p>
                <p className="text-xs text-muted-foreground">The chart fills in once the clinic records its first visit.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeks} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--popover-foreground)" }}
                    labelFormatter={(l) => `Week ending ${l}`} formatter={(v) => [v, "Visits"]}
                  />
                  <Area type="monotone" dataKey="visits" stroke="var(--primary)" strokeWidth={2} fill="url(#visitsFill)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Engagement score" icon={Gauge}>
          <div className="flex items-center gap-4">
            <ScoreRing score={insights.score} band={insights.health} size={76} />
            <div>
              <p className={cn("text-xl font-bold", HEALTH_STYLE[insights.health].text)}>{HEALTH_STYLE[insights.health].label}</p>
              <p className="text-xs text-muted-foreground">Out of 100 — recent use counts most, then visit volume and setup.</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {insights.reasons.map((r) => (
              <div key={r.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5">{r.good ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}{r.text}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{r.points}/{r.max}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", r.good ? "bg-emerald-500" : r.points ? "bg-amber-500" : "bg-transparent")} style={{ width: `${(r.points / r.max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Revenue, plan, setup */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue" icon={IndianRupee} action={<span className="text-xs text-muted-foreground">Net of refunds</span>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Last 30 days</p><p className="text-xl font-bold tabular-nums">{inr(m.revenue30)}</p><p className="text-[11px]"><Trend now={m.revenue30} prev={m.revenuePrev30} money /></p></div>
            <div className="rounded-xl bg-muted/50 p-3"><p className="text-xs text-muted-foreground">All time</p><p className="text-xl font-bold tabular-nums">{inr(m.revenue)}</p><p className="text-[11px] text-muted-foreground">{m.payments} payment{m.payments === 1 ? "" : "s"}{m.refunds ? ` · ${inr(m.refunds)} refunded` : ""}</p></div>
          </div>
          {m.byMode.length ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">By payment method</p>
              {m.byMode.map((x) => (
                <div key={x.mode} className="text-sm">
                  <div className="mb-1 flex justify-between"><span>{x.mode}</span><span className="font-semibold tabular-nums">{inr(x.amount)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(x.amount / modeMax) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">No payments recorded yet.</p>}
        </Panel>

        <Panel title="Plan" icon={Sparkles} action={edit("plan")}>
          {sub ? (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xl font-bold">{sub.plan === "FREE" ? "Free trial" : "Premium"}</p>
                <span className={cn("text-sm font-semibold", daysLeft !== null && daysLeft < 0 ? "text-rose-600 dark:text-rose-400" : daysLeft !== null && daysLeft <= 14 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {daysLeft !== null && daysLeft < 0 ? "Expired" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                </span>
              </div>
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", daysLeft !== null && daysLeft <= 14 ? "bg-amber-500" : "bg-primary")} style={{ width: `${planPct}%` }} /></div>
                <div className="mt-1.5 flex justify-between text-xs text-muted-foreground"><span>{formatDate(sub.startDate)}</span><span>{formatDate(sub.endDate)}</span></div>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-muted/50 px-3 py-2"><dt className="text-xs text-muted-foreground">Status</dt><dd className="font-medium capitalize">{sub.status.toLowerCase()}</dd></div>
                <div className="rounded-lg bg-muted/50 px-3 py-2"><dt className="text-xs text-muted-foreground">Auto-renew</dt><dd className="font-medium">{sub.autoRenew ? "On" : "Off"}</dd></div>
              </dl>
            </>
          ) : <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">No plan yet — it starts when the clinic completes profile setup.</p>}
        </Panel>

        <Panel title="Setup checklist" icon={CheckCircle2} action={<span className="text-xs font-semibold tabular-nums text-muted-foreground">{done}/{insights.checklist.length}</span>}>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(done / insights.checklist.length) * 100}%` }} /></div>
          <ul className="grid gap-1.5 text-sm">
            {insights.checklist.map((c) => (
              <li key={c.key} className={cn("flex items-center gap-2", !c.done && "text-muted-foreground")}>
                {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0" />}{c.label}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Snapshot, team, activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Clinic snapshot" icon={Building2} action={edit("details")}>
          <dl className="space-y-2.5 text-sm">
            {([
              [Building2, "Type", f.facilityType || "Not set"],
              [Hash, "HFR number", f.hfrNumber || "Not added"],
              [CalendarDays, "Established", f.establishmentDate ? new Date(f.establishmentDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Not set"],
              [MapPin, "Address", [f.addressLine1, f.addressLine2, f.locality, f.city, f.district, f.state, f.pincode].filter(Boolean).join(", ") || "Not added"],
              [Clock, "Hours", hoursSummary(f)],
              [BedDouble, "Capacity", `${f.bedCapacity ?? 0} beds · ${f.dailyOpdCount ?? 0} OPD a day`],
            ] as const).map(([Icon, label, value]) => (
              <div key={label} className="grid grid-cols-[1.25rem_6.5rem_1fr] items-start gap-1">
                <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" /><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-border pt-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {f.is24x7 && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"><Clock className="h-3 w-3" />24×7</span>}
              {f.emergencyServices && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400"><Siren className="h-3 w-3" />Emergency</span>}
              {f.ambulanceAvailable && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"><Ambulance className="h-3 w-3" />Ambulance</span>}
            </div>
            <p className="text-xs text-muted-foreground"><Stethoscope className="mb-0.5 mr-1 inline h-3 w-3" />{specs.length} specialization{specs.length === 1 ? "" : "s"} · <Leaf className="mb-0.5 mr-1 inline h-3 w-3" />{services.length} service{services.length === 1 ? "" : "s"} · <Link href={`${base}/services`} className="text-primary hover:underline">view</Link></p>
            {specs.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{specs.slice(0, 6).map((s) => <span key={s} className="rounded-full border border-border px-2 py-0.5 text-[11px]">{s}</span>)}{specs.length > 6 && <span className="text-[11px] text-muted-foreground">+{specs.length - 6} more</span>}</div>}
          </div>
        </Panel>

        <Panel title="Team" icon={Users} action={<span className="text-xs text-muted-foreground">{insights.staff.filter((s) => s.active).length} active</span>}>
          {insights.staff.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center">
              <Users className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">No staff added</p>
              <p className="text-xs text-muted-foreground">The clinic owner works alone so far.</p>
            </div>
          ) : (
            <ul className="-mx-1 max-h-80 space-y-1 overflow-y-auto">
              {insights.staff.map((s) => (
                <li key={s.id} className={cn("flex items-center gap-3 rounded-lg px-1 py-1.5", !s.active && "opacity-50")}>
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white", avatarGradient(null))}>{initials(s.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{s.designation || s.role || s.employeeType}{!s.active && " · inactive"}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-muted-foreground" title={s.lastLoginAt ? formatDateTime(s.lastLoginAt) : "Never signed in"}>{s.lastLoginAt ? ago(s.lastLoginAt) : "Never"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity" icon={FileText}>
          {insights.events.length === 0 && insights.logins.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <>
              {insights.events.length > 0 && (
                <ol className="relative max-h-64 space-y-3 overflow-y-auto pl-4 before:absolute before:bottom-1 before:left-[3px] before:top-1 before:w-px before:bg-border">
                  {insights.events.map((e) => (
                    <li key={e.id} className="relative">
                      <span className={cn("absolute -left-4 top-1.5 h-[7px] w-[7px] rounded-full ring-2 ring-card", e.outcome === "success" ? ACTOR_DOT[e.actorType] ?? "bg-primary" : "bg-rose-500")} />
                      <p className="text-sm leading-snug">{e.summary}</p>
                      <p className="text-[11px] text-muted-foreground">{e.actorName} · {formatDateTime(e.createdAt)}{e.outcome !== "success" && <span className="ml-1 inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400"><ShieldAlert className="h-3 w-3" />{e.outcome}</span>}</p>
                    </li>
                  ))}
                </ol>
              )}
              {insights.logins.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Recent sign-ins</p>
                  <ul className="space-y-1.5">
                    {insights.logins.map((l) => (
                      <li key={l.id} className="flex items-center gap-2 text-xs">
                        <LogIn className={cn("h-3.5 w-3.5 shrink-0", l.status === "success" ? "text-emerald-500" : "text-rose-500")} />
                        <span className="min-w-0 flex-1 truncate">{l.displayName} · {[l.browser, l.os].filter(Boolean).join(" on ") || "Unknown device"}</span>
                        <span className="shrink-0 text-muted-foreground">{formatDateTime(l.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
