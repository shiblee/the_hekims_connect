"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useStages } from "@/lib/visit-stage-ui";
import { useValueLabel } from "@/lib/i18n/use-date-locale";
import { mizajBadge } from "@/lib/avatar";
import { formatAge, formatDateTime, daysAgo } from "@/lib/age";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadFailed } from "@/components/shared/inline-notice";
import { FilterMultiSelect } from "@/components/admin/filter-multi-select";
import { sortLabels } from "@/lib/sort-options";
import {
  Search, Users, Loader2, UserPlus, ShieldAlert, ShieldQuestion, ArrowRight, X, Phone, CalendarClock,
  CalendarCheck, Activity, CheckCircle2, Send, ArrowDownUp,
} from "lucide-react";

type Stage = "waiting" | "vitals" | "mizaj" | "asbab" | "handover" | "done" | "referred";

interface PatientRow {
  id: string; patientCode: string | null; name: string; email: string | null; phone: string | null; dob: string | null; gender: string | null;
  bloodGroup: string | null; mizaj: string | null; photo: string | null; avatarColor: string; chronicConditions: string | null;
  address: string | null; appointmentCount: number; lastVisit: string | null;
  lastReferral: { urgency: string; createdAt: string } | null;
  lastAmaDecline: { createdAt: string } | null;
  stage: Stage | null;
}

const IN_PROGRESS: Stage[] = ["waiting", "vitals", "mizaj", "asbab", "handover"];
const FILTERS = [{ key: "all" }, { key: "today" }, { key: "progress" }, { key: "done" }, { key: "referred" }] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

