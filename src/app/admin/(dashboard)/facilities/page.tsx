"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Building2, Activity, Users,
  Stethoscope, IndianRupee, Hourglass, SlidersHorizontal, X, Download, RefreshCw, TrendingUp, TrendingDown,
  Minus, ShieldCheck, ShieldAlert, Lock, MapPin, CheckCircle2, XCircle,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterMultiSelect } from "@/components/admin/filter-multi-select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { avatarGradient, initials } from "@/lib/avatar";
import { compareLabels, sortLabels } from "@/lib/sort-options";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";

type Health = "thriving" | "steady" | "at_risk" | "dormant";
type Plan = "trial" | "premium" | "expired" | "none";
interface Row {
  id: string; facilityName: string; email: string | null; phone: string | null; avatarColor: string;
  facilityType: string | null; city: string | null; state: string | null; hfrNumber: string | null;
  verified: boolean; active: boolean; locked: boolean; profileCompleted: boolean; profileCompletedAt: string | null;
  is24x7: boolean; emergencyServices: boolean; ambulanceAvailable: boolean; bedCapacity: number | null; dailyOpdCount: number | null;
  createdAt: string; lastLoginAt: string | null; daysSinceLogin: number | null; daysSinceActivity: number | null;
  plan: Plan; planEnd: string | null; daysLeft: number | null;
  patients: number; visits: number; visits30: number; visitsPrev30: number; weekly: number[];
  revenue: number; revenue30: number; staff: number; staffActive: number;
  score: number; health: Health; reasons: { text: string; good: boolean }[];
}

