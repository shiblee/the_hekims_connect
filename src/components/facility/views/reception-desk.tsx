"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatAge } from "@/lib/age";
import { useUrlParam } from "@/hooks/use-url-param";
import { useAppStore } from "@/lib/store";
import { useDateLocale, useValueLabel } from "@/lib/i18n/use-date-locale";
import { canOpenPage } from "@/lib/staff-permissions";
import { STAGES, useStages } from "@/lib/visit-stage-ui";
import type { VisitStage } from "@/lib/visit-stage";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PaymentDialog } from "@/components/facility/payments/payment-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, IndianRupee, Loader2, Phone, Receipt, Search, UserPlus } from "lucide-react";

interface Row {
  visitId: string; visitCode: string; at: string; isNew: boolean; stage: VisitStage; registeredBy: string; doctor: string | null;
  patient: { id: string; patientCode: string | null; name: string; gender: string | null; dob: string | null; phone: string | null; photo: string | null };
  payment: { count: number; amount: number; lastId: string | null; lastCode: string | null } | null;
}
interface Resp { date: string; today: string; tab: "visits" | "registrations"; strip: { date: string; visits: number; registrations: number }[]; total: number; page: number; pageSize: number; rows: Row[]; staff: { id: string; name: string }[]; payments: boolean }

