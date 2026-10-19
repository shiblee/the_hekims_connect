"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Loader2, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Building2, Activity, Users,
  Stethoscope, IndianRupee, Hourglass, Sparkles, SlidersHorizontal, X, Download, RefreshCw, TrendingUp, TrendingDown,
  Minus, ShieldCheck, ShieldAlert, Lock, UserX, ClipboardList, Rocket, MapPin, CheckCircle2, XCircle,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
interface Filters {
  q: string; health: Health | "all"; status: string; verified: string; profile: string; plan: string;
  type: string; state: string; city: string; login: string; activity: string; staff: string;
  services: string; from: string; to: string;
}
const NO_FILTERS: Filters = { q: "", health: "all", status: "all", verified: "all", profile: "all", plan: "all", type: "all", state: "all", city: "all", login: "all", activity: "all", staff: "all", services: "all", from: "", to: "" };

const LOGIN_OPTS: [string, string][] = [["within7", "Signed in within 7 days"], ["within30", "Signed in within 30 days"], ["over14", "No sign-in for 14+ days"], ["over30", "No sign-in for 30+ days"], ["never", "Never signed in"]];
const ACTIVITY_OPTS: [string, string][] = [["any", "Has visits"], ["recent", "Visits in last 30 days"], ["none", "No visits yet"], ["growing", "Visits growing"], ["declining", "Visits declining"]];
const SERVICE_OPTS: [string, string][] = [["24x7", "Open 24×7"], ["emergency", "Emergency services"], ["ambulance", "Ambulance"]];