const HEALTH: Record<Health, { label: string; dot: string; text: string; bar: string; ring: string }> = {
  thriving: { label: "Thriving", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", ring: "stroke-emerald-500" },
  steady: { label: "Steady", dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400", bar: "bg-sky-500", ring: "stroke-sky-500" },
  at_risk: { label: "At risk", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", ring: "stroke-amber-500" },
  dormant: { label: "Dormant", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", bar: "bg-rose-500", ring: "stroke-rose-500" },
};
const HEALTH_ORDER: Health[] = ["thriving", "steady", "at_risk", "dormant"];
const PLAN_LABEL: Record<Plan, string> = { trial: "Free trial", premium: "Premium", expired: "Expired", none: "No plan" };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const DAY = 86_400_000;
const ago = (days: number | null) => days === null ? "Never" : days === 0 ? "Today" : days === 1 ? "Yesterday" : days < 30 ? `${days} days ago` : days < 365 ? `${Math.floor(days / 30)} mo ago` : `${Math.floor(days / 365)} yr ago`;

// ── Filters ────────────────────────────────────────────────────────────────
// Every list filter is multi-select: nothing picked = all; several picked = any of them.
interface Filters {
  q: string; health: Health[]; status: string[]; verified: string[]; profile: string[]; plan: string[];
  type: string[]; state: string[]; city: string[]; login: string[]; activity: string[]; staff: string[];
  services: string[]; from: string; to: string;
}
type ListKey = { [K in keyof Filters]: Filters[K] extends string[] ? K : never }[keyof Filters];
const NO_FILTERS: Filters = { q: "", health: [], status: [], verified: [], profile: [], plan: [], type: [], state: [], city: [], login: [], activity: [], staff: [], services: [], from: "", to: "" };

const LOGIN_OPTS: [string, string][] = [["within7", "Signed in within 7 days"], ["within30", "Signed in within 30 days"], ["over14", "No sign-in for 14+ days"], ["over30", "No sign-in for 30+ days"], ["never", "Never signed in"]];
const ACTIVITY_OPTS: [string, string][] = [["any", "Has visits"], ["recent", "Visits in last 30 days"], ["none", "No visits yet"], ["growing", "Visits growing"], ["declining", "Visits declining"]];
const SERVICE_OPTS: [string, string][] = [["24x7", "Open 24×7"], ["emergency", "Emergency services"], ["ambulance", "Ambulance"]];
const STATUS_OPTS: [string, string][] = [["active", "Active"], ["suspended", "Suspended"], ["locked", "Locked (failed sign-ins)"]];
const VERIFIED_OPTS: [string, string][] = [["true", "Verified"], ["false", "Not verified"]];
const PROFILE_OPTS: [string, string][] = [["complete", "Profile complete"], ["incomplete", "Profile incomplete"]];
const PLAN_OPTS: [string, string][] = [["trial", "Free trial"], ["ending", "Trial ending ≤14 days"], ["premium", "Premium"], ["expired", "Expired"], ["none", "No plan"]];
const STAFF_OPTS: [string, string][] = [["has", "Has active staff"], ["none", "No staff"]];
const HEALTH_OPTS: [string, string][] = HEALTH_ORDER.map((h) => [h, HEALTH[h].label]);

// One test per option value; a row passes a filter when it matches any picked value.
const TESTS: Partial<Record<ListKey, Record<string, (r: Row) => boolean>>> = {
  status: { active: (r) => r.active && !r.locked, suspended: (r) => !r.active, locked: (r) => r.locked },
  verified: { true: (r) => r.verified, false: (r) => !r.verified },
  profile: { complete: (r) => r.profileCompleted, incomplete: (r) => !r.profileCompleted },
  plan: { ending: (r) => r.plan === "trial" && r.daysLeft !== null && r.daysLeft <= 14, trial: (r) => r.plan === "trial", premium: (r) => r.plan === "premium", expired: (r) => r.plan === "expired", none: (r) => r.plan === "none" },
  login: {
    within7: (r) => r.daysSinceLogin !== null && r.daysSinceLogin <= 7,
    within30: (r) => r.daysSinceLogin !== null && r.daysSinceLogin <= 30,
    over14: (r) => r.daysSinceLogin === null || r.daysSinceLogin >= 14,
    over30: (r) => r.daysSinceLogin === null || r.daysSinceLogin >= 30,
    never: (r) => r.daysSinceLogin === null,
  },
  activity: { any: (r) => r.visits > 0, recent: (r) => r.visits30 > 0, none: (r) => r.visits === 0, growing: (r) => r.visits30 > r.visitsPrev30, declining: (r) => r.visits30 < r.visitsPrev30 },
  staff: { has: (r) => r.staffActive > 0, none: (r) => r.staffActive === 0 },
  services: { "24x7": (r) => r.is24x7, emergency: (r) => r.emergencyServices, ambulance: (r) => r.ambulanceAvailable },
};
const VALUE_OF: Partial<Record<ListKey, (r: Row) => string>> = {
  health: (r) => r.health, type: (r) => r.facilityType || "Not set", state: (r) => r.state || "Not set", city: (r) => r.city || "Not set",
};
const LIST_KEYS: ListKey[] = ["health", "status", "verified", "profile", "plan", "type", "state", "city", "login", "activity", "staff", "services"];

function matches(r: Row, f: Filters): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && ![r.facilityName, r.email, r.phone, r.city, r.state, r.hfrNumber, r.facilityType].some((v) => v?.toLowerCase().includes(q))) return false;
  for (const key of LIST_KEYS) {
    const picked = f[key] as string[];
    if (!picked.length) continue;
    const value = VALUE_OF[key];
    const ok = value ? picked.includes(value(r)) : picked.some((v) => TESTS[key]?.[v]?.(r));
    if (!ok) return false;
  }
  if (f.from && new Date(r.createdAt) < new Date(`${f.from}T00:00:00`)) return false;
  if (f.to && new Date(r.createdAt) > new Date(`${f.to}T23:59:59`)) return false;
  return true;
}

// ── Sorting ────────────────────────────────────────────────────────────────
type SortKey = "name" | "location" | "health" | "plan" | "patients" | "visits30" | "revenue30" | "staff" | "lastLogin" | "registered" | "status";
const SORTERS: Record<SortKey, (a: Row, b: Row) => number> = {
  name: (a, b) => compareLabels(a.facilityName, b.facilityName),
  location: (a, b) => compareLabels(`${a.city ?? "~"} ${a.state ?? ""}`, `${b.city ?? "~"} ${b.state ?? ""}`),
  health: (a, b) => a.score - b.score,
  plan: (a, b) => (a.daysLeft ?? -1e9) - (b.daysLeft ?? -1e9),
  patients: (a, b) => a.patients - b.patients,
  visits30: (a, b) => a.visits30 - b.visits30,
  revenue30: (a, b) => a.revenue30 - b.revenue30,
  staff: (a, b) => a.staffActive - b.staffActive,
  lastLogin: (a, b) => (a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0) - (b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0),
  registered: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  status: (a, b) => Number(a.active && !a.locked) * 2 + Number(a.verified) - (Number(b.active && !b.locked) * 2 + Number(b.verified)),
};
const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Facility" }, { key: "location", label: "Location" }, { key: "health", label: "Health" },
  { key: "plan", label: "Plan" }, { key: "patients", label: "Patients", align: "right" }, { key: "visits30", label: "Visits · 30d", align: "right" },
  { key: "revenue30", label: "Revenue · 30d", align: "right" }, { key: "staff", label: "Staff", align: "right" },
  { key: "lastLogin", label: "Last sign-in" }, { key: "registered", label: "Registered" }, { key: "status", label: "Status" },
];

// ── Small visuals ──────────────────────────────────────────────────────────
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(1, ...data);
  const w = 64, h = 20;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={cn("overflow-visible", className)} aria-hidden>
      <polyline points={`0,${h} ${pts} ${w},${h}`} className="fill-primary/10 stroke-none" />
      <polyline points={pts} className="fill-none stroke-primary" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function ScoreRing({ score, health }: { score: number; health: Health }) {
  const r = 14, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex h-9 w-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} className="fill-none stroke-muted" strokeWidth={3.5} />
        <circle cx="18" cy="18" r={r} className={cn("fill-none", HEALTH[health].ring)} strokeWidth={3.5} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="text-[11px] font-bold tabular-nums">{score}</span>
    </span>
  );
}

