"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterMultiSelect } from "@/components/admin/filter-multi-select";
import {
  Activity, AlertTriangle, Building2, ChevronLeft, ChevronRight, CreditCard, History, Loader2, LogIn, Search,
  ShieldAlert, Stethoscope, Trophy, UserCog, Users, X,
} from "lucide-react";
import { sortByLabel } from "@/lib/sort-options";

interface Event { id: string; createdAt: string; actorType: string; actorName: string; action: string; entityLabel: string | null; outcome: string; summary: string; ip: string | null; facilityName?: string }
interface Stats { signIns: number; problems: number; people: number; byGroup: { group: string; count: number }[]; top: { name: string; count: number }[] }
interface Resp {
  scope: "clinic" | "own" | "all"; events: Event[]; total: number; page: number; pageSize: number;
  actors: { actorId: string; actorName: string }[]; groups: string[]; labels: Record<string, string>; actionGroups?: Record<string, string>;
  facilities?: { id: string; facilityName: string }[]; stats?: Stats;
}
type Client = { get: <T = unknown>(url: string) => Promise<T> };

const RANGES = ["today", "7", "30", "365", "all"] as const;
/** Start/end of the chosen range in the viewer's own local days. */
function rangeOf(r: string): { from?: string; to?: string } {
  if (r === "all") return {};
  const start = new Date(); start.setHours(0, 0, 0, 0);
  if (r !== "today") start.setDate(start.getDate() - (Number(r) - 1));
  return { from: start.toISOString() };
}
const OUTCOME_TONE: Record<string, string> = {
  denied: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  failed: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};
