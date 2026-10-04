"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { useInlineContactVerify, InlineVerifyBox } from "@/components/shared/inline-contact-verify";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, UserCog, Loader2, Plus, Mail, Phone, ShieldCheck, Camera } from "lucide-react";

interface StaffRow {
  id: string;
  staffCode: string;
  name: string;
  photo: string | null;
  email: string | null;
  phone: string | null;
  contactVerifiedAt: string | null;
  employeeType: string;
  specialization: string | null;
  qualification: string | null;
  designation: string | null;
  registrationNumber: string | null;
  experience: number | null;
  role: string | null;
  responsibilities: string | null;
  active: boolean;
}

interface MetaSections {
  [key: string]: { label: string; options: string[] };
}

// Which professional fields apply to each Employee Type — keyed to the seeded
// "Employee Type" Meta options. All fields stay optional on the backend
// regardless; this is purely a UX convenience, never a hard gate.
const FIELD_VISIBILITY: Record<string, string[]> = {
  Doctor: ["specialization", "qualification", "registrationNumber", "designation", "experience"],
  Nurse: ["specialization", "qualification", "registrationNumber", "designation", "experience"],
  Counsellor: ["specialization", "qualification", "designation", "experience"],
  ANM: ["qualification", "designation", "experience"],
  ASHA: ["qualification", "designation", "experience"],
  "Data Entry Operator": ["designation", "experience"],
  Other: ["designation", "experience"],
};

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const emptyForm = {
  name: "", contact: "", employeeType: "", specialization: "", qualification: "",
  designation: "", registrationNumber: "", experience: "", role: "",
  responsibilities: [] as string[], active: true,
};