function matches(r: Row, f: Filters): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && ![r.facilityName, r.email, r.phone, r.city, r.state, r.hfrNumber, r.facilityType].some((v) => v?.toLowerCase().includes(q))) return false;
  if (f.health !== "all" && r.health !== f.health) return false;
  if (f.status === "active" && (!r.active || r.locked)) return false;
  if (f.status === "suspended" && r.active) return false;
  if (f.status === "locked" && !r.locked) return false;
  if (f.verified !== "all" && String(r.verified) !== f.verified) return false;
  if (f.profile === "complete" && !r.profileCompleted) return false;
  if (f.profile === "incomplete" && r.profileCompleted) return false;
  if (f.plan === "ending" ? !(r.plan === "trial" && r.daysLeft !== null && r.daysLeft <= 14) : f.plan !== "all" && r.plan !== f.plan) return false;
  if (f.type !== "all" && (r.facilityType || "Not set") !== f.type) return false;
  if (f.state !== "all" && (r.state || "Not set") !== f.state) return false;
  if (f.city !== "all" && (r.city || "Not set") !== f.city) return false;
  const d = r.daysSinceLogin;
  if (f.login === "within7" && !(d !== null && d <= 7)) return false;
  if (f.login === "within30" && !(d !== null && d <= 30)) return false;
  if (f.login === "over14" && !(d === null || d >= 14)) return false;
  if (f.login === "over30" && !(d === null || d >= 30)) return false;
  if (f.login === "never" && d !== null) return false;
  if (f.activity === "any" && r.visits === 0) return false;
  if (f.activity === "recent" && r.visits30 === 0) return false;
  if (f.activity === "none" && r.visits > 0) return false;
  if (f.activity === "growing" && !(r.visits30 > r.visitsPrev30)) return false;
  if (f.activity === "declining" && !(r.visits30 < r.visitsPrev30)) return false;
  if (f.staff === "has" && r.staffActive === 0) return false;
  if (f.staff === "none" && r.staffActive > 0) return false;
  if (f.services === "24x7" && !r.is24x7) return false;
  if (f.services === "emergency" && !r.emergencyServices) return false;
  if (f.services === "ambulance" && !r.ambulanceAvailable) return false;
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

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; allLabel: string }) {
  return (
    <div className="min-w-0">
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("h-9 w-full bg-background/60", value !== "all" && "border-primary/50 text-primary")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
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
  const cities = useMemo(() => sortLabels([...new Set(all.filter((r) => f.state === "all" || (r.state || "Not set") === f.state).map((r) => r.city || "Not set"))]).map((v) => [v, v] as [string, string]), [all, f.state]);

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
      bands: HEALTH_ORDER.map((h) => [h, all.filter((r) => r.health === h).length] as const),
      plans: (["trial", "premium", "expired", "none"] as Plan[]).map((p) => [p, all.filter((r) => r.plan === p).length] as const),
    };
  }, [all]);

  // Insights: what needs attention, each one opens the matching filtered list.
  const insights = useMemo(() => {
    const now = Date.now();
    const list: { icon: typeof Building2; tone: "warn" | "bad" | "good" | "info"; title: string; detail: string; action: Partial<Filters> }[] = [];
    const quiet = all.filter((r) => r.active && (r.daysSinceLogin === null || r.daysSinceLogin >= 14));
    if (quiet.length) list.push({ icon: UserX, tone: "bad", title: `${quiet.length} clinic${quiet.length === 1 ? " hasn't" : "s haven't"} signed in for 14+ days`, detail: "Reach out before they drop off — a quick call often brings them back.", action: { login: "over14", status: "active" } });
    const ending = all.filter((r) => r.plan === "trial" && r.daysLeft !== null && r.daysLeft <= 14);
    if (ending.length) list.push({ icon: Hourglass, tone: "warn", title: `${ending.length} free trial${ending.length === 1 ? " ends" : "s end"} within 14 days`, detail: `Soonest: ${ending.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0].facilityName} (${Math.max(0, ending[0].daysLeft ?? 0)} days left).`, action: { plan: "ending" } });
    const incomplete = all.filter((r) => !r.profileCompleted && now - Date.parse(r.createdAt) > 2 * DAY);
    if (incomplete.length) list.push({ icon: ClipboardList, tone: "warn", title: `${incomplete.length} clinic${incomplete.length === 1 ? " is" : "s are"} stuck in profile setup`, detail: "Registered more than 2 days ago but never finished their profile.", action: { profile: "incomplete" } });
    const unused = all.filter((r) => r.visits === 0 && now - Date.parse(r.createdAt) > 7 * DAY);
    if (unused.length) list.push({ icon: Stethoscope, tone: "info", title: `${unused.length} clinic${unused.length === 1 ? " has" : "s have"} not recorded a visit yet`, detail: "Signed up over a week ago — they may need onboarding help.", action: { activity: "none" } });
    const unverified = all.filter((r) => !r.verified);
    if (unverified.length) list.push({ icon: ShieldAlert, tone: "info", title: `${unverified.length} clinic${unverified.length === 1 ? " is" : "s are"} not verified`, detail: "Review their details and HFR number.", action: { verified: "false" } });
    const locked = all.filter((r) => r.locked);
    if (locked.length) list.push({ icon: Lock, tone: "bad", title: `${locked.length} account${locked.length === 1 ? " is" : "s are"} locked after failed sign-ins`, detail: "They may need help resetting their password.", action: { status: "locked" } });
    const declining = all.filter((r) => r.visitsPrev30 >= 3 && r.visits30 < r.visitsPrev30 * 0.6);
    if (declining.length) list.push({ icon: TrendingDown, tone: "warn", title: `${declining.length} clinic${declining.length === 1 ? "'s" : "s'"} visits dropped by 40%+`, detail: "Compared with the previous 30 days.", action: { activity: "declining" } });
    const top = [...all].filter((r) => r.visits30 > r.visitsPrev30 && r.visits30 >= 3).sort((a, b) => (b.visits30 - b.visitsPrev30) - (a.visits30 - a.visitsPrev30))[0];
    if (top) list.push({ icon: Rocket, tone: "good", title: `${top.facilityName} is growing fastest`, detail: `${top.visits30} visits in 30 days, up from ${top.visitsPrev30}.`, action: { q: top.facilityName } });
    const fresh = all.filter((r) => now - Date.parse(r.createdAt) <= 7 * DAY);
    if (fresh.length) list.push({ icon: Sparkles, tone: "good", title: `${fresh.length} new clinic${fresh.length === 1 ? "" : "s"} joined this week`, detail: "Welcome them and check their setup.", action: { from: new Date(now - 7 * DAY).toISOString().slice(0, 10) } });
    return list;
  }, [all]);

  const activeFilters = (Object.keys(f) as (keyof Filters)[]).filter((key) => f[key] !== NO_FILTERS[key]);
  const chipLabel = (key: keyof Filters): string => {
    const v = f[key];
    const find = (opts: [string, string][]) => opts.find(([x]) => x === v)?.[1] ?? v;
    switch (key) {
      case "q": return `“${v}”`;
      case "health": return HEALTH[v as Health].label;
      case "status": return v === "active" ? "Active" : v === "suspended" ? "Suspended" : "Locked";
      case "verified": return v === "true" ? "Verified" : "Not verified";
      case "profile": return v === "complete" ? "Profile complete" : "Profile incomplete";
      case "plan": return v === "ending" ? "Trial ending ≤14 days" : PLAN_LABEL[v as Plan];
      case "login": return find(LOGIN_OPTS);
      case "activity": return find(ACTIVITY_OPTS);
      case "staff": return v === "has" ? "Has staff" : "No staff";
      case "services": return find(SERVICE_OPTS);
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

  const TONE = { bad: "bg-rose-500/10 text-rose-600 dark:text-rose-400", warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400", good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", info: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };

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
            <Kpi icon={Activity} label="Active this week" value={String(k.active7)} hint={<>{k.total ? Math.round((k.active7 / k.total) * 100) : 0}% of all clinics</>} onClick={() => apply({ login: "within7" })} />
            <Kpi icon={Users} label="Patients served" value={k.patients.toLocaleString("en-IN")} hint="Distinct patients per clinic" />
            <Kpi icon={Stethoscope} label="Visits · 30 days" value={k.visits30.toLocaleString("en-IN")} hint={<span className="inline-flex items-center gap-1"><Trend now={k.visits30} prev={k.prev30} /> vs previous 30 days</span>} onClick={() => apply({ activity: "recent" })} />
            <Kpi icon={IndianRupee} label="Revenue · 30 days" value={inr(k.revenue30)} hint={<>{inr(k.revenue)} all time, net</>} />
            <Kpi icon={Hourglass} label="Trials ending ≤14 days" value={String(k.ending)} hint="Convert to Premium" tone={k.ending ? "warn" : "default"} onClick={() => apply({ plan: "ending" })} />
          </div>

          {/* Insights + health */}
          <div data-tour="facilities.insights" className="mb-6 grid gap-4 lg:grid-cols-3">
            <Card className="gap-3 border-border bg-card/60 p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Insights</h2>
                <span className="text-xs text-muted-foreground">From live activity · click one to see those clinics</span>
              </div>
              {insights.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /> Nothing needs attention right now — every clinic is active and set up.</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {insights.slice(0, 8).map((i) => (
                    <button key={i.title} type="button" onClick={() => apply(i.action)} className="group flex items-start gap-3 rounded-xl border border-border bg-background/50 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", TONE[i.tone])}><i.icon className="h-4 w-4" /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug">{i.title}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{i.detail}</span>
                      </span>
                      <ChevronRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="gap-4 border-border bg-card/60 p-5">
              <div>
                <h2 className="font-serif text-lg font-semibold">Engagement health</h2>
                <p className="text-xs text-muted-foreground">Score from recent use, visit volume, profile, verification, payments and staff.</p>
              </div>
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {k.bands.map(([h, n]) => n > 0 && <div key={h} className={HEALTH[h].bar} style={{ width: `${(n / Math.max(1, k.total)) * 100}%` }} title={`${HEALTH[h].label}: ${n}`} />)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {k.bands.map(([h, n]) => (
                  <button key={h} type="button" onClick={() => apply({ health: h })} className={cn("flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40", f.health === h ? "border-primary/50 bg-primary/5" : "border-border bg-background/50")}>
                    <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", HEALTH[h].dot)} />{HEALTH[h].label}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Plans</p>
                <div className="flex flex-wrap gap-1.5">
                  {k.plans.filter(([, n]) => n > 0).map(([p, n]) => (
                    <button key={p} type="button" onClick={() => apply({ plan: p })} className="rounded-full border border-border bg-background/50 px-2.5 py-1 text-xs font-medium hover:border-primary/40">{PLAN_LABEL[p]} · {n}</button>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Search + filters */}
          <Card data-tour="facilities.filters" className="mb-4 gap-3 border-border bg-card/60 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="h-10 bg-background/60 pl-10" placeholder="Search name, email, phone, city, state, HFR or type…" value={f.q} onChange={(e) => set("q", e.target.value)} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(["all", ...HEALTH_ORDER] as const).map((h) => (
                  <button key={h} type="button" onClick={() => set("health", h)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", f.health === h ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 hover:border-primary/40")}>
                    {h !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", HEALTH[h].dot)} />}{h === "all" ? "All" : HEALTH[h].label}
                  </button>
                ))}
                <Button variant={showMore ? "default" : "outline"} size="sm" className="ml-1" onClick={() => setShowMore((s) => !s)}>
                  <SlidersHorizontal className="h-4 w-4" /> Filters{activeFilters.filter((x) => x !== "q" && x !== "health").length ? ` · ${activeFilters.filter((x) => x !== "q" && x !== "health").length}` : ""}
                </Button>
              </div>
            </div>

            {showMore && (
              <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <FilterSelect label="Status" value={f.status} onChange={(v) => set("status", v)} allLabel="Any status" options={[["active", "Active"], ["suspended", "Suspended"], ["locked", "Locked (failed sign-ins)"]]} />
                <FilterSelect label="Verification" value={f.verified} onChange={(v) => set("verified", v)} allLabel="Any" options={[["true", "Verified"], ["false", "Not verified"]]} />
                <FilterSelect label="Profile" value={f.profile} onChange={(v) => set("profile", v)} allLabel="Any" options={[["complete", "Complete"], ["incomplete", "Incomplete"]]} />
                <FilterSelect label="Plan" value={f.plan} onChange={(v) => set("plan", v)} allLabel="Any plan" options={[["trial", "Free trial"], ["ending", "Trial ending ≤14 days"], ["premium", "Premium"], ["expired", "Expired"], ["none", "No plan"]]} />
                <FilterSelect label="Facility type" value={f.type} onChange={(v) => set("type", v)} allLabel="All types" options={types} />
                <FilterSelect label="State" value={f.state} onChange={(v) => { setF((x) => ({ ...x, state: v, city: "all" })); setPage(1); }} allLabel="All states" options={states} />
                <FilterSelect label="City" value={f.city} onChange={(v) => set("city", v)} allLabel="All cities" options={cities} />
                <FilterSelect label="Last sign-in" value={f.login} onChange={(v) => set("login", v)} allLabel="Any time" options={LOGIN_OPTS} />
                <FilterSelect label="Patient activity" value={f.activity} onChange={(v) => set("activity", v)} allLabel="Any" options={ACTIVITY_OPTS} />
                <FilterSelect label="Staff" value={f.staff} onChange={(v) => set("staff", v)} allLabel="Any" options={[["has", "Has active staff"], ["none", "No staff"]]} />
                <FilterSelect label="Services" value={f.services} onChange={(v) => set("services", v)} allLabel="Any" options={SERVICE_OPTS} />
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
                    <tr><td colSpan={COLUMNS.length + 1} className="px-4 py-14 text-center">
                      <p className="font-medium">No facilities match these filters</p>
                      <button type="button" onClick={() => apply({})} className="mt-1 text-sm text-primary hover:underline">Clear all filters</button>
                    </td></tr>
                  ) : pageRows.map((r) => (
                    <tr key={r.id} onClick={() => router.push(`/admin/facilities/${r.id}`)} className="cursor-pointer transition-colors hover:bg-primary/[0.03]">
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
