"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, Ban, Undo2, ShieldCheck, ShieldOff, Save, UserCog, Camera, Building2, Mail, Phone,
  CalendarDays, LogIn, Award, Stethoscope, ClipboardList, IndianRupee, IdCard, Briefcase, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FloatingField } from "@/components/shared/floating-field";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { FloatingCombobox } from "@/components/shared/combobox";
import { useInlineContactVerify, InlineVerifyBox } from "@/components/shared/inline-contact-verify";

interface StaffDetail {
  id: string; staffCode: string; name: string; photo: string | null; email: string | null; phone: string | null;
  contactVerifiedAt: string | null;
  employeeType: string; specialization: string | null; qualification: string | null;
  designation: string | null; registrationNumber: string | null; experience: number | null;
  role: string | null; responsibilities: string | null; active: boolean;
  createdAt: string; updatedAt: string; lastLoginAt: string | null;
  facility: { id: string; facilityName: string };
  _count?: { doctorVisits: number; registeredVisits: number; recordedPayments: number };
}

const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : `${Math.floor(d / 365)} yr ago`;
};

function Fact({ icon: Icon, label, value, hint }: { icon: typeof Award; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card/60 px-3 py-2.5" title={hint}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span></p>
      <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Award; title: string }) {
  return <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>{title}</h2>;
}

interface MetaSections {
  [key: string]: { label: string; options: string[] };
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


  const iv = useInlineContactVerify(adminApi, "/api/admin/staff/otp/send", "/api/admin/staff/otp/verify", { staffId: id });
  const originalContact = staff ? staff.email || staff.phone || "" : "";
  const contactChanged = !!staff && contact.trim().toLowerCase() !== originalContact.toLowerCase();

