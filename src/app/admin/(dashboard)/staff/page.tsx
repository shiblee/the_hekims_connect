"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Loader2, ChevronLeft, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { useInlineContactVerify, InlineVerifyBox } from "@/components/shared/inline-contact-verify";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { cn, formatDate } from "@/lib/utils";

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
  const [status, setStatus] = useState("all");
  const [employeeType, setEmployeeType] = useState("all");
  const [facilityId, setFacilityId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaSections>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const iv = useInlineContactVerify(adminApi, "/api/admin/staff/otp/send", "/api/admin/staff/otp/verify");

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
    if (status !== "all") params.set("status", status);
    if (employeeType !== "all") params.set("employeeType", employeeType);
    if (facilityId !== "all") params.set("facilityId", facilityId);
    adminApi
      .get<{ staff: StaffRow[]; total: number; totalPages: number }>(`/api/admin/staff?${params}`)
      .then((res) => { setRows(res.staff); setTotal(res.total); setTotalPages(res.totalPages); })
      .finally(() => setLoading(false));
  };

  useEffect(loadStaff, [page, q, status, employeeType, facilityId]);

  const visibleFields = useMemo(() => FIELD_VISIBILITY[form.employeeType] || ["qualification", "designation", "experience"], [form.employeeType]);
  const toggleResponsibility = (item: string) => {
    setForm((f) => ({
      ...f,
      responsibilities: f.responsibilities.includes(item) ? f.responsibilities.filter((x) => x !== item) : [...f.responsibilities, item],
    }));
  };

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
      loadStaff();
    } catch (e: any) {
      toast.error(e.message || "Could not add staff member");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Staff ({total})</h1>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="h-10 pl-10 bg-card/60"
            placeholder="Search by name, staff ID, email, phone…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={employeeType} onValueChange={(v) => { setEmployeeType(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full sm:w-48 bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employee types</SelectItem>
            {EMPLOYEE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={facilityId} onValueChange={(v) => { setFacilityId(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full sm:w-52 bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All facilities</SelectItem>
            {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.facilityName}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full sm:w-40 bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No staff match these filters.</p>
      ) : (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Staff</th>
                  <th className="px-4 py-3 font-medium">Employee Type</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Facility</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-border/30 last:border-0 hover:bg-background/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar name={s.name} photo={s.photo} size="sm" />
                        <div>
                          <div className="font-medium whitespace-nowrap">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.staffCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline">{s.employeeType}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{s.role || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.facility.facilityName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{s.email || "—"}</div>
                      <div className="text-xs">{s.phone || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      {s.active ? (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/staff/${s.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {facilities.length > 0 ? (
              <FloatingSelect id="facilityId" label="Facility" value={form.facilityId} onValueChange={(v) => setForm((f) => ({ ...f, facilityId: v }))} placeholder="Select facility">
                {facilities.map((f) => <SelectItem key={f.id} value={f.id}>{f.facilityName}</SelectItem>)}
              </FloatingSelect>
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
                ) : (
                  <InlineVerifyBox iv={iv} contact={form.contact} name={form.name} />
                )}
              </div>
            </div>

            {meta.staff_employee_type ? (
              <FloatingSelect id="employeeType" label="Employee type" value={form.employeeType} onValueChange={(v) => setForm((f) => ({ ...f, employeeType: v }))} placeholder="Select employee type">
                {meta.staff_employee_type.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </FloatingSelect>
            ) : (
              <FloatingField id="employeeType" label="Employee type" value={form.employeeType} onChange={(e) => setForm((f) => ({ ...f, employeeType: e.target.value }))} />
            )}

            {form.employeeType && (
              <div className="grid sm:grid-cols-2 gap-4">
                {visibleFields.includes("specialization") && meta.staff_specialization && (
                  <FloatingSelect id="specialization" label="Specialization" value={form.specialization} onValueChange={(v) => setForm((f) => ({ ...f, specialization: v }))} placeholder="Select">
                    {meta.staff_specialization.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                )}
                {visibleFields.includes("qualification") && meta.staff_qualification && (
                  <FloatingSelect id="qualification" label="Qualification" value={form.qualification} onValueChange={(v) => setForm((f) => ({ ...f, qualification: v }))} placeholder="Select">
                    {meta.staff_qualification.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                )}
                {visibleFields.includes("registrationNumber") && (
                  <FloatingField id="registrationNumber" label="Registration number" value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} />
                )}
                {visibleFields.includes("designation") && meta.staff_designation && (
                  <FloatingSelect id="designation" label="Designation" value={form.designation} onValueChange={(v) => setForm((f) => ({ ...f, designation: v }))} placeholder="Select">
                    {meta.staff_designation.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                )}
                {visibleFields.includes("experience") && (
                  <FloatingField id="experience" type="number" min={0} label="Years of experience" value={form.experience} onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))} />
                )}
              </div>
            )}

            {meta.staff_role && (
              <FloatingSelect id="role" label="Role" value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))} placeholder="Select role">
                {meta.staff_role.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </FloatingSelect>
            )}

            {meta.staff_responsibility && (
              <div>
                <p className="text-sm font-semibold mb-2">Responsibilities</p>
                <div className="flex flex-wrap gap-2">
                  {meta.staff_responsibility.options.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleResponsibility(item)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                        form.responsibilities.includes(item) ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-background/60 text-foreground"
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
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