function Trend({ now, prev }: { now: number; prev: number }) {
  if (now === prev) return <Minus className="h-3 w-3 text-muted-foreground" />;
  const up = now > prev;
  const Icon = up ? TrendingUp : TrendingDown;
  const pct = prev === 0 ? null : Math.round((Math.abs(now - prev) / prev) * 100);
  return <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-semibold", up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}><Icon className="h-3 w-3" />{pct === null ? "new" : `${pct}%`}</span>;
}

function Kpi({ icon: Icon, label, value, hint, tone = "default", onClick }: { icon: typeof Building2; label: string; value: string; hint?: React.ReactNode; tone?: "default" | "primary" | "warn"; onClick?: () => void }) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "gap-0 p-4 transition-all",
        tone === "primary" ? "border-primary/30 bg-primary/5" : tone === "warn" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card/60",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function FacilityListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [showMore, setShowMore] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "registered", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true); setError("");
    try {
      const res = await adminApi.get<{ facilities: Row[]; generatedAt: string }>("/api/admin/facilities/overview");
      setRows(res.facilities); setGeneratedAt(res.generatedAt);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load facilities"); setRows((r) => r ?? []); }
    finally { setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const apply = (patch: Partial<Filters>) => { setF({ ...NO_FILTERS, ...patch }); setShowMore(Object.keys(patch).some((k) => !["q", "health"].includes(k))); setPage(1); };
  const toggleHealth = (h: Health) => set("health", f.health.includes(h) ? f.health.filter((x) => x !== h) : [...f.health, h]);

  const all = rows ?? [];
  const filtered = useMemo(() => all.filter((r) => matches(r, f)), [all, f]);
  const sorted = useMemo(() => {
    const s = [...filtered].sort(SORTERS[sort.key]);
    return sort.dir === "desc" ? s.reverse() : s;
  }, [filtered, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, totalPages);
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize);

  const distinct = (pick: (r: Row) => string | null) => sortLabels([...new Set(all.map((r) => pick(r) || "Not set"))]).map((v) => [v, v] as [string, string]);
  const types = useMemo(() => distinct((r) => r.facilityType), [all]);
  const states = useMemo(() => distinct((r) => r.state), [all]);
  const cities = useMemo(() => sortLabels([...new Set(all.filter((r) => !f.state.length || f.state.includes(r.state || "Not set")).map((r) => r.city || "Not set"))]).map((v) => [v, v] as [string, string]), [all, f.state]);

  // Platform figures
  const k = useMemo(() => {
    const now = Date.now();
    const active7 = all.filter((r) => r.daysSinceActivity !== null && r.daysSinceActivity <= 7).length;
    const new30 = all.filter((r) => now - Date.parse(r.createdAt) <= 30 * DAY).length;
    const visits30 = all.reduce((s, r) => s + r.visits30, 0), prev30 = all.reduce((s, r) => s + r.visitsPrev30, 0);
    return {
      total: all.length, new30, active7,
      patients: all.reduce((s, r) => s + r.patients, 0),
      visits30, prev30,
      revenue30: all.reduce((s, r) => s + r.revenue30, 0), revenue: all.reduce((s, r) => s + r.revenue, 0),
      ending: all.filter((r) => r.plan === "trial" && r.daysLeft !== null && r.daysLeft <= 14).length,
    };
  }, [all]);

  const activeFilters = (Object.keys(f) as (keyof Filters)[]).filter((key) => (Array.isArray(f[key]) ? (f[key] as string[]).length > 0 : f[key] !== NO_FILTERS[key]));
  const OPTS: Record<ListKey, [string, string][]> = {
    health: HEALTH_OPTS, status: STATUS_OPTS, verified: VERIFIED_OPTS, profile: PROFILE_OPTS, plan: PLAN_OPTS, type: types, state: states, city: cities,
    login: LOGIN_OPTS, activity: ACTIVITY_OPTS, staff: STAFF_OPTS, services: SERVICE_OPTS,
  };
  const FILTER_NAME: Record<ListKey, string> = {
    health: "Health", status: "Status", verified: "Verification", profile: "Profile", plan: "Plan", type: "Type", state: "State", city: "City",
    login: "Last sign-in", activity: "Activity", staff: "Staff", services: "Services",
  };
  const chipLabel = (key: keyof Filters): string => {
    const v = f[key];
    if (Array.isArray(v)) {
      const names = v.map((x) => OPTS[key as ListKey].find(([o]) => o === x)?.[1] ?? x);
      return `${FILTER_NAME[key as ListKey]}: ${names.join(", ")}`;
    }
    switch (key) {
      case "q": return `“${v}”`;
      case "from": return `From ${formatDate(v)}`;
      case "to": return `To ${formatDate(v)}`;
      default: return String(v);
    }
  };

  const toggleSort = (key: SortKey) => setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "location" ? "asc" : "desc" });

  const exportCsv = () => {
    const head = ["Facility", "Type", "City", "State", "Email", "Phone", "HFR", "Health", "Score", "Plan", "Days left", "Patients", "Visits (30d)", "Visits (prev 30d)", "Revenue (30d)", "Revenue (all)", "Active staff", "Last sign-in", "Registered", "Verified", "Status", "Profile"];
    const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = sorted.map((r) => [r.facilityName, r.facilityType, r.city, r.state, r.email, r.phone, r.hfrNumber, HEALTH[r.health].label, r.score, PLAN_LABEL[r.plan], r.daysLeft, r.patients, r.visits30, r.visitsPrev30, r.revenue30, r.revenue, r.staffActive, r.lastLoginAt ? formatDateTime(r.lastLoginAt) : "Never", formatDate(r.createdAt), r.verified ? "Yes" : "No", r.active ? (r.locked ? "Locked" : "Active") : "Suspended", r.profileCompleted ? "Complete" : "Incomplete"].map(esc).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `facilities-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };


  return (
    <div className="mx-auto max-w-[1680px] px-4 py-10 sm:px-6 lg:px-16">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl"><Building2 className="h-6 w-6 text-primary" /> Facilities</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every clinic on the platform — how they&apos;re doing, who needs attention, and where to act next.</p>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && <span className="hidden text-xs text-muted-foreground sm:inline">Updated {formatDateTime(generatedAt)}</span>}
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}><RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!sorted.length}><Download className="h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading facilities…</div>
      ) : (
        <>
          {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

          {/* KPIs */}
          <div data-tour="facilities.kpis" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi icon={Building2} label="Facilities" value={String(k.total)} hint={<>{k.new30} new in 30 days</>} tone="primary" onClick={() => apply({})} />
            <Kpi icon={Activity} label="Active this week" value={String(k.active7)} hint={<>{k.total ? Math.round((k.active7 / k.total) * 100) : 0}% of all clinics</>} onClick={() => apply({ login: ["within7"] })} />
            <Kpi icon={Users} label="Patients served" value={k.patients.toLocaleString("en-IN")} hint="Distinct patients per clinic" />
            <Kpi icon={Stethoscope} label="Visits · 30 days" value={k.visits30.toLocaleString("en-IN")} hint={<span className="inline-flex items-center gap-1"><Trend now={k.visits30} prev={k.prev30} /> vs previous 30 days</span>} onClick={() => apply({ activity: ["recent"] })} />
            <Kpi icon={IndianRupee} label="Revenue · 30 days" value={inr(k.revenue30)} hint={<>{inr(k.revenue)} all time, net</>} />
            <Kpi icon={Hourglass} label="Trials ending ≤14 days" value={String(k.ending)} hint="Convert to Premium" tone={k.ending ? "warn" : "default"} onClick={() => apply({ plan: ["ending"] })} />
          </div>

          {/* Search + filters */}
          <Card data-tour="facilities.filters" className="mb-4 gap-3 border-border bg-card/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-10 bg-background/60 pl-10" placeholder="Search name, email, phone, city, state, HFR or type…" value={f.q} onChange={(e) => set("q", e.target.value)} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" onClick={() => set("health", [])} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", !f.health.length ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 hover:border-primary/40")}>All</button>
                {HEALTH_ORDER.map((h) => (
                  <button key={h} type="button" aria-pressed={f.health.includes(h)} onClick={() => toggleHealth(h)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", f.health.includes(h) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 hover:border-primary/40")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", HEALTH[h].dot)} />{HEALTH[h].label}
                  </button>
                ))}
                <Button variant={showMore ? "default" : "outline"} size="sm" className="ml-1" onClick={() => setShowMore((s) => !s)}>
                  <SlidersHorizontal className="h-4 w-4" /> Filters{activeFilters.filter((x) => x !== "q" && x !== "health").length ? ` · ${activeFilters.filter((x) => x !== "q" && x !== "health").length}` : ""}
                </Button>
              </div>
            </div>

            {showMore && (
              <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FilterMultiSelect label="Status" value={f.status} onChange={(v) => set("status", v)} allLabel="Any status" options={STATUS_OPTS} />
                <FilterMultiSelect label="Verification" value={f.verified} onChange={(v) => set("verified", v)} allLabel="Any" options={VERIFIED_OPTS} />
                <FilterMultiSelect label="Profile" value={f.profile} onChange={(v) => set("profile", v)} allLabel="Any" options={PROFILE_OPTS} />
                <FilterMultiSelect label="Plan" value={f.plan} onChange={(v) => set("plan", v)} allLabel="Any plan" options={PLAN_OPTS} />
                <FilterMultiSelect label="Facility type" value={f.type} onChange={(v) => set("type", v)} allLabel="All types" options={types} />
                <FilterMultiSelect label="State" value={f.state} onChange={(v) => { setF((x) => ({ ...x, state: v, city: [] })); setPage(1); }} allLabel="All states" options={states} />
                <FilterMultiSelect label="City" value={f.city} onChange={(v) => set("city", v)} allLabel="All cities" options={cities} />
                <FilterMultiSelect label="Last sign-in" value={f.login} onChange={(v) => set("login", v)} allLabel="Any time" options={LOGIN_OPTS} />
                <FilterMultiSelect label="Patient activity" value={f.activity} onChange={(v) => set("activity", v)} allLabel="Any" options={ACTIVITY_OPTS} />
                <FilterMultiSelect label="Staff" value={f.staff} onChange={(v) => set("staff", v)} allLabel="Any" options={STAFF_OPTS} />
                <FilterMultiSelect label="Services" value={f.services} onChange={(v) => set("services", v)} allLabel="Any" options={SERVICE_OPTS} />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Registered from</label><Input type="date" className="h-9 bg-background/60 px-2 text-xs" value={f.from} max={f.to || undefined} onChange={(e) => set("from", e.target.value)} /></div>
                  <div><label className="mb-1 block text-xs font-medium text-muted-foreground">to</label><Input type="date" className="h-9 bg-background/60 px-2 text-xs" value={f.to} min={f.from || undefined} onChange={(e) => set("to", e.target.value)} /></div>
                </div>
              </div>
            )}

            {activeFilters.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                <span className="mr-1 text-xs text-muted-foreground">{sorted.length} of {all.length} shown</span>
                {activeFilters.map((key) => (
                  <span key={key} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 py-0.5 pl-2.5 pr-1 text-xs font-medium text-primary">
                    {chipLabel(key)}
                    <button type="button" aria-label={`Remove ${chipLabel(key)}`} onClick={() => set(key, NO_FILTERS[key])} className="rounded-full p-0.5 hover:bg-primary/10"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <button type="button" onClick={() => apply({})} className="ml-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">Clear all</button>
              </div>
            )}
          </Card>

          {/* Table */}
          <Card data-tour="facilities.table" className="overflow-hidden border-border bg-card/60 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b border-border text-left">
                    <th className="w-12 whitespace-nowrap px-2.5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">S.No</th>
                    {COLUMNS.map((c) => {
                      const on = sort.key === c.key;
                      const Icon = !on ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
                      return (
                        <th key={c.key} className={cn("whitespace-nowrap px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide", c.align === "right" && "text-right")} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                          <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 transition-colors hover:text-foreground", on ? "text-foreground" : "text-muted-foreground")}>
                            {c.label}<Icon className={cn("h-3.5 w-3.5", !on && "opacity-50")} />
                          </button>
                        </th>
                      );
                    })}
                    <th className="w-10 px-1 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={COLUMNS.length + 2} className="px-4 py-14 text-center">
                      <p className="font-medium">No facilities match these filters</p>
                      <button type="button" onClick={() => apply({})} className="mt-1 text-sm text-primary hover:underline">Clear all filters</button>
                    </td></tr>
                  ) : pageRows.map((r, i) => (
                    <tr key={r.id} onClick={() => router.push(`/admin/facilities/${r.id}`)} className="cursor-pointer transition-colors hover:bg-primary/[0.03]">
                      <td className="px-2.5 py-3 text-right tabular-nums text-muted-foreground">{(current - 1) * pageSize + i + 1}</td>
                      <td className="px-2.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br", avatarGradient(r.avatarColor))}><span className="text-[11px] font-bold text-white">{initials(r.facilityName)}</span></div>
                          <div className="min-w-0">
                            <p className="max-w-[12rem] truncate font-semibold" title={r.facilityName}>{r.facilityName}</p>
                            <p className="max-w-[12rem] truncate text-xs text-muted-foreground" title={[r.email, r.phone].filter(Boolean).join(" · ")}>{r.facilityType || "Type not set"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3">
                        {r.city || r.state ? (
                          <>
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{r.city || r.state}</span>
                            {r.city && r.state && <p className="pl-4 text-xs text-muted-foreground">{r.state}</p>}
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-2.5 py-3" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="flex items-center gap-2"><ScoreRing score={r.score} health={r.health} /><span className={cn("text-xs font-semibold", HEALTH[r.health].text)}>{HEALTH[r.health].label}</span></button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <p className="mb-1 font-semibold">Engagement score {r.score}/100</p>
                            <ul className="space-y-0.5">{r.reasons.map((x) => <li key={x.text} className="flex items-center gap-1.5">{x.good ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <XCircle className="h-3 w-3 shrink-0 opacity-70" />}{x.text}</li>)}</ul>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3">
                        <span className={cn("text-xs font-semibold", r.plan === "premium" ? "text-primary" : r.plan === "expired" ? "text-rose-600 dark:text-rose-400" : "")}>{PLAN_LABEL[r.plan]}</span>
                        {r.plan === "trial" && r.daysLeft !== null && <p className={cn("text-xs", r.daysLeft <= 14 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{r.daysLeft} day{r.daysLeft === 1 ? "" : "s"} left</p>}
                        {r.plan !== "trial" && r.planEnd && <p className="text-xs text-muted-foreground">{r.plan === "expired" ? "Ended" : "Until"} {formatDate(r.planEnd)}</p>}
                      </td>
                      <td className="px-2.5 py-3 text-right font-semibold tabular-nums">{r.patients.toLocaleString("en-IN")}</td>
                      <td className="px-2.5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Sparkline data={r.weekly} className="hidden 2xl:block" />
                          <div className="text-right"><p className="font-semibold tabular-nums">{r.visits30}</p><Trend now={r.visits30} prev={r.visitsPrev30} /></div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-right font-semibold tabular-nums">{inr(r.revenue30)}</td>
                      <td className="px-2.5 py-3 text-right tabular-nums">{r.staffActive}{r.staff > r.staffActive && <span className="text-xs text-muted-foreground"> /{r.staff}</span>}</td>
                      <td className="whitespace-nowrap px-2.5 py-3" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setHistoryTarget({ id: r.id, name: r.facilityName })} className="text-left hover:text-primary" title={r.lastLoginAt ? formatDateTime(r.lastLoginAt) : "Never signed in"}>
                          <span className={cn("block", (r.daysSinceLogin === null || r.daysSinceLogin >= 14) && "text-rose-600 dark:text-rose-400")}>{ago(r.daysSinceLogin)}</span>
                          <span className="text-xs text-muted-foreground underline-offset-2 hover:underline">History</span>
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-3 text-muted-foreground">{formatDate(r.createdAt)}</td>
                      <td className="px-2.5 py-3">
                        <div className="flex flex-col items-start gap-1">
                          {!r.active ? <Badge variant="outline" className="border-destructive/40 text-destructive">Suspended</Badge>
                            : r.locked ? <Badge variant="outline" className="border-amber-500/40 text-amber-600"><Lock className="mr-1 h-3 w-3" />Locked</Badge>
                              : <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">Active</Badge>}
                          {r.verified
                            ? <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary"><ShieldCheck className="h-3 w-3" />Verified</span>
                            : <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldAlert className="h-3 w-3" />Unverified</span>}
                        </div>
                      </td>
                      <td className="py-3 pl-1 pr-3 text-right">
                        <Link href={`/admin/facilities/${r.id}`} onClick={(e) => e.stopPropagation()} aria-label={`Open ${r.facilityName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"><ChevronRight className="h-4 w-4" /></Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{sorted.length ? `${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, sorted.length)} of ${sorted.length}` : "0 results"}</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="h-8 w-[110px] bg-background/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
                <span className="px-2 text-muted-foreground">Page {current} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        </>
      )}

      {historyTarget && (
        <LoginHistoryDialog role="facility" id={historyTarget.id} name={historyTarget.name} open={!!historyTarget} onOpenChange={(o) => { if (!o) setHistoryTarget(null); }} />
      )}
    </div>
  );
}
