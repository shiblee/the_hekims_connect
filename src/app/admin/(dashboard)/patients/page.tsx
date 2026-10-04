"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Loader2, ChevronLeft, ChevronRight, CheckCircle2, XCircle, UserPlus } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FloatingField, FloatingSelect, FloatingSplitField, FieldError } from "@/components/shared/floating-field";
import { FloatingCombobox } from "@/components/shared/combobox";
import { estimateDobFromAgeValue, type AgeUnit } from "@/lib/age";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";

interface PatientRow {
  id: string; name: string; email: string | null; phone: string | null; gender: string | null; dob: string | null;
  bloodGroup: string | null; mizaj: string | null; photo: string | null; avatarColor: string;
  verified: boolean; active: boolean; lastLoginAt: string | null; createdAt: string;
  facilityName: string | null;
}

interface FacilityOption { id: string; facilityName: string }

interface MetaSections {
  [key: string]: { label: string; options: string[] };
}

const emptyForm = {
  facilityId: "", titlePrefix: "", name: "", relationship: "Self", gender: "",
  approxAge: "", ageUnit: "Years", maritalStatus: "", phone: "", email: "",
  emergencyContact: "", emergencyContactName: "", address: "", cityState: "",
};

export default function PatientListPage() {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [verified, setVerified] = useState("all");
  const [loading, setLoading] = useState(true);
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [meta, setMeta] = useState<MetaSections>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    if (verified !== "all") params.set("verified", verified);
    adminApi
      .get<{ patients: PatientRow[]; total: number; totalPages: number }>(`/api/admin/patients?${params}`)
      .then((res) => { setRows(res.patients); setTotal(res.total); setTotalPages(res.totalPages); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [page, q, status, verified]);

  useEffect(() => {
    adminApi.get<{ facilities: FacilityOption[] }>("/api/admin/facilities?pageSize=50")
      .then((res) => setFacilities(res.facilities))
      .catch(() => {});
    adminApi.get<{ sections: MetaSections }>("/api/admin/metadata/flat")
      .then((res) => setMeta(res.sections))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setFieldErrors({});
    setDialogOpen(true);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!form.facilityId) errs.facilityId = "Facility is required";
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.phone.trim()) errs.phone = "Mobile number is required";
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      if (errs.facilityId) toast.error(errs.facilityId);
      return;
    }

    setSaving(true);
    try {
      const finalDob = form.approxAge ? estimateDobFromAgeValue(parseFloat(form.approxAge), form.ageUnit.toLowerCase() as AgeUnit) : null;
      const [city, state] = form.cityState.split(",").map((s) => s.trim());
      await adminApi.post("/api/admin/patients", {
        facilityId: form.facilityId,
        name: form.name, titlePrefix: form.titlePrefix,
        registrationFor: form.relationship, relationship: form.relationship !== "Self" ? form.relationship : null,
        gender: form.gender, dob: finalDob, dobApprox: true,
        maritalStatus: form.maritalStatus, phone: form.phone, email: form.email,
        emergencyContact: form.emergencyContact, emergencyContactName: form.emergencyContactName,
        address: form.address, state: state || null, city: city || null,
      });
      toast.success("Patient added");
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not add patient");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Patient ({total})</h1>
        <Button onClick={openAdd}>
          <UserPlus className="h-4 w-4" /> Add Patient
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="h-10 pl-10 bg-card/60"
            placeholder="Search by name, email, phone…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full sm:w-40 bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={verified} onValueChange={(v) => { setVerified(v); setPage(1); }}>
          <SelectTrigger className="h-10 w-full sm:w-44 bg-card/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verification</SelectItem>
            <SelectItem value="true">Verified</SelectItem>
            <SelectItem value="false">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No patients match these filters.</p>
      ) : (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Facility</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Gender / DOB</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-border/30 last:border-0 hover:bg-background/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.facilityName || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <EntityAvatar name={p.name} photo={p.photo} avatarColor={p.avatarColor} size="sm" />
                        <span className="font-medium whitespace-nowrap">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>{p.email || "—"}</div>
                      <div className="text-xs">{p.phone || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.gender || "—"} {p.dob ? `· ${p.dob}` : ""}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      <button
                        type="button"
                        className="hover:text-primary hover:underline transition-colors"
                        onClick={() => setHistoryTarget({ id: p.id, name: p.name })}
                      >
                        {p.lastLoginAt ? new Date(p.lastLoginAt).toLocaleString() : "Never"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.verified ? (
                          <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Unverified</Badge>
                        )}
                        {p.active ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="border-destructive/40 text-destructive">Suspended</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/patients/${p.id}`}>View</Link>
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

      {historyTarget && (
        <LoginHistoryDialog
          role="patient"
          id={historyTarget.id}
          name={historyTarget.name}
          open={!!historyTarget}
          onOpenChange={(o) => { if (!o) setHistoryTarget(null); }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <FloatingSelect
              id="facilityId"
              label="Facility"
              value={form.facilityId}
              onValueChange={(v) => setForm((f) => ({ ...f, facilityId: v }))}
              placeholder="Select facility"
              error={!!fieldErrors.facilityId}
            >
              {facilities.map((fac) => <SelectItem key={fac.id} value={fac.id}>{fac.facilityName}</SelectItem>)}
            </FloatingSelect>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <FloatingSplitField
                  label="Patient Name"
                  inputId="name"
                  selectValue={form.titlePrefix}
                  onSelectChange={(v) => setForm((f) => ({ ...f, titlePrefix: v }))}
                  selectOptions={meta.patient_title?.options || []}
                  selectPlaceholder="Title"
                  autoComplete="off"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={!!fieldErrors.name}
                />
                <FieldError message={fieldErrors.name} />
              </div>
              {meta.relationship && (
                <FloatingCombobox
                  id="relationship"
                  label="Relationship to Patient"
                  value={form.relationship}
                  onValueChange={(v) => setForm((f) => ({ ...f, relationship: v }))}
                  options={meta.relationship.options}
                  placeholder="Search relationship…"
                />
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {meta.gender && (
                <FloatingSelect id="gender" label="Gender" value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))} placeholder="Select">
                  {meta.gender.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </FloatingSelect>
              )}
              {meta.marital_status && (
                <FloatingSelect id="maritalStatus" label="Marital Status" value={form.maritalStatus} onValueChange={(v) => setForm((f) => ({ ...f, maritalStatus: v }))} placeholder="Select">
                  {meta.marital_status.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </FloatingSelect>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FloatingSplitField
                label="Age"
                inputId="approxAge"
                type="number"
                step="any"
                min="0"
                value={form.approxAge}
                onChange={(e) => setForm((f) => ({ ...f, approxAge: e.target.value }))}
                selectPosition="right"
                selectWidthClassName="w-28"
                selectValue={form.ageUnit}
                onSelectChange={(v) => setForm((f) => ({ ...f, ageUnit: v }))}
                selectOptions={["Years", "Months", "Days"]}
              />
              <div>
                <FloatingField id="phone" label="Mobile number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} error={!!fieldErrors.phone} />
                <FieldError message={fieldErrors.phone} />
              </div>
            </div>

            <FloatingField id="email" label="Email (optional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />

            <div className="grid sm:grid-cols-2 gap-4">
              <FloatingField id="address" label="Address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              {meta.city && (
                <FloatingCombobox
                  id="cityState"
                  label="City"
                  value={form.cityState}
                  onValueChange={(v) => setForm((f) => ({ ...f, cityState: v }))}
                  options={meta.city.options}
                  placeholder="Search city…"
                />
              )}
            </div>

            <Card className="p-4 gap-2 border-border/50 bg-card/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency Contact</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <FloatingField id="emergencyContactName" label="Name" value={form.emergencyContactName} onChange={(e) => setForm((f) => ({ ...f, emergencyContactName: e.target.value }))} />
                <FloatingField id="emergencyContact" label="Mobile number" value={form.emergencyContact} onChange={(e) => setForm((f) => ({ ...f, emergencyContact: e.target.value }))} />
              </div>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add Patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