const tz = () => -new Date().getTimezoneOffset();
const addDays = (ymd: string, n: number) => { const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayLabel = (ymd: string, opts: Intl.DateTimeFormatOptions, locale?: string) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC", ...opts });
/** 98•••••620 — the full number is on the patient's record. */
const maskPhone = (p: string | null) => (p && p.length > 5 ? `${p.slice(0, 2)}${"•".repeat(p.length - 5)}${p.slice(-3)}` : p ?? "—");

/** Reception desk: seven-day strip, then one day's visits or new registrations. */
export function ReceptionDesk() {
  const router = useRouter();
  const perms = useAppStore((s) => (s.staff && s.permissions !== null ? s.permissions : null));
  const [date, setDate] = useUrlParam<string>("date", "");
  const [tab, setTab] = useUrlParam<"visits" | "registrations">("tab", "visits", ["visits", "registrations"]);
  const [end, setEnd] = useState<string>("");
  const [q, setQ] = useState(""); const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [staff, setStaff] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<Row | null>(null);
  const [notice, setNotice] = useState<{ code: string; id: string } | null>(null);
  const canCollect = !perms || perms.includes("payments");
  const t = useTranslations("clinic.reception");
  const tc = useTranslations("common");
  const stageOf = useStages();
  const dl = useDateLocale();
  const val = useValueLabel();

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ tz: String(tz()), tab, page: String(page) });
    if (date) p.set("date", date);
    if (end) p.set("end", end); else if (date) p.set("end", date);
    if (query) p.set("q", query);
    if (stage !== "all") p.set("stage", stage);
    if (staff !== "all") p.set("staff", staff);
    try { setData(await api.get<Resp>(`/api/facility/reception/list?${p}`)); setError(""); }
    catch (e: any) { setError(e.message || tc("network_error")); }
    finally { setLoading(false); }
  }, [date, end, tab, query, stage, staff, page]);
  useEffect(() => { load(); }, [load]);

  const selected = data?.date ?? date;
  const stripEnd = data?.strip.at(-1)?.date ?? end;
  const pick = (d: string) => { setDate(d === data?.today ? "" : d); setPage(1); };
  const shiftWeek = (n: number) => {
    if (!data) return;
    const e = addDays(stripEnd, n * 7);
    const capped = e > data.today ? data.today : e;
    setEnd(capped); pick(capped);
  };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const dayTotals = data?.strip.find((s) => s.date === selected);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t("title")}</h1>
        </div>
        {canOpenPage(perms, "/facility/patients/register") && (
          <Button data-tour="reception.register" onClick={() => router.push("/facility/patients/register")}><UserPlus className="h-4 w-4" /> {t("register_new")}</Button>
        )}
      </div>

      {/* Seven-day strip */}
      <Card data-tour="reception.week" className="flex-row items-stretch gap-2 border-border/50 bg-card/60 p-2">
        <Button variant="ghost" size="icon" className="h-auto shrink-0" onClick={() => shiftWeek(-1)} aria-label={t("prev_week")}><ChevronLeft className="h-5 w-5 rtl:rotate-180" /></Button>
        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {(data?.strip ?? []).map((d) => {
            const on = d.date === selected;
            const isToday = d.date === data?.today;
            return (
              <button key={d.date} type="button" onClick={() => pick(d.date)} aria-pressed={on}
                className={cn("rounded-lg border px-1 py-2 text-center transition-colors", on ? "border-primary bg-primary text-primary-foreground" : "border-border/60 bg-background/60 hover:border-primary/50")}>
                <span className={cn("block text-[11px] uppercase tracking-wide", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{isToday ? t("today") : dayLabel(d.date, { weekday: "short" }, dl)}</span>
                <span className="block font-serif text-lg font-bold leading-tight">{dayLabel(d.date, { day: "numeric" }, dl)}</span>
                <span className={cn("block text-[10px]", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{dayLabel(d.date, { month: "short" }, dl)}</span>
                <span className={cn("mt-1 block text-[11px] font-medium tabular-nums", on ? "" : d.visits ? "text-foreground" : "text-muted-foreground/60")}>
                  {t("day_visits", { count: d.visits })}{d.registrations ? ` · ${t("day_new", { count: d.registrations })}` : ""}
                </span>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="icon" className="h-auto shrink-0" onClick={() => shiftWeek(1)} disabled={!data || stripEnd >= data.today} aria-label={t("next_week")}><ChevronRight className="h-5 w-5 rtl:rotate-180" /></Button>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div data-tour="reception.tabs" className="inline-flex rounded-lg border border-border bg-background/60 p-0.5">
            {([["visits", t("tab_visits"), dayTotals?.visits], ["registrations", t("tab_registrations"), dayTotals?.registrations]] as const).map(([k, l, n]) => (
              <button key={k} type="button" onClick={() => { setTab(k); setPage(1); }} className={cn("rounded-md px-3 py-1.5 text-sm transition-colors", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                {l}{n !== undefined && <span className="ms-1.5 tabular-nums opacity-80">{n}</span>}
              </button>
            ))}
          </div>
          {selected && data && selected !== data.today && <Button size="sm" variant="ghost" onClick={() => { setEnd(""); pick(data.today); }}><CalendarDays className="h-4 w-4" /> {t("back_today")}</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <form data-tour="reception.search" className="relative" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}>
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => { if (q.trim() !== query) { setQuery(q.trim()); setPage(1); } }} placeholder={t("search")} className="w-64 bg-background/60 ps-9" />
          </form>
          <Select value={stage} onValueChange={(v) => { setStage(v); setPage(1); }}>
            <SelectTrigger className="w-44 bg-background/60" aria-label={t("stage")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("any_stage")}</SelectItem>
              <SelectItem value="progress">{t("in_progress")}</SelectItem>
              {(Object.keys(STAGES) as VisitStage[]).map((k) => <SelectItem key={k} value={k}>{stageOf(k).label}</SelectItem>)}
            </SelectContent>
          </Select>
          {data && data.staff.length > 0 && (
            <Select value={staff} onValueChange={(v) => { setStaff(v); setPage(1); }}>
              <SelectTrigger className="w-44 bg-background/60" aria-label={t("registered_by")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("anyone")}</SelectItem>
                <SelectItem value="owner">{t("owner")}</SelectItem>
                {data.staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {tab === "visits" ? t("hint_visits") : t("hint_registrations")}
      </p>

      {notice && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          {t("paid_notice", { code: notice.code })}
          <button type="button" className="font-medium underline" onClick={() => router.push(`/facility/payments/${notice.id}/receipt`)}>{t("open_receipt")}</button>
          <button type="button" className="ms-auto text-xs opacity-70 hover:opacity-100" onClick={() => setNotice(null)}>{tc("dismiss")}</button>
        </p>
      )}
      {paying && (
        <PaymentDialog open={!!paying} onOpenChange={(o) => { if (!o) setPaying(null); }} visitId={paying.visitId}
          patientLabel={t("patient_label", { name: paying.patient.name, code: paying.patient.patientCode ?? "", visit: paying.visitCode })}
          onRecorded={(p) => { setNotice({ code: p.paymentCode, id: p.id }); load(); }} />
      )}
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{t("list_failed", { error })} <button className="underline" onClick={load}>{tc("retry")}</button></p>}

      <div data-tour="reception.list" className="overflow-x-auto rounded-xl border border-border bg-card/60">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">{t("col_time")}</th><th className="px-3 py-2.5">{t("col_patient")}</th><th className="px-3 py-2.5">{t("col_contact")}</th>
              <th className="px-3 py-2.5">{t("col_type")}</th><th className="px-3 py-2.5">{t("stage")}</th><th className="px-3 py-2.5">{t("registered_by")}</th>
              {data?.payments && <th className="px-3 py-2.5">{t("col_payment")}</th>}
              <th className="px-3 py-2.5 text-end">{t("col_action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground"><Loader2 className="me-2 inline h-4 w-4 animate-spin" />{tc("loading")}</td></tr>
            ) : data && data.rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                {query || stage !== "all" || staff !== "all" ? t("none_filtered") : tab === "visits" ? t("none_visits") : t("none_registrations")}
              </td></tr>
            ) : data?.rows.map((r) => {
              const st = stageOf(r.stage);
              return (
                <tr key={r.visitId} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => router.push(`/facility/patients/${r.patient.id}`)}>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                    {new Date(r.at).toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" })}
                    <span className="block text-[11px] text-muted-foreground">{r.visitCode}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <EntityAvatar name={r.patient.name} photo={r.patient.photo} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.patient.name}</p>
                        <p className="text-xs text-muted-foreground">{r.patient.patientCode ?? "—"} · {val(r.patient.gender) || "—"} · {formatAge(r.patient.dob)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground"><Phone className="me-1 inline h-3 w-3" />{maskPhone(r.patient.phone)}</td>
                  <td className="px-3 py-2.5">{r.isNew ? <Badge className="bg-primary/15 text-primary hover:bg-primary/15">{t("type_new")}</Badge> : <Badge variant="outline">{t("type_returning")}</Badge>}</td>
                  <td className="px-3 py-2.5"><span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", st.tone)}><span className={cn("h-1.5 w-1.5 rounded-full", st.dot)} />{st.label}</span></td>
                  <td className="px-3 py-2.5 text-xs">{r.registeredBy}{r.doctor && <span className="block text-muted-foreground">{t("hakim", { name: r.doctor })}</span>}</td>
                  {data.payments && (
                    <td className="px-3 py-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                      {r.payment && r.payment.count > 0 ? (
                        <span className="flex flex-col items-start gap-0.5">
                          <span className="font-medium text-emerald-700 dark:text-emerald-400">{t("paid", { amount: r.payment.amount.toLocaleString("en-IN") })}</span>
                          {r.payment.lastId && <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => router.push(`/facility/payments/${r.payment!.lastId}/receipt`)}><Receipt className="h-3 w-3" /> {r.payment.lastCode}</button>}
                        </span>
                      ) : canCollect ? (
                        <Button size="sm" variant="outline" className="h-7 border-amber-500/40 px-2 text-amber-700 dark:text-amber-400" onClick={() => setPaying(r)}><IndianRupee className="h-3 w-3" /> {t("collect")}</Button>
                      ) : <span className="text-amber-700 dark:text-amber-400">{t("not_paid")}</span>}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-end" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant={r.stage === "done" || r.stage === "referred" ? "outline" : "default"} onClick={() => router.push(st.href(r.patient.id))}>
                      {st.action} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("total_patients", { count: data.total })}{loading && <Loader2 className="ms-2 inline h-3.5 w-3.5 animate-spin" />}</span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t("previous")}</Button>
            {t("page_of", { page, pages })}
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((x) => x + 1)}>{t("next")} <ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
          </span>
        </div>
      )}
    </div>
  );
}