// One colour + icon per activity group, so the timeline reads at a glance.
const GROUP_STYLE: Record<string, { icon: typeof Activity; tone: string; bar: string }> = {
  "Sign-in": { icon: LogIn, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400", bar: "bg-sky-500" },
  Security: { icon: ShieldAlert, tone: "bg-red-500/10 text-red-600 dark:text-red-400", bar: "bg-red-500" },
  Patients: { icon: Users, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400", bar: "bg-violet-500" },
  Visits: { icon: Stethoscope, tone: "bg-primary/10 text-primary", bar: "bg-primary" },
  Payments: { icon: CreditCard, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  Staff: { icon: UserCog, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  Clinic: { icon: Building2, tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300", bar: "bg-slate-500" },
};
const styleOf = (g: string) => GROUP_STYLE[g] ?? { icon: Activity, tone: "bg-muted text-muted-foreground", bar: "bg-muted-foreground" };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

/** Facility Profile → Activity log. Read-only; nothing here can change or remove an entry. */
export function ActivityLogView({ client = api, endpoint = "/api/facility/activity" }: { client?: Client; endpoint?: string } = {}) {
  const [facility, setFacility] = useState<string[]>([]);
  const [range, setRange] = useState("7");
  const [actor, setActor] = useState<string[]>([]);
  const [group, setGroup] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const msg = useNotice();
  const t = useTranslations("common.activity_log");
  const tc = useTranslations("common");
  const locale = useLocale();
  // Activity names and groups by key; anything new on the server shows its own English label.
  const actionLabel = (action: string) => { const k = action.replace(/\./g, "_"); return t.has(k) ? t(k) : data?.labels[action] ?? action; };
  const groupLabel = (g: string) => (t.has(`g_${g}`) ? t(`g_${g}`) : g);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), ...rangeOf(range) });
    if (actor.length) p.set("actor", actor.join(","));
    if (facility.length) p.set("facility", facility.join(","));
    if (group.length) p.set("group", group.join(","));
    if (outcome.length) p.set("outcome", outcome.join(","));
    if (query) p.set("q", query);
    try { setData(await client.get<Resp>(`${endpoint}?${p}`)); msg.clear(); }
    catch (e: any) { msg.error(t("load_failed"), `${e.message || tc("network_error")}.`, { retry: load }); }
    finally { setLoading(false); }
  }, [range, actor, group, outcome, query, page, facility, client, endpoint]);
  useEffect(() => { load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reset = (fn: () => void) => { fn(); setPage(1); };
  const ftext = { selected: (n: number) => t("n_selected", { count: n }), search: t("f_search"), clear: t("f_clear"), noMatches: t("f_none") };
  const filtersOn = !!(query || actor.length || group.length || outcome.length || facility.length);
  const clearAll = () => reset(() => { setQ(""); setQuery(""); setActor([]); setGroup([]); setOutcome([]); setFacility([]); });
  const toggleGroup = (g: string) => reset(() => setGroup((v) => (v.includes(g) ? v.filter((x) => x !== g) : [...v, g])));
  const problemsOnly = outcome.length === 2 && outcome.includes("failed") && outcome.includes("denied");
  const showPeople = data?.scope === "clinic" || (data?.scope === "all" && facility.length > 0);
  const st = data?.stats;

  // Timeline: entries under a heading per local day.
  const days = useMemo(() => {
    const out: { key: string; label: string; items: Event[] }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const e of data?.events ?? []) {
      const d = new Date(e.createdAt); d.setHours(0, 0, 0, 0);
      const key = d.toISOString();
      const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
      const label = diff === 0 ? t("day_today") : diff === 1 ? t("day_yesterday") : d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "short", year: "numeric" });
      if (out.at(-1)?.key !== key) out.push({ key, label, items: [] });
      out.at(-1)!.items.push(e);
    }
    return out;
  }, [data?.events, locale]);

  const kpis = [
    { label: t("k_entries"), value: data?.total, icon: History, tone: "bg-primary/10 text-primary" },
    { label: t("k_signins"), value: st?.signIns, icon: LogIn, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { label: t("k_people"), value: st?.people, icon: Users, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ];
  const mixTotal = st?.byGroup.reduce((n, g) => n + g.count, 0) || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-bold flex items-center gap-2"><History className="h-5 w-5 text-primary" /> {t("title")}</h2>
        <div className="inline-flex flex-wrap rounded-lg border border-border bg-background/60 p-0.5" role="group" aria-label={t("period")}>
          {RANGES.map((k) => (
            <button key={k} type="button" onClick={() => reset(() => setRange(k))} aria-pressed={range === k}
              className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors", range === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t(`r_${k}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Headline figures */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3.5">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", k.tone)}><k.icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-muted-foreground">{k.label}</span>
              <span className="block text-xl font-bold tabular-nums">{k.value ?? "…"}</span>
            </span>
          </div>
        ))}
        <button type="button" title={t("k_problems_hint")} onClick={() => reset(() => setOutcome(problemsOnly ? [] : ["failed", "denied"]))}
          className={cn("flex items-center gap-3 rounded-xl border bg-card/60 p-3.5 text-start transition-all hover:-translate-y-0.5 hover:border-red-500/40", problemsOnly ? "border-red-500/50 ring-1 ring-red-500/20" : "border-border")}>
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", st?.problems ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground")}><AlertTriangle className="h-5 w-5" /></span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-muted-foreground">{t("k_problems")}</span>
            <span className={cn("block text-xl font-bold tabular-nums", st?.problems ? "text-red-600 dark:text-red-400" : "")}>{st?.problems ?? "…"}</span>
          </span>
        </button>
      </div>

      {/* Activity mix + most active */}
      {st && st.byGroup.length > 0 && (
        <div className={cn("grid gap-3", st.top.length > 0 && data?.scope !== "own" && "lg:grid-cols-[minmax(0,1fr)_18rem]")}>
          <div className="rounded-xl border border-border bg-card/60 p-3.5">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{t("mix")}</p>
            <div className="mb-3 flex h-2 overflow-hidden rounded-full bg-muted">
              {st.byGroup.map((g) => <span key={g.group} className={cn("h-full", styleOf(g.group).bar)} style={{ width: `${(g.count / mixTotal) * 100}%` }} title={`${groupLabel(g.group)} · ${g.count}`} />)}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {st.byGroup.map((g) => {
                const on = group.includes(g.group); const S = styleOf(g.group);
                return (
                  <button key={g.group} type="button" onClick={() => toggleGroup(g.group)} aria-pressed={on}
                    className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/60 hover:border-primary/40")}>
                    <S.icon className="h-3.5 w-3.5" />{groupLabel(g.group)}<span className={cn("rounded-full px-1.5 tabular-nums", on ? "bg-primary-foreground/20" : "bg-muted")}>{g.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {st.top.length > 0 && data?.scope !== "own" && (
            <div className="rounded-xl border border-border bg-card/60 p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Trophy className="h-3.5 w-3.5 text-amber-500" /> {t("most_active")}</p>
              <ul className="space-y-1.5">
                {st.top.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="flex items-center gap-2 text-sm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t("n_actions", { count: p.count })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <form className="relative" onSubmit={(e) => { e.preventDefault(); reset(() => setQuery(q.trim())); }}>
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== query && reset(() => setQuery(q.trim()))} placeholder={t("search")} className="h-9 ps-9 bg-background/60" />
          </form>
          {data?.scope === "all" && (
            <FilterMultiSelect hideLabel label={t("clinic")} value={facility} onChange={(v) => reset(() => { setFacility(v); setActor([]); })} allLabel={t("all_clinics")} text={ftext} options={(data.facilities ?? []).map((f) => [f.id, f.facilityName] as [string, string])} />
          )}
          {showPeople && data && (
            <FilterMultiSelect hideLabel label={t("person")} value={actor} onChange={(v) => reset(() => setActor(v))} allLabel={t("everyone")} text={ftext} options={sortByLabel(data.actors, (a) => a.actorName).map((a) => [a.actorId, a.actorName] as [string, string])} />
          )}
          <FilterMultiSelect hideLabel label={t("type")} value={group} onChange={(v) => reset(() => setGroup(v))} allLabel={t("all_activity")} text={ftext} options={sortByLabel(data?.groups ?? [], groupLabel).map((g) => [g, groupLabel(g)] as [string, string])} />
          <FilterMultiSelect hideLabel label={t("outcome")} value={outcome} onChange={(v) => reset(() => setOutcome(v))} allLabel={t("any_outcome")} text={ftext} options={[["success", t("succeeded")], ["failed", t("failed")], ["denied", t("refused")]]} />
        </div>
        {filtersOn && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5 text-xs">
            <span className="text-muted-foreground">{t("entries", { count: data?.total ?? 0 })}</span>
            <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground hover:underline"><X className="h-3 w-3" /> {t("clear_all")}</button>
          </div>
        )}
      </div>
      <NoticeSlot state={msg} />

      {/* Timeline */}
      <div className="overflow-hidden rounded-xl border border-border bg-card/60">
        {loading && !data ? (
          <p className="px-3 py-10 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin me-2" />{tc("loading")}</p>
        ) : data && data.events.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("none")}</p>
            {filtersOn && <button type="button" onClick={clearAll} className="mt-1 text-sm text-primary hover:underline">{t("clear_all")}</button>}
          </div>
        ) : days.map((d) => (
          <section key={d.key}>
            <h3 className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{d.label}</span><span className="font-medium normal-case tracking-normal">{t("n_actions", { count: d.items.length })}</span>
            </h3>
            <ul className="divide-y divide-border">
              {d.items.map((e) => {
                const S = styleOf(data?.actionGroups?.[e.action] ?? "General"); const bad = e.outcome !== "success";
                return (
                  <li key={e.id} className={cn("flex gap-3 px-4 py-3", bad && "bg-red-500/[0.04]")}>
                    <span className="w-14 shrink-0 pt-1.5 text-end text-xs tabular-nums text-muted-foreground">{new Date(e.createdAt).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}</span>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", bad ? "bg-red-500/10 text-red-600 dark:text-red-400" : S.tone)}><S.icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold">{actionLabel(e.action)}</span>
                        {bad && <Badge variant="outline" className={cn("gap-1", OUTCOME_TONE[e.outcome])}>{e.outcome === "denied" && <ShieldAlert className="h-3 w-3" />}{e.outcome === "denied" ? t("refused") : t("failed")}</Badge>}
                      </p>
                      <p className="mt-0.5 text-sm text-foreground/80">{e.summary}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">{initials(e.actorName)}</span>
                          <span className="font-medium text-foreground/80">{e.actorName}</span>
                        </span>
                        <span>· {e.actorType === "staff" ? t("staff") : e.actorType === "facility" ? t("owner") : e.actorType}</span>
                        {e.facilityName && <span>· {e.facilityName}</span>}
                        {e.ip && <span>· IP {e.ip}</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{t("entries", { count: data.total })}{loading && <Loader2 className="ms-2 inline h-3.5 w-3.5 animate-spin" />}</span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t("newer")}</Button>
            {t("page_of", { page, pages })}
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>{t("older")} <ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
          </span>
        </div>
      )}
    </div>
  );
}