export function TeamView() {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [meta, setMeta] = useState<MetaSections>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const iv = useInlineContactVerify(api, "/api/facility/staff/otp/send", "/api/facility/staff/otp/verify");
  const editingStaff = staff.find((s) => s.id === editingId) || null;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ staff: StaffRow[] }>(`/api/facility/staff${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setStaff(res.staff || []);
    } catch (e: any) {
      toast.error(e.message || "Could not load team");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search]);
  useEffect(() => {
    api.get<{ sections: MetaSections }>("/api/facility/metadata")
      .then((res) => setMeta(res.sections))
      .catch(() => {});
  }, []);

  const visibleFields = useMemo(() => FIELD_VISIBILITY[form.employeeType] || ["qualification", "designation", "experience"], [form.employeeType]);
  const toggleResponsibility = (item: string) => {
    setForm((f) => ({
      ...f,
      responsibilities: f.responsibilities.includes(item) ? f.responsibilities.filter((x) => x !== item) : [...f.responsibilities, item],
    }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    iv.reset();
    setDialogOpen(true);
  };

  const openEdit = (s: StaffRow) => {
    setEditingId(s.id);
    setForm({
      name: s.name,
      contact: s.email || s.phone || "",
      employeeType: s.employeeType,
      specialization: s.specialization || "",
      qualification: s.qualification || "",
      designation: s.designation || "",
      registrationNumber: s.registrationNumber || "",
      experience: s.experience !== null ? String(s.experience) : "",
      role: s.role || "",
      responsibilities: parseList(s.responsibilities),
      active: s.active,
    });
    iv.reset();
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!form.contact.trim()) { toast.error("Email or phone is required"); return; }
    if (!form.employeeType) { toast.error("Employee type is required"); return; }
    if (!editingId && iv.stage !== "verified") { toast.error("Please verify the email or phone before adding this staff member"); return; }

    setSaving(true);
    try {
      const payload = {
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
        ...(editingId ? { active: form.active } : {}),
      };
      if (editingId) {
        await api.patch(`/api/facility/staff/${editingId}`, payload);
        toast.success("Staff member updated");
      } else {
        await api.post("/api/facility/staff", payload);
        toast.success("Staff member added");
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Could not save staff member");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: StaffRow) => {
    try {
      await api.patch(`/api/facility/staff/${s.id}`, { active: !s.active });
      setStaff((list) => list.map((x) => x.id === s.id ? { ...x, active: !x.active } : x));
    } catch (e: any) {
      toast.error(e.message || "Could not update status");
    }
  };

  const savePhoto = async (dataUrl: string | null) => {
    if (!editingId) return;
    const res = await api.patch<{ staff: StaffRow }>(`/api/facility/staff/${editingId}`, { photo: dataUrl });
    setStaff((list) => list.map((x) => x.id === editingId ? res.staff : x));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold">Staff</h2>
        </div>
        <Button onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, staff ID, email or phone…" className="pl-9 bg-background/60 max-w-md" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…</div>
      ) : staff.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <UserCog className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No staff added yet.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((s) => (
            <Card key={s.id} className="p-4 border-border/50 bg-card/60 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => openEdit(s)}>
              <div className="flex items-start gap-3">
                <EntityAvatar name={s.name} photo={s.photo} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.staffCode}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <Badge variant="outline">{s.employeeType}</Badge>
                    {s.role && <Badge variant="outline" className="text-muted-foreground">{s.role}</Badge>}
                  </div>
                </div>
                <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} onClick={(e) => e.stopPropagation()} />
              </div>
              <div className="mt-3 text-xs text-muted-foreground space-y-1">
                {s.email && <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" /> {s.email}</div>}
                {s.phone && <div className="flex items-center gap-1.5 truncate"><Phone className="h-3 w-3 shrink-0" /> {s.phone}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
          </DialogHeader>

          {editingId && editingStaff && (
            <button
              type="button"
              onClick={() => setPhotoDialogOpen(true)}
              className="group relative mx-auto h-20 w-20 rounded-full"
              aria-label="Change staff photo"
            >
              <EntityAvatar name={editingStaff.name} photo={editingStaff.photo} size="lg" />
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </button>
          )}

          <div className="space-y-5 py-2">
            <div className="space-y-4">
              <FloatingField id="staffName" label="Staff name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <div>
                <FloatingField
                  id="staffContact"
                  label="Email or phone"
                  value={form.contact}
                  disabled={!editingId && iv.stage === "verified"}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, contact: e.target.value }));
                    if (iv.stage !== "idle") iv.reset();
                  }}
                />
                {!editingId && (
                  iv.stage === "idle" ? (
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
                  )
                )}
                {editingId && editingStaff && (
                  editingStaff.contactVerifiedAt && form.contact === (editingStaff.email || editingStaff.phone) ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Verified {formatDateTime(editingStaff.contactVerifiedAt)}</p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Not OTP-verified — changing the contact here skips verification.</p>
                  )
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
                {visibleFields.includes("specialization") && (
                  meta.staff_specialization ? (
                    <FloatingSelect id="specialization" label="Specialization" value={form.specialization} onValueChange={(v) => setForm((f) => ({ ...f, specialization: v }))} placeholder="Select">
                      {meta.staff_specialization.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </FloatingSelect>
                  ) : null
                )}
                {visibleFields.includes("qualification") && (
                  meta.staff_qualification ? (
                    <FloatingSelect id="qualification" label="Qualification" value={form.qualification} onValueChange={(v) => setForm((f) => ({ ...f, qualification: v }))} placeholder="Select">
                      {meta.staff_qualification.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </FloatingSelect>
                  ) : null
                )}
                {visibleFields.includes("registrationNumber") && (
                  <FloatingField id="registrationNumber" label="Registration number" value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} />
                )}
                {visibleFields.includes("designation") && (
                  meta.staff_designation ? (
                    <FloatingSelect id="designation" label="Designation" value={form.designation} onValueChange={(v) => setForm((f) => ({ ...f, designation: v }))} placeholder="Select">
                      {meta.staff_designation.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </FloatingSelect>
                  ) : null
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

            {editingId && (
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3.5">
                <p className="text-sm font-medium">Active</p>
                <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || (!editingId && iv.stage !== "verified")}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {editingId ? "Save changes" : "Add staff member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingStaff && (
        <PhotoUploadDialog
          open={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          currentPhoto={editingStaff.photo}
          title="Change staff photo"
          onSave={(dataUrl) => savePhoto(dataUrl)}
          onRemove={() => savePhoto(null)}
        />
      )}
    </div>
  );
}