// Look of each summary card (they double as the list filter).
const CARD: Record<FilterKey, { icon: typeof Users; tone: string; ring: string }> = {
  all: { icon: Users, tone: "bg-primary/10 text-primary", ring: "border-primary/50 ring-primary/20" },
  today: { icon: CalendarCheck, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400", ring: "border-sky-500/50 ring-sky-500/20" },
  progress: { icon: Activity, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400", ring: "border-amber-500/50 ring-amber-500/20" },
  done: { icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", ring: "border-emerald-500/50 ring-emerald-500/20" },
  referred: { icon: Send, tone: "bg-red-500/10 text-red-600 dark:text-red-400", ring: "border-red-500/50 ring-red-500/20" },
};
const SORTS = ["recent", "name", "visits"] as const;
type SortKey = (typeof SORTS)[number];
const NO_MIZAJ = "__none";

const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const matches = (p: PatientRow, f: FilterKey) =>
  f === "all" ? true
    : f === "today" ? isToday(p.lastVisit)
      : f === "progress" ? !!p.stage && IN_PROGRESS.includes(p.stage)
        : f === "done" ? p.stage === "done"
          : p.stage === "referred";

export function PatientsView() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // ?filter=today|progress|done|referred opens the list pre-filtered (dashboard drill-downs).
  const [filter, setFilter] = useState<FilterKey>(() => {
    const f = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("filter") : null;
    return FILTERS.some((x) => x.key === f) ? (f as FilterKey) : "all";
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");
  const [mizaj, setMizaj] = useState<string[]>([]);
  const [gender, setGender] = useState<string[]>([]);
  const tl = useTranslations("common.activity_log");
  const ftext = { selected: (n: number) => tl("n_selected", { count: n }), search: tl("f_search"), clear: tl("f_clear"), noMatches: tl("f_none") };
  const t = useTranslations("clinic.patients");
  const tc = useTranslations("common");
  const stageOf = useStages();
  const val = useValueLabel();

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ patients: PatientRow[] }>(`/api/facility/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setPatients(r.patients || []);
      setLoadError(null);
    } catch (e: any) { setLoadError(e.message || tc("network_error")); } finally { setLoading(false); }
  };

  // Small debounce so typing a name doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search]);

  // Mizaj / gender narrow the list first; the cards then count within it.
  const narrowed = useMemo(() => patients.filter((p) =>
    (!mizaj.length || mizaj.includes(p.mizaj || NO_MIZAJ)) && (!gender.length || gender.includes(p.gender || ""))), [patients, mizaj, gender]);
  // Recent visit: most recently seen first, never-visited patients last.
  const sorted = useMemo(() => [...narrowed].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name)
      : sort === "visits" ? b.appointmentCount - a.appointmentCount
        : (b.lastVisit ? new Date(b.lastVisit).getTime() : 0) - (a.lastVisit ? new Date(a.lastVisit).getTime() : 0)), [narrowed, sort]);
  const mizajOptions = useMemo(() => [...sortLabels([...new Set(patients.map((p) => p.mizaj).filter(Boolean) as string[])]).map((m) => [m, m] as [string, string]),
    ...(patients.some((p) => !p.mizaj) ? [[NO_MIZAJ, t("mizaj_unknown")] as [string, string]] : [])], [patients]);
  const genderOptions = useMemo(() => [...new Set(patients.map((p) => p.gender).filter(Boolean) as string[])].map((g) => [g, val(g) || g] as [string, string]), [patients]);
  const narrowing = !!(search || mizaj.length || gender.length || filter !== "all");
  const resetAll = () => { setSearch(""); setFilter("all"); setMizaj([]); setGender([]); };
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, sorted.filter((p) => matches(p, f.key)).length])) as Record<FilterKey, number>,
    [sorted],
  );
  const shown = sorted.filter((p) => matches(p, filter));

  const openProfile = (p: PatientRow) =>
    router.push(p.stage ? `/facility/patients/${p.id}/record` : `/facility/patients/${p.id}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-xl font-bold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> {t("title")}</h2>
          {!loading && !loadError && <Badge variant="outline" className="text-xs">{patients.length}</Badge>}
        </div>
        <Button onClick={() => router.push("/facility/patients/register")}>
          <UserPlus className="h-4 w-4" /> {t("register")}
        </Button>
      </div>

      {/* Summary cards — click one to filter the list */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {FILTERS.map((f) => {
          const C = CARD[f.key]; const on = filter === f.key;
          return (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={on}
              className={cn("flex items-center gap-3 rounded-xl border bg-card/60 p-3.5 text-start transition-all hover:-translate-y-0.5 hover:shadow-sm", on ? cn("ring-1", C.ring) : "border-border hover:border-primary/30")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", C.tone)}><C.icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-muted-foreground">{t(`f_${f.key}`)}</span>
                <span className="block text-xl font-bold tabular-nums">{loading ? "…" : counts[f.key]}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Search, filters, sort */}
      <div className="rounded-xl border border-border bg-card/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="h-9 ps-9 pe-9 bg-background/60" />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label={t("clear_search")} className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {mizajOptions.length > 0 && <FilterMultiSelect hideLabel label={t("mizaj")} className="w-full sm:w-44" value={mizaj} onChange={setMizaj} allLabel={t("all_mizaj")} text={ftext} options={mizajOptions} />}
          {genderOptions.length > 0 && <FilterMultiSelect hideLabel label={t("gender")} className="w-full sm:w-40" value={gender} onChange={setGender} allLabel={t("any_gender")} text={ftext} options={genderOptions} />}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/60 p-0.5" role="group" aria-label={t("sort_by")}>
            <ArrowDownUp className="mx-1.5 h-3.5 w-3.5 text-muted-foreground" />
            {SORTS.map((k) => (
              <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors", sort === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {t(`sort_${k}`)}
              </button>
            ))}
          </div>
        </div>
        {narrowing && !loading && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border pt-2.5 text-xs">
            <span className="text-muted-foreground">{t("shown_of", { shown: shown.length, total: patients.length })}</span>
            <button type="button" onClick={resetAll} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground hover:underline"><X className="h-3 w-3" /> {tl("clear_all")}</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline me-2" /> Loading…</div>
      ) : loadError ? (
        <LoadFailed what={t("loading_what")} detail={loadError} onRetry={load} />
      ) : shown.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">
            {search ? t("none_search", { search }) : filter === "all" ? t("none_yet") : t("none_filter", { filter: t(`f_${filter}`) })}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {narrowing ? t("try_other") : t("will_appear")}
          </p>
          {narrowing && (
            <Button variant="outline" size="sm" className="mt-4" onClick={resetAll}>{t("show_all")}</Button>
          )}
        </Card>
      ) : (
        <Card className="p-0 gap-0 border-border/50 bg-card/60 overflow-hidden divide-y divide-border/50">
          {shown.map((p, i) => {
            const st = p.stage ? stageOf(p.stage) : null;
            const age = formatAge(p.dob);
            const step = p.stage && IN_PROGRESS.includes(p.stage) ? IN_PROGRESS.indexOf(p.stage) + 1 : p.stage === "done" ? IN_PROGRESS.length : 0;
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => openProfile(p)}
                onKeyDown={(e) => { if (e.key === "Enter") openProfile(p); }}
                className={cn("group relative flex items-center gap-4 ps-5 pe-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 outline-none flex-wrap sm:flex-nowrap")}
              >
                {st && <span className={cn("absolute inset-y-2 start-0 w-1 rounded-e-full", st.dot)} />}
                <span className="hidden w-6 shrink-0 text-end text-xs tabular-nums text-muted-foreground sm:block">{i + 1}</span>
                <EntityAvatar name={p.name} photo={p.photo} avatarColor={p.avatarColor} size="sm" className="h-10 w-10 text-xs" />

                {/* Who */}
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                    {p.patientCode && <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5 shrink-0">{p.patientCode}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                    {[val(p.gender), age !== "—" ? age : null].filter(Boolean).join(" · ")}
                    {p.phone && <><span className="text-border">·</span><Phone className="h-3 w-3" />{p.phone}</>}
                  </p>
                </div>

                {/* Flags */}
                <div className="hidden md:flex items-center gap-1.5 flex-wrap w-44">
                  {p.lastAmaDecline && !p.lastReferral && (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] gap-1">
                      <ShieldQuestion className="h-2.5 w-2.5" /> {t("declined")}
                    </Badge>
                  )}
                  {p.mizaj && <Badge variant="outline" className={cn("border text-[10px]", mizajBadge(p.mizaj))}>{p.mizaj}</Badge>}
                  {p.bloodGroup && <Badge variant="outline" className="text-red-600 dark:text-red-300 border-red-500/30 bg-red-500/10 text-[10px]">{p.bloodGroup}</Badge>}
                </div>

                {/* Last visit */}
                <div className="hidden sm:block w-44 text-xs">
                  {p.lastVisit ? (
                    <>
                      <p className="font-medium flex items-center gap-1 whitespace-nowrap">
                        <CalendarClock className="h-3 w-3 text-muted-foreground" /> {daysAgo(p.lastVisit)}
                        <span className="font-normal text-muted-foreground">· {t("visits_n", { count: p.appointmentCount })}</span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 whitespace-nowrap">{formatDateTime(p.lastVisit)}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">{t("no_visit")}</p>
                  )}
                </div>

                {/* Stage + next action */}
                <div className="flex items-center gap-2 sm:w-[19rem] sm:justify-end ms-auto">
                  {st ? (
                    <>
                      <span className="flex flex-col items-end gap-1">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap", st.tone)}>
                          {p.stage === "referred" ? <ShieldAlert className="h-3 w-3" /> : <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />}
                          {st.label}
                        </span>
                        {p.stage !== "referred" && (
                          <span className="flex gap-0.5" role="img" aria-label={t("progress_aria", { stage: st.label })}>
                            {IN_PROGRESS.map((_, k) => <span key={k} className={cn("h-1 w-5 rounded-full", k < step ? st.dot : "bg-muted")} />)}
                          </span>
                        )}
                      </span>
                      <Button
                        size="sm"
                        variant={IN_PROGRESS.includes(p.stage!) ? "default" : "outline"}
                        className="h-8 shrink-0"
                        onClick={(e) => { e.stopPropagation(); router.push(st.href(p.id)); }}
                      >
                        {st.action} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("appointment_only")}</span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
