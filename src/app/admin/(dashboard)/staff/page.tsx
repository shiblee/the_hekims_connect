"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Loader2, ChevronLeft, ChevronRight, Plus, ShieldCheck, UserCog, UserCheck, UserX, Users, Building2, Mail, Phone, X } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FloatingField } from "@/components/shared/floating-field";
import { useInlineContactVerify, InlineVerifyBox } from "@/components/shared/inline-contact-verify";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { cn, formatDate } from "@/lib/utils";
import { sortLabels } from "@/lib/sort-options";
import { OptionMultiSelect } from "@/components/shared/option-multi-select";
import { ListChecks } from "lucide-react";
import { FloatingCombobox } from "@/components/shared/combobox";
import { FilterMultiSelect } from "@/components/admin/filter-multi-select";

interface StaffRow {
  id: string; staffCode: string; name: string; photo: string | null; email: string | null; phone: string | null;
  employeeType: string; role: string | null; active: boolean; createdAt: string;
  facility: { id: string; facilityName: string };
}

interface FacilityOption { id: string; facilityName: string }

interface MetaSections {
  [key: string]: { label: string; options: string[] };
}

const EMPLOYEE_TYPES = ["Doctor", "Nurse", "Counsellor", "ANM", "ASHA", "Data Entry Operator", "Other"];

// Mirrors the facility-side Team Management visibility rules (src/components/facility/views/team.tsx).
const FIELD_VISIBILITY: Record<string, string[]> = {
  Doctor: ["specialization", "qualification", "registrationNumber", "designation", "experience"],
  Nurse: ["specialization", "qualification", "registrationNumber", "designation", "experience"],
  Counsellor: ["specialization", "qualification", "designation", "experience"],
  ANM: ["qualification", "designation", "experience"],
  ASHA: ["qualification", "designation", "experience"],
  "Data Entry Operator": ["designation", "experience"],
  Other: ["designation", "experience"],
};

const emptyForm = {
  facilityId: "", name: "", contact: "", employeeType: "", specialization: "", qualification: "",
  designation: "", registrationNumber: "", experience: "", role: "",
  responsibilities: [] as string[],
};

