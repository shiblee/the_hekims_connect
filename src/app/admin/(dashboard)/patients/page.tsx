"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search, Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, UserPlus, HeartPulse, ShieldCheck, ShieldOff,
  UserCheck, Sparkles, LogIn, Building2, IdCard, Phone, Mail, MapPin, Siren, X, CircleAlert, CalendarClock, ArrowDownUp,
} from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FloatingField, FloatingSelect, FloatingSplitField, FieldError } from "@/components/shared/floating-field";
import { FloatingCombobox } from "@/components/shared/combobox";
import { estimateDobFromAgeValue, formatAge, type AgeUnit } from "@/lib/age";
import { mizajBadge } from "@/lib/avatar";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";
import { FilterMultiSelect } from "@/components/admin/filter-multi-select";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

interface PatientRow {
  id: string; patientCode: string | null; name: string; email: string | null; phone: string | null; gender: string | null; dob: string | null;
  bloodGroup: string | null; mizaj: string | null; photo: string | null; avatarColor: string; city: string | null; state: string | null;
  verified: boolean; active: boolean; lastLoginAt: string | null; createdAt: string;
  facilityName: string | null; facilityId: string | null; lastVisitAt: string | null; visitCount: number;
}
interface Summary {
  all: number; active: number; suspended: number; verified: number; unverified: number; new30: number; signedIn30: number;
  genders: { value: string; count: number }[]; mizaj: { value: string; count: number }[];
}
interface FacilityOption { id: string; facilityName: string }
interface MetaSections { [key: string]: { label: string; options: string[] } }

const PAGE_SIZE = 10;
const emptyForm = {
  facilityId: "", titlePrefix: "", name: "", relationship: "Self", gender: "",
  approxAge: "", ageUnit: "Years", maritalStatus: "", phone: "",
  emergencyContact: "", emergencyContactName: "", address: "", cityState: "",
};
const DAY = 86_400_000;
const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / DAY);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : `${Math.floor(d / 365)} yr ago`;
};
const SORTS: [string, string][] = [["newest", "Newest"], ["name", "Name A–Z"], ["login", "Last sign-in"], ["oldest", "Oldest"]];

/** Numbered section heading inside the Add Patient dialog. */
function FormStep({ n, icon: Icon, title, children }: { n: number; icon: typeof IdCard; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold"><Icon className="h-4 w-4 text-primary" /> {title}</h3>
      </div>
      <div className="space-y-4 ps-[2.375rem]">{children}</div>
    </section>
  );
}