  const save = async () => {
    if (contactChanged && iv.stage !== "verified") { toast.error("Verify the new email or phone first — send the code and enter it."); return; }
    setSaving(true);
    try {
      const res = await adminApi.patch<{ staff: StaffDetail }>(`/api/admin/staff/${id}`, {
        name, contact, employeeType, specialization, qualification, designation,
        registrationNumber, experience, role,
      });
      setStaff(res.staff);
      iv.reset();
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

      {/* Header */}
      <Card className="relative mb-5 gap-0 overflow-hidden border-border bg-card/60 p-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <button type="button" onClick={() => setPhotoDialogOpen(true)} className="group relative shrink-0 rounded-full" aria-label="Change staff photo">
              <EntityAvatar name={staff.name} photo={staff.photo} size="lg" className="shadow-lg ring-4 ring-background" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/40">
                <Camera className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold tracking-tight">{staff.name}</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                <span className="font-mono">{staff.staffCode}</span>·
                <Link href={`/admin/facilities/${staff.facility.id}/overview`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline"><Building2 className="h-3.5 w-3.5" />{staff.facility.facilityName}</Link>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {staff.active ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="me-1 h-3 w-3" /> Active</Badge>
                ) : (
                  <Badge variant="outline" className="border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400"><ShieldOff className="me-1 h-3 w-3" /> Inactive</Badge>
                )}
                {staff.contactVerifiedAt ? (
                  <Badge variant="outline" className="border-sky-500/40 bg-sky-500/5 text-sky-600 dark:text-sky-400"><ShieldCheck className="me-1 h-3 w-3" /> Contact verified</Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"><ShieldAlert className="me-1 h-3 w-3" /> Contact not verified</Badge>
                )}
                <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary"><UserCog className="me-1 h-3 w-3" /> {staff.employeeType}</Badge>
                {staff.role && <Badge variant="outline">{staff.role}</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {staff.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{staff.phone}</span>}
                {staff.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{staff.email}</span>}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            disabled={updating}
            className={staff.active ? "text-destructive hover:text-destructive" : "text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"}
            onClick={toggleActive}
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : staff.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
            {staff.active ? "Deactivate" : "Activate"}
          </Button>
        </div>

        {/* Key facts */}
        <div className="grid grid-cols-2 gap-2.5 border-t border-border bg-background/30 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Fact icon={CalendarDays} label="Joined" value={formatDate(staff.createdAt)} />
          <Fact icon={LogIn} label="Last sign-in" value={ago(staff.lastLoginAt)} hint={staff.lastLoginAt ? formatDateTime(staff.lastLoginAt) : "Has not signed in yet"} />
          <Fact icon={Award} label="Experience" value={staff.experience !== null ? `${staff.experience} yr${staff.experience === 1 ? "" : "s"}` : "—"} />
          <Fact icon={Stethoscope} label="Visits as doctor" value={staff._count?.doctorVisits ?? 0} />
          <Fact icon={ClipboardList} label="Visits registered" value={staff._count?.registeredVisits ?? 0} />
          <Fact icon={IndianRupee} label="Payments recorded" value={staff._count?.recordedPayments ?? 0} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6 border-border/50 bg-card/60 gap-6">
          <div>
            <div className="mb-5"><SectionTitle icon={IdCard} title="Personal information" /></div>
            <div className="space-y-6">
              <FloatingField id="name" label="Staff name" value={name} onChange={(e) => setName(e.target.value)} />
              <div>
                <FloatingField id="contact" label="Email or phone" value={contact} disabled={iv.stage === "verified"} onChange={(e) => { setContact(e.target.value); if (iv.stage !== "idle") iv.reset(); }} />
                {!contactChanged && staff.contactVerifiedAt ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Contact verified {formatDateTime(staff.contactVerifiedAt)}</p>
                ) : (
                  <>
                    {iv.stage === "idle" && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button type="button" onClick={() => iv.send(contact, name)} disabled={!contact.trim() || iv.sending} className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline">
                          {iv.sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Send verification code
                        </button>
                        <span className={cn("text-xs", contactChanged ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{contactChanged ? "New contact — verify it to save" : "Not verified yet (optional)"}</span>
                      </div>
                    )}
                    <InlineVerifyBox iv={iv} contact={contact} name={name} />
                  </>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-border/50 bg-card/60 gap-6">
          <SectionTitle icon={Briefcase} title="Professional information" />
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
            {meta.staff_employee_type ? (
              <FloatingCombobox id="employeeType" label="Employee type" value={employeeType} onValueChange={setEmployeeType} options={meta.staff_employee_type.options} placeholder="Select employee type" />
            ) : (
              <FloatingField id="employeeType" label="Employee type" value={employeeType} onChange={(e) => setEmployeeType(e.target.value)} />
            )}
            {meta.staff_specialization ? (
              <FloatingCombobox id="specialization" label="Specialization" value={specialization} onValueChange={setSpecialization} options={meta.staff_specialization.options} placeholder="Select specialization" />
            ) : (
              <FloatingField id="specialization" label="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
            )}
            {meta.staff_qualification ? (
              <FloatingCombobox id="qualification" label="Qualification" value={qualification} onValueChange={setQualification} options={meta.staff_qualification.options} placeholder="Select qualification" />
            ) : (
              <FloatingField id="qualification" label="Qualification" value={qualification} onChange={(e) => setQualification(e.target.value)} />
            )}
            {meta.staff_designation ? (
              <FloatingCombobox id="designation" label="Designation" value={designation} onValueChange={setDesignation} options={meta.staff_designation.options} placeholder="Select designation" />
            ) : (
              <FloatingField id="designation" label="Designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            )}
            <FloatingField id="registrationNumber" label="Registration number" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
            <FloatingField id="experience" type="number" min={0} label="Years of experience" value={experience} onChange={(e) => setExperience(e.target.value)} />
          </div>
        </Card>

        <Card className="p-6 border-border/50 bg-card/60 gap-6 lg:col-span-2">
          <SectionTitle icon={ClipboardList} title="Role" />
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-6">
            {meta.staff_role ? (
              <FloatingCombobox id="role" label="Role" value={role} onValueChange={setRole} options={meta.staff_role.options} placeholder="Select role" />
            ) : (
              <FloatingField id="role" label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Last updated {formatDateTime(staff.updatedAt)}</p>
            <Button
              className="h-11 rounded-xl px-6 font-semibold shadow-lg shadow-primary/25 disabled:shadow-none"
              disabled={saving}
              onClick={save}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
            </Button>
          </div>
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
