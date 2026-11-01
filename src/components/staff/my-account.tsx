"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Award, Briefcase, Building2, Camera, CalendarDays, GraduationCap, IdCard, KeyRound, Loader2, LogIn, Mail, Phone, Save,
  ShieldAlert, ShieldCheck, UserCog,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FloatingField } from "@/components/shared/floating-field";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";

interface Me {
  id: string; staffCode: string; name: string; photo: string | null; email: string | null; phone: string | null; contactVerifiedAt: string | null;
  employeeType: string; specialization: string | null; qualification: string | null; designation: string | null; registrationNumber: string | null;
  experience: number | null; role: string | null; lastLoginAt: string | null; createdAt: string; updatedAt: string;
  facility: { id: string; facilityName: string };
}
const FIELDS = ["name", "specialization", "qualification", "designation", "registrationNumber", "experience"] as const;
type Form = Record<(typeof FIELDS)[number], string>;
const toForm = (m: Me): Form => ({
  name: m.name, specialization: m.specialization ?? "", qualification: m.qualification ?? "", designation: m.designation ?? "",
  registrationNumber: m.registrationNumber ?? "", experience: m.experience !== null ? String(m.experience) : "",
});

function Fact({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card/60 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span></p>
      <p className="mt-0.5 truncate text-[15px] font-bold">{value}</p>
    </div>
  );
}

function Title({ icon: Icon, children }: { icon: typeof Award; children: React.ReactNode }) {
  return <h2 className="mb-4 flex items-center gap-2 font-serif text-lg font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>{children}</h2>;
}