export default function PatientListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [verified, setVerified] = useState<string[]>([]);
  const [gender, setGender] = useState<string[]>([]);
  const [mizaj, setMizaj] = useState<string[]>([]);
  const [facilityId, setFacilityId] = useState<string[]>([]);
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [meta, setMeta] = useState<MetaSections>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort });
    if (q) params.set("q", q);
    if (status.length) params.set("status", status.join(","));
    if (verified.length) params.set("verified", verified.join(","));
    if (gender.length) params.set("gender", gender.join(","));
    if (mizaj.length) params.set("mizaj", mizaj.join(","));
    if (facilityId.length) params.set("facilityId", facilityId.join(","));
    adminApi
      .get<{ patients: PatientRow[]; total: number; totalPages: number }>(`/api/admin/patients?${params}`)
      .then((res) => { setRows(res.patients); setTotal(res.total); setTotalPages(Math.max(1, res.totalPages)); })
      .finally(() => setLoading(false));
  };
  useEffect(load, [page, q, status, verified, gender, mizaj, facilityId, sort]);

  const loadSummary = () => {
    adminApi.get<{ summary: Summary }>("/api/admin/patients?pageSize=1&summary=1").then((r) => setSummary(r.summary)).catch(() => {});
  };
  useEffect(() => {
    loadSummary();
    adminApi.get<{ facilities: FacilityOption[] }>("/api/admin/facilities?pageSize=50").then((res) => setFacilities(res.facilities)).catch(() => {});
    adminApi.get<{ sections: MetaSections }>("/api/admin/metadata/flat").then((res) => setMeta(res.sections)).catch(() => {});
  }, []);

  const filtersOn = !!(q || status.length || verified.length || gender.length || mizaj.length || facilityId.length);
  const clearAll = () => { setQ(""); setStatus([]); setVerified([]); setGender([]); setMizaj([]); setFacilityId([]); setPage(1); };
  const only = (setter: (v: string[]) => void, v: string[]) => { setStatus([]); setVerified([]); setter(v); setPage(1); };

  const openAdd = () => { setForm(emptyForm); setFieldErrors({}); setDialogOpen(true); };
  const missing = [!form.facilityId && "facility", !form.name.trim() && "name", !form.phone.trim() && "mobile number"].filter(Boolean) as string[];

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!form.facilityId) errs.facilityId = "Facility is required";
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.phone.trim()) errs.phone = "Mobile number is required";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const finalDob = form.approxAge ? estimateDobFromAgeValue(parseFloat(form.approxAge), form.ageUnit.toLowerCase() as AgeUnit) : null;
      const [city, state] = form.cityState.split(",").map((s) => s.trim());
      await adminApi.post("/api/admin/patients", {
        facilityId: form.facilityId,
        name: form.name, titlePrefix: form.titlePrefix,
        registrationFor: form.relationship, relationship: form.relationship !== "Self" ? form.relationship : null,
        gender: form.gender, dob: finalDob, dobApprox: true,
        maritalStatus: form.maritalStatus, phone: form.phone,
        emergencyContact: form.emergencyContact, emergencyContactName: form.emergencyContactName,
        address: form.address, state: state || null, city: city || null,
      });
      toast.success("Patient added");
      setDialogOpen(false);
      load(); loadSummary();
    } catch (e: any) {
      toast.error(e.message || "Could not add patient");
    } finally {
      setSaving(false);
    }
  };

  const s = summary;
  const kpis = [
    { label: "Total patients", value: s?.all, icon: HeartPulse, tone: "bg-primary/10 text-primary", on: !status.length && !verified.length, apply: () => only(setStatus, []) },
    { label: "Active", value: s?.active, icon: ShieldCheck, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", on: status.length === 1 && status[0] === "active", apply: () => only(setStatus, ["active"]) },
    { label: "Suspended", value: s?.suspended, icon: ShieldOff, tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400", on: status.length === 1 && status[0] === "inactive", apply: () => only(setStatus, ["inactive"]) },
    { label: "Verified", value: s?.verified, icon: UserCheck, tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400", on: verified.length === 1 && verified[0] === "true", apply: () => only(setVerified, ["true"]) },
  ];
  const facts = [
    { label: "New · 30 days", value: s?.new30, icon: Sparkles, tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
    { label: "Signed in · 30 days", value: s?.signedIn30, icon: LogIn, tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  ];
  const mizajOptions = (s?.mizaj ?? []).map((m) => [m.value, m.value === "__none" ? "Not assessed" : m.value] as [string, string])
    .sort((a, b) => (a[0] === "__none" ? 1 : b[0] === "__none" ? -1 : a[1].localeCompare(b[1])));
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0, to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl"><HeartPulse className="h-6 w-6 text-primary" /> Patients</h1>
        <Button onClick={openAdd}><UserPlus className="h-4 w-4" /> Add Patient</Button>
      </div>

      {/* Headline figures */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <button key={k.label} type="button" onClick={k.apply}
            className={cn("flex items-center gap-3 rounded-xl border bg-card/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm", k.on ? "border-primary/50 ring-1 ring-primary/20" : "border-border")}>
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", k.tone)}><k.icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-muted-foreground">{k.label}</span>
              <span className="block text-2xl font-bold tabular-nums">{k.value ?? "…"}</span>
            </span>
          </button>
        ))}
        {facts.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", k.tone)}><k.icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-muted-foreground">{k.label}</span>
              <span className="block text-2xl font-bold tabular-nums">{k.value ?? "…"}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Mizaj mix — click to filter */}
      {!!s?.mizaj.length && (
        <div className="mb-6 flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-xs font-medium text-muted-foreground">Mizaj mix</span>
          {mizajOptions.map(([v, l]) => {
            const on = mizaj.includes(v); const n = s.mizaj.find((m) => m.value === v)?.count ?? 0;
            return (
              <button key={v} type="button" aria-pressed={on} onClick={() => { setMizaj((x) => (x.includes(v) ? x.filter((y) => y !== v) : [...x, v])); setPage(1); }}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors", on ? "border-primary bg-primary text-primary-foreground" : cn("bg-card/60 hover:border-primary/40", v === "__none" ? "border-border" : mizajBadge(v)))}>
                {l}<span className={cn("rounded-full px-1.5 tabular-nums", on ? "bg-primary-foreground/20" : "bg-background/70")}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + filters */}
      <Card className="mb-4 gap-3 border-border bg-card/60 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 bg-background/60 pl-10" placeholder="Search by name, email, phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:flex">
            <FilterMultiSelect hideLabel label="Facility" className="xl:w-48 [&_button]:h-10" value={facilityId} onChange={(v) => { setFacilityId(v); setPage(1); }} allLabel="All facilities" options={facilities.map((f) => [f.id, f.facilityName] as [string, string])} />
            <FilterMultiSelect hideLabel label="Gender" className="xl:w-36 [&_button]:h-10" value={gender} onChange={(v) => { setGender(v); setPage(1); }} allLabel="Any gender" options={(s?.genders ?? []).map((g) => [g.value, g.value] as [string, string])} />
            <FilterMultiSelect hideLabel label="Mizaj" className="xl:w-40 [&_button]:h-10" value={mizaj} onChange={(v) => { setMizaj(v); setPage(1); }} allLabel="All Mizaj" options={mizajOptions} />
            <FilterMultiSelect hideLabel label="Status" className="xl:w-36 [&_button]:h-10" value={status} onChange={(v) => { setStatus(v); setPage(1); }} allLabel="All statuses" options={[["active", "Active"], ["inactive", "Suspended"]]} />
            <FilterMultiSelect hideLabel label="Verification" className="xl:w-40 [&_button]:h-10" value={verified} onChange={(v) => { setVerified(v); setPage(1); }} allLabel="All verification" options={[["true", "Verified"], ["false", "Unverified"]]} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{total} of {s?.all ?? "…"} shown</span>
            {filtersOn && <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground hover:underline"><X className="h-3 w-3" /> Clear all</button>}
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background/60 p-0.5" role="group" aria-label="Sort">
            <ArrowDownUp className="mx-1.5 h-3.5 w-3.5 text-muted-foreground" />
            {SORTS.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => { setSort(k); setPage(1); }}
                className={cn("rounded-md px-2.5 py-1 font-medium whitespace-nowrap transition-colors", sort === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border-border bg-card/60 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-14 whitespace-nowrap px-3 py-2.5 text-right">S.No</th>
                <th className="whitespace-nowrap px-3 py-2.5">Patient</th>
                <th className="whitespace-nowrap px-3 py-2.5">Facility</th>
                <th className="whitespace-nowrap px-3 py-2.5">Gender · Age</th>
                <th className="whitespace-nowrap px-3 py-2.5">Mizaj · Blood</th>
                <th className="whitespace-nowrap px-3 py-2.5">Contact</th>
                <th className="whitespace-nowrap px-3 py-2.5">Visits</th>
                <th className="whitespace-nowrap px-3 py-2.5">Last sign-in</th>
                <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                <th className="w-8 px-1 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-14"><div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading patients…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-14 text-center">
                  <p className="font-medium">No patients match these filters</p>
                  {filtersOn && <button type="button" onClick={clearAll} className="mt-1 text-sm text-primary hover:underline">Clear all filters</button>}
                </td></tr>
              ) : rows.map((p, i) => (
                <tr key={p.id} onClick={() => router.push(`/admin/patients/${p.id}`)} className={cn("cursor-pointer transition-colors hover:bg-primary/[0.03]", !p.active && "opacity-70")}>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <EntityAvatar name={p.name} photo={p.photo} avatarColor={p.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <div className="whitespace-nowrap font-semibold">{p.name}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {p.patientCode && <span className="rounded bg-amber-400/10 px-1.5 font-mono text-[11px] text-amber-700 dark:text-amber-400">{p.patientCode}</span>}
                          <span>Joined {formatDate(p.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {p.facilityName ? (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /><span className="max-w-[12rem] truncate">{p.facilityName}</span></span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{[p.gender, p.dob ? formatAge(p.dob) : null].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.mizaj ? <Badge variant="outline" className={cn("border text-[11px]", mizajBadge(p.mizaj))}>{p.mizaj}</Badge> : <span className="text-xs text-muted-foreground">Not assessed</span>}
                      {p.bloodGroup && <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-[11px] text-red-600 dark:text-red-300">{p.bloodGroup}</Badge>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {p.phone && <div className="flex items-center gap-1.5 whitespace-nowrap"><Phone className="h-3.5 w-3.5 shrink-0" />{p.phone}</div>}
                    {p.email && <div className="flex items-center gap-1.5 whitespace-nowrap"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="max-w-[14rem] truncate">{p.email}</span></div>}
                    {!p.phone && !p.email && "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{p.visitCount}</span>
                    {p.lastVisitAt && <span className="ms-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3 w-3" />{ago(p.lastVisitAt)}</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <button type="button" title={p.lastLoginAt ? formatDateTime(p.lastLoginAt) : "Sign-in history"} onClick={(e) => { e.stopPropagation(); setHistoryTarget({ id: p.id, name: p.name }); }}
                      className={cn("hover:text-primary hover:underline", !p.lastLoginAt && "text-muted-foreground")}>{ago(p.lastLoginAt)}</button>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.active ? (
                        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400">Suspended</Badge>
                      )}
                      {p.verified ? (
                        <Badge variant="outline" className="border-sky-500/40 bg-sky-500/5 text-sky-600 dark:text-sky-400"><CheckCircle2 className="me-1 h-3 w-3" />Verified</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground"><XCircle className="me-1 h-3 w-3" />Unverified</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">{total ? `${from}–${to} of ${total}` : "0 patients"}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((x) => x - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((x) => x + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      {historyTarget && (
        <LoginHistoryDialog role="patient" id={historyTarget.id} name={historyTarget.name} open={!!historyTarget} onOpenChange={(o) => { if (!o) setHistoryTarget(null); }} />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-xl"><UserPlus className="h-5 w-5 text-primary" /> Add patient</DialogTitle>
            <p className="text-sm text-muted-foreground">The patient is registered at the clinic you choose and appears in that clinic&apos;s list.</p>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <FormStep n={1} icon={Building2} title="Which clinic are they registering at?">
              <div>
                <FloatingCombobox id="facilityId" label="Facility" value={form.facilityId} onValueChange={(v) => setForm((f) => ({ ...f, facilityId: v }))} options={facilities.map((f) => ({ value: f.id, label: f.facilityName }))} placeholder="Select facility" />
                <FieldError message={fieldErrors.facilityId} />
              </div>
            </FormStep>

            <FormStep n={2} icon={IdCard} title="Who is the patient?">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FloatingField id="name" label="Patient name" autoComplete="off" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={!!fieldErrors.name} />
                  <FieldError message={fieldErrors.name} />
                </div>
                {meta.relationship && (
                  <FloatingCombobox id="relationship" label="Registering for" value={form.relationship} onValueChange={(v) => setForm((f) => ({ ...f, relationship: v }))} options={meta.relationship.options} placeholder="Search relationship…" />
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {meta.gender && (
                  <FloatingSelect id="gender" label="Gender" value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))} placeholder="Select">
                    {meta.gender.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                )}
                <FloatingSplitField label="Age" inputId="approxAge" type="number" step="any" min="0" value={form.approxAge} onChange={(e) => setForm((f) => ({ ...f, approxAge: e.target.value }))}
                  selectPosition="right" selectWidthClassName="w-24" selectValue={form.ageUnit} onSelectChange={(v) => setForm((f) => ({ ...f, ageUnit: v }))} selectOptions={["Years", "Months", "Days"]} />
                {meta.marital_status && (
                  <FloatingSelect id="maritalStatus" label="Marital status" value={form.maritalStatus} onValueChange={(v) => setForm((f) => ({ ...f, maritalStatus: v }))} placeholder="Select">
                    {meta.marital_status.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                )}
              </div>
            </FormStep>

            <FormStep n={3} icon={MapPin} title="How do we reach them?">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FloatingField id="phone" label="Mobile number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} error={!!fieldErrors.phone} />
                  <FieldError message={fieldErrors.phone} />
                </div>
                <FloatingField id="cityState" label="City, State" value={form.cityState} onChange={(e) => setForm((f) => ({ ...f, cityState: e.target.value }))} />
              </div>
              <FloatingField id="address" label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </FormStep>

            <FormStep n={4} icon={Siren} title="Emergency contact (optional)">
              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingField id="emergencyContactName" label="Name" value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} />
                <FloatingField id="emergencyContact" label="Mobile number" value={form.emergencyContact} onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))} />
              </div>
            </FormStep>
          </div>

          <DialogFooter className="flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={cn("flex items-center gap-1.5 text-xs", missing.length ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
              {missing.length ? <><CircleAlert className="h-3.5 w-3.5 shrink-0" /> Still needed: {missing.join(", ")}</> : <><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Ready to add</>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || missing.length > 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add patient
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
