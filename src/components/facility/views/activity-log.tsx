"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, History, Loader2, Search, ShieldAlert } from "lucide-react";
import { sortByLabel } from "@/lib/sort-options";

interface Event { id: string; createdAt: string; actorType: string; actorName: string; action: string; entityLabel: string | null; outcome: string; summary: string; ip: string | null; facilityName?: string }
interface Resp { scope: "clinic" | "own" | "all"; events: Event[]; total: number; page: number; pageSize: number; actors: { actorId: string; actorName: string }[]; groups: string[]; labels: Record<string, string>; facilities?: { id: string; facilityName: string }[] }
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

/** Facility Profile → Activity log. Read-only; nothing here can change or remove an entry. */
export function ActivityLogView({ client = api, endpoint = "/api/facility/activity" }: { client?: Client; endpoint?: string } = {}) {
  const [facility, setFacility] = useState("all");
  const [range, setRange] = useState("7");
  const [actor, setActor] = useState("all");
  const [group, setGroup] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const msg = useNotice();
  const t = useTranslations("common.activity_log");
  const tc = useTranslations("common");
  // Activity names and groups by key; anything new on the server shows its own English label.
  const actionLabel = (action: string) => { const k = action.replace(/\./g, "_"); return t.has(k) ? t(k) : data?.labels[action] ?? action; };
  const groupLabel = (g: string) => (t.has(`g_${g}`) ? t(`g_${g}`) : g);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), ...rangeOf(range) });
    if (actor !== "all") p.set("actor", actor);
    if (facility !== "all") p.set("facility", facility);
    if (group !== "all") p.set("group", group);
    if (outcome !== "all") p.set("outcome", outcome);
    if (query) p.set("q", query);
    try { setData(await client.get<Resp>(`${endpoint}?${p}`)); msg.clear(); }
    catch (e: any) { msg.error(t("load_failed"), `${e.message || tc("network_error")}.`, { retry: load }); }
    finally { setLoading(false); }
  }, [range, actor, group, outcome, query, page, facility, client, endpoint]);
  useEffect(() => { load(); }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-xl font-bold flex items-center gap-2"><History className="h-5 w-5 text-primary" /> {t("title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(data?.scope === "own" ? "scope_own" : data?.scope === "all" ? "scope_all" : "scope_clinic")} {t("permanent")}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
        <form className="relative" onSubmit={(e) => { e.preventDefault(); reset(() => setQuery(q.trim())); }}>
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q.trim() !== query && reset(() => setQuery(q.trim()))} placeholder={t("search")} className="ps-9 bg-background/60" />
        </form>
        <Select value={range} onValueChange={(v) => reset(() => setRange(v))}>
          <SelectTrigger className="bg-background/60" aria-label={t("period")}><SelectValue /></SelectTrigger>
          <SelectContent>{RANGES.map((k) => <SelectItem key={k} value={k}>{t(`r_${k}`)}</SelectItem>)}</SelectContent>
        </Select>
        {data?.scope === "all" && (
          <Select value={facility} onValueChange={(v) => reset(() => { setFacility(v); setActor("all"); })}>
            <SelectTrigger className="bg-background/60" aria-label={t("clinic")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all_clinics")}</SelectItem>
              {(data.facilities ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.facilityName}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {data?.scope === "clinic" || (data?.scope === "all" && facility !== "all") ? (
          <Select value={actor} onValueChange={(v) => reset(() => setActor(v))}>
            <SelectTrigger className="bg-background/60" aria-label={t("person")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("everyone")}</SelectItem>
              {data.actors.map((a) => <SelectItem key={a.actorId} value={a.actorId}>{a.actorName}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={group} onValueChange={(v) => reset(() => setGroup(v))}>
          <SelectTrigger className="bg-background/60" aria-label={t("type")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_activity")}</SelectItem>
            {sortByLabel(data?.groups ?? [], groupLabel).map((g) => <SelectItem key={g} value={g}>{groupLabel(g)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={outcome} onValueChange={(v) => reset(() => setOutcome(v))}>
          <SelectTrigger className="bg-background/60" aria-label={t("outcome")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("any_outcome")}</SelectItem>
            <SelectItem value="success">{t("succeeded")}</SelectItem>
            <SelectItem value="failed">{t("failed")}</SelectItem>
            <SelectItem value="denied">{t("refused")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <NoticeSlot state={msg} />

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2.5 w-44">{t("col_when")}</th><th className="px-3 py-2.5 w-48">{t("col_who")}</th><th className="px-3 py-2.5 w-44">{t("col_activity")}</th><th className="px-3 py-2.5">{t("col_details")}</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin me-2" />{tc("loading")}</td></tr>
            ) : data && data.events.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">{t("none")}</td></tr>
            ) : data?.events.map((e) => (
              <tr key={e.id} className={cn("align-top", e.outcome !== "success" && "bg-red-500/[0.03]")}>
                <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium truncate max-w-[12rem]" title={e.actorName}>{e.actorName}</p>
                  <p className="text-xs text-muted-foreground">{e.actorType === "staff" ? t("staff") : e.actorType === "facility" ? t("owner") : e.actorType}{e.facilityName ? ` · ${e.facilityName}` : ""}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-medium">{actionLabel(e.action)}</span>
                  {e.outcome !== "success" && <Badge variant="outline" className={cn("ms-1.5 gap-1", OUTCOME_TONE[e.outcome])}>{e.outcome === "denied" && <ShieldAlert className="h-3 w-3" />}{e.outcome === "denied" ? t("refused") : t("failed")}</Badge>}
                </td>
                <td className="px-3 py-2.5">
                  <p>{e.summary}</p>
                  {e.ip && <p className="text-[11px] text-muted-foreground">IP {e.ip}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("entries", { count: data.total })}{loading && <Loader2 className="ms-2 inline h-3.5 w-3.5 animate-spin" />}</span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}><ChevronLeft className="h-4 w-4" /> {t("newer")}</Button>
            {t("page_of", { page, pages })}
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>{t("older")} <ChevronRight className="h-4 w-4" /></Button>
          </span>
        </div>
      )}
    </div>
  );
}
