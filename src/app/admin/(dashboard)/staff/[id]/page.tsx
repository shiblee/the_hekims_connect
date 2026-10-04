"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Ban, Undo2, ShieldCheck, ShieldOff, Save, UserCog, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

interface StaffDetail {
  id: string; staffCode: string; name: string; photo: string | null; email: string | null; phone: string | null;
  contactVerifiedAt: string | null;
  employeeType: string; specialization: string | null; qualification: string | null;
  designation: string | null; registrationNumber: string | null; experience: number | null;
  role: string | null; responsibilities: string | null; active: boolean;
  createdAt: string; updatedAt: string;
  facility: { id: string; facilityName: string };
}

interface MetaSections {
  [key: string]: { label: string; options: string[] };
}

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<MetaSections>({});
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [employeeType, setEmployeeType] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [qualification, setQualification] = useState("");
  const [designation, setDesignation] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [experience, setExperience] = useState("");
  const [role, setRole] = useState("");
  const [responsibilities, setResponsibilities] = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    adminApi.get<{ staff: StaffDetail }>(`/api/admin/staff/${id}`)
      .then((res) => setStaff(res.staff))
      .catch(() => toast.error("Could not load staff member"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    adminApi.get<{ sections: MetaSections }>("/api/admin/metadata/flat")
      .then((res) => setMeta(res.sections))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!staff) return;
    setName(staff.name);
    setContact(staff.email || staff.phone || "");
    setEmployeeType(staff.employeeType);
    setSpecialization(staff.specialization || "");
    setQualification(staff.qualification || "");
    setDesignation(staff.designation || "");
    setRegistrationNumber(staff.registrationNumber || "");
    setExperience(staff.experience !== null ? String(staff.experience) : "");
    setRole(staff.role || "");
    setResponsibilities(parseList(staff.responsibilities));
  }, [staff]);

  const toggleActive = async () => {
    if (!staff) return;
    setUpdating(true);
    try {
      const res = await adminApi.patch<{ staff: StaffDetail }>(`/api/admin/staff/${id}`, { active: !staff.active });
      setStaff(res.staff);
      toast.success(res.staff.active ? "Staff account activated" : "Staff account deactivated");
    } catch (err: any) {
      toast.error(err.message || "Could not update account status");
    } finally {
      setUpdating(false);
    }
  };

  const savePhoto = async (dataUrl: string | null) => {
    const res = await adminApi.patch<{ staff: StaffDetail }>(`/api/admin/staff/${id}`, { photo: dataUrl });
    setStaff(res.staff);
  };

  const toggleResponsibility = (item: string) => {
    setResponsibilities((r) => r.includes(item) ? r.filter((x) => x !== item) : [...r, item]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await adminApi.patch<{ staff: StaffDetail }>(`/api/admin/staff/${id}`, {
        name, contact, employeeType, specialization, qualification, designation,
        registrationNumber, experience, role, responsibilities,
      });
      setStaff(res.staff);
      toast.success("Changes saved");
    } catch (err: any) {
      toast.error(err.message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }
  if (!staff) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <p className="text-muted-foreground">Staff member not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/staff" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Staff list
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPhotoDialogOpen(true)}
            className="group relative shrink-0 rounded-full"
            aria-label="Change staff photo"
          >
            <EntityAvatar name={staff.name} photo={staff.photo} size="lg" className="shadow-lg" />
            <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
              <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
          </button>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">{staff.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{staff.staffCode} · {staff.facility.facilityName}</p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={updating}
          className={staff.active ? "text-destructive hover:text-destructive" : "text-emerald-400 hover:text-emerald-400"}
          onClick={toggleActive}
        >
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : staff.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
          {staff.active ? "Deactivate" : "Activate"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {staff.active ? (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400"><ShieldCheck className="h-3 w-3 mr-1" /> Active</Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/40 text-destructive"><ShieldOff className="h-3 w-3 mr-1" /> Inactive</Badge>
        )}
        <Badge variant="outline"><UserCog className="h-3 w-3 mr-1" /> {staff.employeeType}</Badge>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
        <Card className="p-6 border-border/50 bg-card/60 space-y-6">
          <div>
            <h2 className="font-serif text-lg font-semibold mb-4">Personal Information</h2>
            <div className="space-y-6">
              <FloatingField id="name" label="Staff name" value={name} onChange={(e) => setName(e.target.value)} />
              <FloatingField id="contact" label="Email or phone" value={contact} onChange={(e) => setContact(e.target.value)} />
              {staff.contactVerifiedAt ? (
                <p className="flex items-center gap-1.5 text-xs text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Contact verified {formatDateTime(staff.contactVerifiedAt)}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Contact not OTP-verified (edited since, or added before verification was required)</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Registered {formatDate(staff.createdAt)}</p>
        </Card>

        <Card className="p-6 border-border/50 bg-card/60 space-y-6">
          <h2 className="font-serif text-lg font-semibold">Professional Information</h2>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
            {meta.staff_employee_type ? (
              <FloatingSelect id="employeeType" label="Employee type" value={employeeType} onValueChange={setEmployeeType}>
                {meta.staff_employee_type.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </FloatingSelect>
            ) : (
              <FloatingField id="employeeType" label="Employee type" value={employeeType} onChange={(e) => setEmployeeType(e.target.value)} />
            )}
            {meta.staff_specialization ? (
              <FloatingSelect id="specialization" label="Specialization" value={specialization} onValueChange={setSpecialization}>
                {meta.staff_specialization.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </FloatingSelect>
            ) : (
              <FloatingField id="specialization" label="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
            )}
            {meta.staff_qualification ? (
              <FloatingSelect id="qualification" label="Qualification" value={qualification} onValueChange={setQualification}>
                {meta.staff_qualification.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </FloatingSelect>
            ) : (
              <FloatingField id="qualification" label="Qualification" value={qualification} onChange={(e) => setQualification(e.target.value)} />
            )}
            {meta.staff_designation ? (
              <FloatingSelect id="designation" label="Designation" value={designation} onValueChange={setDesignation}>
                {meta.staff_designation.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </FloatingSelect>
            ) : (
              <FloatingField id="designation" label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            )}
            <FloatingField id="registrationNumber" label="Registration number" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            <FloatingField id="experience" type="number" min={0} label="Years of experience" value={experience} onChange={(e) => setExperience(e.target.value)} />
          </div>
        </Card>

        <Card className="p-6 border-border/50 bg-card/60 space-y-6 lg:col-span-2">
          <h2 className="font-serif text-lg font-semibold">Role & Responsibilities</h2>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
            {meta.staff_role ? (
              <FloatingSelect id="role" label="Role" value={role} onValueChange={setRole}>
                {meta.staff_role.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </FloatingSelect>
            ) : (
              <FloatingField id="role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
            )}
          </div>
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
                      responsibilities.includes(item) ? "bg-primary text-primary-foreground border-primary" : "border-border/60 bg-background/60 text-foreground"
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button
            className="self-start h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25 disabled:shadow-none"
            disabled={saving}
            onClick={save}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
          </Button>
        </Card>
      </div>

      <PhotoUploadDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        currentPhoto={staff.photo}
        title="Change staff photo"
        onSave={(dataUrl) => savePhoto(dataUrl)}
        onRemove={() => savePhoto(null)}
      />
    </div>
  );
}