export default function StaffListPage() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [employeeType, setEmployeeType] = useState<string[]>([]);
  const [facilityId, setFacilityId] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaSections>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const iv = useInlineContactVerify(adminApi, "/api/admin/staff/otp/send", "/api/admin/staff/otp/verify");
  const router = useRouter();
  const [counts, setCounts] = useState<{ all: number; active: number; inactive: number } | null>(null);

  useEffect(() => {
    adminApi.get<{ facilities: FacilityOption[] }>("/api/admin/facilities?pageSize=50")
      .then((res) => setFacilities(res.facilities))
      .catch(() => {});
    adminApi.get<{ sections: MetaSections }>("/api/admin/metadata/flat")
      .then((res) => setMeta(res.sections))
      .catch(() => {});
  }, []);

  const loadStaff = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (q) params.set("q", q);
    if (status.length) params.set("status", status.join(","));
    if (employeeType.length) params.set("employeeType", employeeType.join(","));
    if (facilityId.length) params.set("facilityId", facilityId.join(","));
    adminApi
      .get<{ staff: StaffRow[]; total: number; totalPages: number }>(`/api/admin/staff?${params}`)
      .then((res) => { setRows(res.staff); setTotal(res.total); setTotalPages(res.totalPages); })
      .finally(() => setLoading(false));
  };

  useEffect(loadStaff, [page, q, status, employeeType, facilityId]);

  // Headline figures for the whole platform (unfiltered).
  const loadCounts = () => {
    const total = (qs: string) => adminApi.get<{ total: number }>(`/api/admin/staff?pageSize=1${qs}`).then((r) => r.total);
    Promise.all([total(""), total("&status=active"), total("&status=inactive")])
      .then(([all, active, inactive]) => setCounts({ all, active, inactive }))
      .catch(() => {});
  };
  useEffect(loadCounts, []);
  const filtersOn = !!(q || status.length || employeeType.length || facilityId.length);
  const clearAll = () => { setQ(""); setStatus([]); setEmployeeType([]); setFacilityId([]); setPage(1); };

  const visibleFields = useMemo(() => FIELD_VISIBILITY[form.employeeType] || ["qualification", "designation", "experience"], [form.employeeType]);

  const openAdd = () => {
    setForm(emptyForm);
    iv.reset();
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.facilityId) { toast.error("Facility is required"); return; }
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.contact.trim()) { toast.error("Email or phone is required"); return; }
    if (!form.employeeType) { toast.error("Employee type is required"); return; }
    if (iv.stage !== "verified") { toast.error("Please verify the email or phone before adding this staff member"); return; }

    setSaving(true);
    try {
      await adminApi.post("/api/admin/staff", {
        facilityId: form.facilityId,
        name: form.name,
        contact: form.contact,
        employeeType: form.employeeType,
        specialization: form.specialization,
        qualification: form.qualification,
        designation: form.designation,
        registrationNumber: form.registrationNumber,
        experience: form.experience,
        role: form.role,
        responsibilities: form.responsibilities,
      });
      toast.success("Staff member added");
      setDialogOpen(false);
      loadStaff(); loadCounts();
    } catch (e: any) {
      toast.error(e.message || "Could not add staff member");
    } finally {
      setSaving(false);
    }
  };

  const kpis = [
    { label: "Total staff", value: counts?.all, icon: Users, tone: "primary", on: !status.length, apply: () => setStatus([]) },
    { label: "Active", value: counts?.active, icon: UserCheck, tone: "good", on: status.length === 1 && status[0] === "active", apply: () => setStatus(["active"]) },
    { label: "Inactive", value: counts?.inactive, icon: UserX, tone: "bad", on: status.length === 1 && status[0] === "inactive", apply: () => setStatus(["inactive"]) },
  ] as const;
  const TONE = { primary: "bg-primary/10 text-primary", good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bad: "bg-rose-500/10 text-rose-600 dark:text-rose-400" };
  const from = total ? (page - 1) * 10 + 1 : 0, to = Math.min(page * 10, total);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl"><UserCog className="h-6 w-6 text-primary" /> Staff</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      {/* Headline figures */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <button key={k.label} type="button" onClick={() => { k.apply(); setPage(1); }}
            className={cn("flex items-center gap-3 rounded-xl border bg-card/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm", k.on ? "border-primary/50 ring-1 ring-primary/20" : "border-border")}>
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", TONE[k.tone])}><k.icon className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-muted-foreground">{k.label}</span>
              <span className="block text-2xl font-bold tabular-nums">{k.value ?? "…"}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <Card className="mb-4 gap-3 border-border bg-card/60 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-10 bg-background/60 pl-10" placeholder="Search by name, staff ID, email, phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <FilterMultiSelect hideLabel label="Facility" className="w-full lg:w-56 [&_button]:h-10" value={facilityId} onChange={(v) => { setFacilityId(v); setPage(1); }} allLabel="All facilities" options={facilities.map((f) => [f.id, f.facilityName] as [string, string])} />
          <FilterMultiSelect hideLabel label="Employee type" className="w-full lg:w-52 [&_button]:h-10" value={employeeType} onChange={(v) => { setEmployeeType(v); setPage(1); }} allLabel="All employee types" options={sortLabels(EMPLOYEE_TYPES).map((t) => [t, t] as [string, string])} />
          <FilterMultiSelect hideLabel label="Status" className="w-full lg:w-44 [&_button]:h-10" value={status} onChange={(v) => { setStatus(v); setPage(1); }} allLabel="All statuses" options={[["active", "Active"], ["inactive", "Inactive"]]} />
        </div>
        {filtersOn && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">{total} of {counts?.all ?? "…"} shown</span>
            <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground hover:underline"><X className="h-3 w-3" /> Clear all</button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border-border bg-card/60 p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="w-14 whitespace-nowrap px-3 py-2.5 text-right">S.No</th>
                <th className="whitespace-nowrap px-3 py-2.5">Facility</th>
                <th className="whitespace-nowrap px-3 py-2.5">Staff</th>
                <th className="whitespace-nowrap px-3 py-2.5">Employee type</th>
                <th className="whitespace-nowrap px-3 py-2.5">Role</th>
                <th className="whitespace-nowrap px-3 py-2.5">Contact</th>
                <th className="whitespace-nowrap px-3 py-2.5">Status</th>
                <th className="w-8 px-1 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-14"><div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading staff…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-14 text-center">
                  <p className="font-medium">No staff match these filters</p>
                  {filtersOn && <button type="button" onClick={clearAll} className="mt-1 text-sm text-primary hover:underline">Clear all filters</button>}
                </td></tr>
              ) : rows.map((s, i) => (
                <tr key={s.id} onClick={() => router.push(`/admin/staff/${s.id}`)} className={cn("cursor-pointer transition-colors hover:bg-primary/[0.03]", !s.active && "opacity-70")}>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{(page - 1) * 10 + i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-4 w-4" /></span>
                      <span className="max-w-[14rem] truncate font-medium" title={s.facility.facilityName}>{s.facility.facilityName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <EntityAvatar name={s.name} photo={s.photo} size="sm" />
                      <div className="min-w-0">
                        <div className="whitespace-nowrap font-semibold">{s.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{s.staffCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><Badge variant="outline" className="whitespace-nowrap border-primary/25 bg-primary/5 text-primary">{s.employeeType}</Badge></td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{s.role || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {s.phone && <div className="flex items-center gap-1.5 whitespace-nowrap"><Phone className="h-3.5 w-3.5 shrink-0" />{s.phone}</div>}
                    {s.email && <div className="flex items-center gap-1.5 whitespace-nowrap"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="max-w-[16rem] truncate">{s.email}</span></div>}
                    {!s.phone && !s.email && "—"}
                  </td>
                  <td className="px-3 py-3">
                    {s.active ? (
                      <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-1 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">{total ? `${from}–${to} of ${total}` : "0 staff"}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /> Prev</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {facilities.length > 0 ? (
              <FloatingCombobox id="facilityId" label="Facility" value={form.facilityId} onValueChange={(v) => setForm((f) => ({ ...f, facilityId: v }))} options={facilities.map((f) => ({ value: f.id, label: f.facilityName }))} placeholder="Select facility" />
            ) : null}

            <div className="space-y-4">
              <FloatingField id="staffName" label="Staff name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <div>
                <FloatingField
                  id="staffContact"
                  label="Email or phone"
                  value={form.contact}
                  disabled={iv.stage === "verified"}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, contact: e.target.value }));
                    if (iv.stage !== "idle") iv.reset();
                  }}
                />
                {iv.stage === "idle" ? (
                  <button
                    type="button"
                    onClick={() => iv.send(form.contact, form.name)}
                    disabled={!form.contact.trim() || iv.sending}
                    className="mt-2 text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
                  >
                    {iv.sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    Send verification code
                  </button>
                ) : null}
                <InlineVerifyBox iv={iv} contact={form.contact} name={form.name} />
              </div>
            </div>

            {meta.staff_employee_type ? (
              <FloatingCombobox id="employeeType" label="Employee type" value={form.employeeType} onValueChange={(v) => setForm((f) => ({ ...f, employeeType: v }))} options={meta.staff_employee_type.options} placeholder="Select employee type" />
            ) : (
              <FloatingField id="employeeType" label="Employee type" value={form.employeeType} onChange={(e) => setForm((f) => ({ ...f, employeeType: e.target.value }))} />
            )}

            {form.employeeType && (
              <div className="grid sm:grid-cols-2 gap-4">
                {visibleFields.includes("specialization") && meta.staff_specialization && (
                  <FloatingCombobox id="specialization" label="Specialization" value={form.specialization} onValueChange={(v) => setForm((f) => ({ ...f, specialization: v }))} options={meta.staff_specialization.options} placeholder="Select specialization" />
                )}
                {visibleFields.includes("qualification") && meta.staff_qualification && (
                  <FloatingCombobox id="qualification" label="Qualification" value={form.qualification} onValueChange={(v) => setForm((f) => ({ ...f, qualification: v }))} options={meta.staff_qualification.options} placeholder="Select qualification" />
                )}
                {visibleFields.includes("registrationNumber") && (
                  <FloatingField id="registrationNumber" label="Registration number" value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} />
                )}
                {visibleFields.includes("designation") && meta.staff_designation && (
                  <FloatingCombobox id="designation" label="Designation" value={form.designation} onValueChange={(v) => setForm((f) => ({ ...f, designation: v }))} options={meta.staff_designation.options} placeholder="Select designation" />
                )}
                {visibleFields.includes("experience") && (
                  <FloatingField id="experience" type="number" min={0} label="Years of experience" value={form.experience} onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))} />
                )}
              </div>
            )}

            {meta.staff_role && (
              <FloatingCombobox id="role" label="Role" value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))} options={meta.staff_role.options} placeholder="Select role" />
            )}

            {meta.staff_responsibility && (
              <OptionMultiSelect id="responsibilities" label="Responsibilities" icon={ListChecks} options={meta.staff_responsibility.options} value={form.responsibilities} onChange={(v) => setForm((f) => ({ ...f, responsibilities: v }))} />
            )}
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || iv.stage !== "verified"}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add staff member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
