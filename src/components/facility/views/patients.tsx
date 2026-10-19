"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/visit-stage-ui";
import { mizajBadge } from "@/lib/avatar";
import { formatAge, formatDateTime, daysAgo } from "@/lib/age";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadFailed } from "@/components/shared/inline-notice";
import {
  Search, Users, Loader2, UserPlus, ShieldAlert, ShieldQuestion, ArrowRight, X, Phone, CalendarClock,
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
const FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Seen today" },
  { key: "progress", label: "In progress" },
  { key: "done", label: "Handed over" },
  { key: "referred", label: "Referred" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

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

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<{ patients: PatientRow[] }>(`/api/facility/patients${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setPatients(r.patients || []);
      setLoadError(null);
    } catch (e: any) { setLoadError(e.message || "Network error"); } finally { setLoading(false); }
  };

  // Small debounce so typing a name doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search]);

  // Most recently seen first; never-visited patients last.
  const sorted = useMemo(
    () => [...patients].sort((a, b) => (b.lastVisit ? new Date(b.lastVisit).getTime() : 0) - (a.lastVisit ? new Date(a.lastVisit).getTime() : 0)),
    [patients],
  );
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, sorted.filter((p) => matches(p, f.key)).length])) as Record<FilterKey, number>,
    [sorted],
  );
  const shown = sorted.filter((p) => matches(p, filter));

  const openProfile = (p: PatientRow) =>
    router.push(p.stage ? `/facility/patients/${p.id}/record` : `/facility/patients/${p.id}`);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <h2 className="font-serif text-xl font-bold">Patients</h2>
          {!loading && !loadError && <Badge variant="outline" className="text-xs">{patients.length}</Badge>}
        </div>
        <Button onClick={() => router.push("/facility/patients/register")}>
          <UserPlus className="h-4 w-4" /> Register Patient
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-60 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile or patient code…"
            className="ps-9 pe-9 bg-background/60"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/60 p-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                filter === f.key ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {f.label}
              {!loading && <span className={cn("text-xs", filter === f.key ? "opacity-80" : "text-muted-foreground/70")}>{counts[f.key]}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline me-2" /> Loading…</div>
      ) : loadError ? (
        <LoadFailed what="patients" detail={loadError} onRetry={load} />
      ) : shown.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">
            {search ? `No patients match "${search}"` : filter === "all" ? "No patients yet" : `No patients in "${FILTERS.find((f) => f.key === filter)!.label}"`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || filter !== "all" ? "Try a different search or filter." : "Registered patients will appear here."}
          </p>
          {(search || filter !== "all") ? (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearch(""); setFilter("all"); }}>Show all patients</Button>
          ) : (
            <Button size="sm" className="mt-4" onClick={() => router.push("/facility/patients/register")}><UserPlus className="h-4 w-4" /> Register Patient</Button>
          )}
        </Card>
      ) : (
        <Card className="p-0 gap-0 border-border/50 bg-card/60 overflow-hidden divide-y divide-border/50">
          {shown.map((p) => {
            const st = p.stage ? STAGES[p.stage] : null;
            const age = formatAge(p.dob);
            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => openProfile(p)}
                onKeyDown={(e) => { if (e.key === "Enter") openProfile(p); }}
                className="group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 outline-none flex-wrap sm:flex-nowrap"
              >
                <EntityAvatar name={p.name} photo={p.photo} avatarColor={p.avatarColor} size="sm" className="h-10 w-10 text-xs" />

                {/* Who */}
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                    {p.patientCode && <span className="font-mono text-[11px] text-amber-700 dark:text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5 shrink-0">{p.patientCode}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                    {[p.gender, age !== "—" ? age : null].filter(Boolean).join(" · ")}
                    {p.phone && <><span className="text-border">·</span><Phone className="h-3 w-3" />{p.phone}</>}
                  </p>
                </div>

                {/* Flags */}
                <div className="hidden md:flex items-center gap-1.5 flex-wrap w-44">
                  {p.lastAmaDecline && !p.lastReferral && (
                    <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 text-[10px] gap-1">
                      <ShieldQuestion className="h-2.5 w-2.5" /> Declined referral
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
                        <span className="font-normal text-muted-foreground">· {p.appointmentCount} {p.appointmentCount === 1 ? "visit" : "visits"}</span>
                      </p>
                      <p className="text-muted-foreground mt-0.5 whitespace-nowrap">{formatDateTime(p.lastVisit)}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No visit yet</p>
                  )}
                </div>

                {/* Stage + next action */}
                <div className="flex items-center gap-2 sm:w-[19rem] sm:justify-end ms-auto">
                  {st ? (
                    <>
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap", st.tone)}>
                        {p.stage === "referred" ? <ShieldAlert className="h-3 w-3" /> : <span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />}
                        {st.label}
                      </span>
                      <Button
                        size="sm"
                        variant={IN_PROGRESS.includes(p.stage!) ? "default" : "outline"}
                        className="h-8 shrink-0"
                        onClick={(e) => { e.stopPropagation(); router.push(st.href(p.id)); }}
                      >
                        {st.action} <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Appointment only</span>
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