/** A signed-in staff member's own profile, inside the clinic app. */
export function MyAccount({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const t = useTranslations("clinic.account");
  const tc = useTranslations("common");
  const tsp = useTranslations("clinic.staff_portal");
  const locale = useLocale();
  const setStaff = useAppStore((s) => s.setStaff);
  const storeStaff = useAppStore((s) => s.staff);
  const msg = useNotice();
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);

  const load = () => {
    setError(null);
    api.get<{ staff: Me }>("/api/facility/account")
      .then((r) => { setMe(r.staff); setForm(toForm(r.staff)); })
      .catch((e) => setError(e.message || tc("network_error")));
  };
  useEffect(load, []);

  // Keep the sidebar name/photo in step with what was saved.
  const remember = (m: Me) => { setMe(m); if (storeStaff) setStaff({ ...storeStaff, name: m.name, photo: m.photo }); };

  const save = async () => {
    if (!form || !me) return;
    if (!form.name.trim()) { msg.error(t("save_failed"), `${t("f_name")}?`); return; }
    setSaving(true);
    try {
      const r = await api.patch<{ staff: Me }>("/api/facility/account", form);
      remember(r.staff); setForm(toForm(r.staff));
      msg.success(t("saved"), formatDateTime(r.staff.updatedAt));
    } catch (e: any) {
      msg.error(t("save_failed"), e.message || tc("network_error"));
    } finally { setSaving(false); }
  };
  const savePhoto = async (photo: string | null) => {
    const r = await api.patch<{ staff: Me }>("/api/facility/account", { photo });
    remember(r.staff);
  };

  if (error) return <LoadFailed what={t("title")} detail={error} onRetry={load} />;
  if (!me || !form) return <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}</div>;

  const dirty = FIELDS.some((k) => form[k] !== toForm(me)[k]);
  const contact = me.phone || me.email;
  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const joined = new Date(me.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={cn("min-w-0 space-y-5", !embedded && "mx-auto max-w-5xl")}>
      {!embedded && <h1 className="font-serif text-xl font-bold sm:text-2xl">{t("title")}</h1>}
      <NoticeSlot state={msg} />

      {/* Header */}
      <Card className="relative gap-0 overflow-hidden border-border bg-card/60 p-0">
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
        <div className="relative flex flex-wrap items-center gap-4 p-5">
          <button type="button" onClick={() => setPhotoOpen(true)} className="group relative shrink-0 rounded-full" aria-label={t("change_photo")} title={t("change_photo")}>
            <EntityAvatar name={me.name} photo={me.photo} size="lg" className="shadow-lg ring-4 ring-background" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/40">
              <Camera className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
          </button>
          <div className="min-w-0">
            <p className="font-serif text-2xl font-bold tracking-tight">{me.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span className="font-mono">{me.staffCode}</span>·<span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{me.facility.facilityName}</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {me.role && <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary"><UserCog className="me-1 h-3 w-3" /> {me.role}</Badge>}
              <Badge variant="outline">{me.employeeType}</Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 border-t border-border bg-background/30 p-4 sm:grid-cols-3">
          <Fact icon={CalendarDays} label={t("joined")} value={joined} />
          <Fact icon={LogIn} label={t("last_signin")} value={me.lastLoginAt ? formatDateTime(me.lastLoginAt) : t("never")} />
          <Fact icon={Award} label={t("experience")} value={me.experience !== null ? t("years", { count: me.experience }) : "—"} />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Editable details */}
        <Card className="h-fit gap-0 border-border bg-card/60 p-5">
          <Title icon={IdCard}>{t("details")}</Title>
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><FloatingField id="me-name" label={t("f_name")} value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
            <FloatingField id="me-qualification" label={t("f_qualification")} value={form.qualification} onChange={(e) => set("qualification", e.target.value)} />
            <FloatingField id="me-specialization" label={t("f_specialization")} value={form.specialization} onChange={(e) => set("specialization", e.target.value)} />
            <FloatingField id="me-designation" label={t("f_designation")} value={form.designation} onChange={(e) => set("designation", e.target.value)} />
            <FloatingField id="me-registration" label={t("f_registration")} value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} />
            <FloatingField id="me-experience" type="number" min={0} label={t("f_experience")} value={form.experience} onChange={(e) => set("experience", e.target.value)} />
          </div>
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <Button onClick={save} disabled={saving || !dirty}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("save")}</Button>
          </div>
        </Card>

        <div className="space-y-5">
          {/* Set by the clinic owner */}
          <Card className="gap-0 border-border bg-card/60 p-5">
            <Title icon={Briefcase}>{t("work")}</Title>
            <dl className="space-y-2.5 text-sm">
              <div><dt className="text-xs text-muted-foreground">{t("clinic")}</dt><dd className="font-medium">{me.facility.facilityName}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("role")}</dt><dd className="font-medium">{me.role || "—"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">{t("employee_type")}</dt><dd className="font-medium">{me.employeeType}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{t("work_hint")}</p>
          </Card>

          <Card className="gap-0 border-border bg-card/60 p-5">
            <Title icon={KeyRound}>{t("signin")}</Title>
            <p className="text-sm text-muted-foreground">{t("signin_with")}</p>
            <p className="mt-1 flex items-center gap-1.5 font-medium">{me.phone ? <Phone className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-muted-foreground" />}{contact || "—"}</p>
            <p className={cn("mt-1 flex items-center gap-1 text-xs", me.contactVerifiedAt ? "text-primary" : "text-amber-600 dark:text-amber-400")}>
              {me.contactVerifiedAt ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}{me.contactVerifiedAt ? t("verified") : t("not_verified")}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">{t("no_password")}</p>
          </Card>

          {!embedded && <Card className="gap-0 border-border bg-card/60 p-5">
            <Title icon={GraduationCap}>{tsp("learning")}</Title>
            <p className="text-sm text-muted-foreground">{t("learning_hint")}</p>
            <Button variant="outline" className="mt-3 self-start" onClick={() => router.push("/facility/profile/learning")}>{t("open")}</Button>
          </Card>}
        </div>
      </div>

      <PhotoUploadDialog open={photoOpen} onOpenChange={setPhotoOpen} currentPhoto={me.photo} title={t("change_photo")} onSave={(d) => savePhoto(d)} onRemove={() => savePhoto(null)} />
    </div>
  );
}
