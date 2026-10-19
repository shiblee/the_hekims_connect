"use client";

import { useEffect, useMemo, useState } from "react";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useListFormat } from "@/lib/i18n/use-date-locale";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FloatingField } from "@/components/shared/floating-field";
import { useInlineContactVerify, InlineVerifyBox } from "@/components/shared/inline-contact-verify";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { Search, UserCog, Loader2, Plus, Mail, Phone, ShieldCheck, Camera, Pencil, KeyRound } from "lucide-react";
import { OptionMultiSelect } from "@/components/shared/option-multi-select";
import { ListChecks } from "lucide-react";
import { FloatingCombobox } from "@/components/shared/combobox";

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
  lastLoginAt?: string | null;
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
  const msg = useNotice();        // page: list loading, status changes, saved confirmations
  const dialogMsg = useNotice();  // inside the add/edit dialog
  const [meta, setMeta] = useState<MetaSections>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const t = useTranslations("clinic.team");
  const tc = useTranslations("common");
  const list = useListFormat();
  const iv = useInlineContactVerify(api, "/api/facility/staff/otp/send", "/api/facility/staff/otp/verify", editingId ? { staffId: editingId } : undefined);
  const editingStaff = staff.find((s) => s.id === editingId) || null;
  // Adding always needs a verified contact; editing needs one when the contact is changed.
  const originalContact = editingStaff ? editingStaff.email || editingStaff.phone || "" : "";
  const contactChanged = !!editingId && form.contact.trim().toLowerCase() !== originalContact.toLowerCase();
  const needsVerify = !editingId || contactChanged;
  const alreadyVerified = !!editingId && !contactChanged && !!editingStaff?.contactVerifiedAt;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ staff: StaffRow[] }>(`/api/facility/staff${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setStaff(res.staff || []);
    } catch (e: any) {
      msg.error(t("load_failed"), `${e.message || tc("network_error")}.`, { retry: load });
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

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    iv.reset();
    dialogMsg.clear();
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
    dialogMsg.clear();
    setDialogOpen(true);
  };

  const save = async () => {
    const missing = [!form.name.trim() && t("f_name"), !form.contact.trim() && t("f_contact"), !form.employeeType && t("f_type")].filter(Boolean) as string[];
    if (missing.length) { dialogMsg.warning(t("fill_in", { items: list(missing) }), t("fill_in_hint")); return; }
    if (needsVerify && iv.stage !== "verified") { dialogMsg.warning(editingId ? t("verify_new") : t("verify"), editingId ? t("verify_new_hint") : t("verify_hint")); return; }

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
        msg.success(t("updated", { name: form.name.trim() }));
      } else {
        await api.post("/api/facility/staff", payload);
        msg.success(t("added", { name: form.name.trim() }));
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      dialogMsg.error(editingId ? t("not_saved") : t("not_added"), t("still_filled", { error: e.message || tc("network_error") }), { retry: save });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: StaffRow) => {
    try {
      await api.patch(`/api/facility/staff/${s.id}`, { active: !s.active });
      setStaff((list) => list.map((x) => x.id === s.id ? { ...x, active: !x.active } : x));
    } catch (e: any) {
      msg.error(t(s.active ? "not_deactivated" : "not_activated", { name: s.name }), `${e.message || tc("network_error")}.`, { retry: () => toggleActive(s) });
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
          <h2 className="font-serif text-xl font-bold">{t("title")}</h2>
        </div>
        <Button data-tour="staff.add" onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4" /> {t("add")}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} data-tour="staff.search" placeholder={t("search")} className="ps-9 bg-background/60 max-w-md" />
      </div>
      <NoticeSlot state={msg} />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline me-2" /> {tc("loading")}</div>
      ) : staff.length === 0 ? (
        <Card className="p-10 border-border/50 bg-card/60 text-center">
          <UserCog className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        </Card>
      ) : (
        <div data-tour="staff.list" className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">{t("col_staff")}</th>
                <th className="px-3 py-2.5">{t("col_type")}</th>
                <th className="px-3 py-2.5">{t("col_role")}</th>
                <th className="px-3 py-2.5">{t("col_contact")}</th>
                <th className="px-3 py-2.5">{t("col_last_login")}</th>
                <th className="px-3 py-2.5 text-center">{t("col_active")}</th>
                <th className="px-3 py-2.5 text-end">{t("col_actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((s) => (
                <tr key={s.id} className={cn("cursor-pointer transition-colors hover:bg-muted/30", !s.active && "opacity-60")} onClick={() => openEdit(s)}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <EntityAvatar name={s.name} photo={s.photo} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.staffCode}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="truncate max-w-[14rem]">{s.employeeType}</p>
                    {s.designation && <p className="text-xs text-muted-foreground">{s.designation}</p>}
                  </td>
                  <td className="px-3 py-2.5">{s.role ? <Badge variant="outline">{s.role}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {s.email && <div className="flex items-center gap-1.5 truncate max-w-[14rem]"><Mail className="h-3 w-3 shrink-0" /> {s.email}</div>}
                    {s.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /> {s.phone}</div>}
                    {s.contactVerifiedAt && <div className="flex items-center gap-1 text-primary"><ShieldCheck className="h-3 w-3" /> {t("verified")}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{s.lastLoginAt ? formatDateTime(s.lastLoginAt) : t("never")}</td>
                  <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} aria-label={t(s.active ? "deactivate" : "activate", { name: s.name })} />
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /> {tc("edit")}</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" asChild>
                        <Link href={`/facility/profile/permissions?staff=${s.id}`}><KeyRound className="h-3.5 w-3.5" /> {t("permissions")}</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("edit_title") : t("add_title")}</DialogTitle>
          </DialogHeader>

          {editingId && editingStaff && (
            <button
              type="button"
              onClick={() => setPhotoDialogOpen(true)}
              className="group relative mx-auto h-20 w-20 rounded-full"
              aria-label={t("change_photo")}
            >
              <EntityAvatar name={editingStaff.name} photo={editingStaff.photo} size="lg" />
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </button>
          )}

          <div className="space-y-5 py-2">
            <div className="space-y-4">
              <FloatingField id="staffName" label={t("staff_name")} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <div>
                <FloatingField
                  id="staffContact"
                  label={t("f_contact")}
                  value={form.contact}
                  disabled={iv.stage === "verified"}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, contact: e.target.value }));
                    if (iv.stage !== "idle") iv.reset();
                  }}
                />
                {alreadyVerified ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-primary"><ShieldCheck className="h-3.5 w-3.5" /> {t("verified_at", { date: formatDateTime(editingStaff!.contactVerifiedAt!) })}</p>
                ) : iv.stage === "idle" ? (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button
                        type="button"
                        onClick={() => iv.send(form.contact, form.name)}
                        disabled={!form.contact.trim() || iv.sending}
                        className="text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
                      >
                        {iv.sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        {t("send_code")}
                      </button>
                      {contactChanged && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{t("new_contact")}</span>}
                      {editingId && !contactChanged && <span className="text-xs text-muted-foreground">{t("not_verified")}</span>}
                    </div>
                    <InlineVerifyBox iv={iv} contact={form.contact} name={form.name} />
                  </>
                ) : (
                  <InlineVerifyBox iv={iv} contact={form.contact} name={form.name} />
                )}
              </div>
            </div>

            {meta.staff_employee_type ? (
              <FloatingCombobox id="employeeType" label={t("f_type")} value={form.employeeType} onValueChange={(v) => setForm((f) => ({ ...f, employeeType: v }))} options={meta.staff_employee_type.options} placeholder={t("select_type")} />
            ) : (
              <FloatingField id="employeeType" label={t("f_type")} value={form.employeeType} onChange={(e) => setForm((f) => ({ ...f, employeeType: e.target.value }))} />
            )}

            {form.employeeType && (
              <div className="grid sm:grid-cols-2 gap-4">
                {visibleFields.includes("specialization") && (
                  meta.staff_specialization ? (
                    <FloatingCombobox id="specialization" label={t("specialization")} value={form.specialization} onValueChange={(v) => setForm((f) => ({ ...f, specialization: v }))} options={meta.staff_specialization.options} placeholder={t("select_specialization")} />
                  ) : null
                )}
                {visibleFields.includes("qualification") && (
                  meta.staff_qualification ? (
                    <FloatingCombobox id="qualification" label={t("qualification")} value={form.qualification} onValueChange={(v) => setForm((f) => ({ ...f, qualification: v }))} options={meta.staff_qualification.options} placeholder={t("select_qualification")} />
                  ) : null
                )}
                {visibleFields.includes("registrationNumber") && (
                  <FloatingField id="registrationNumber" label={t("registration_number")} value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} />
                )}
                {visibleFields.includes("designation") && (
                  meta.staff_designation ? (
                    <FloatingCombobox id="designation" label={t("designation")} value={form.designation} onValueChange={(v) => setForm((f) => ({ ...f, designation: v }))} options={meta.staff_designation.options} placeholder={t("select_designation")} />
                  ) : null
                )}
                {visibleFields.includes("experience") && (
                  <FloatingField id="experience" type="number" min={0} label={t("experience")} value={form.experience} onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))} />
                )}
              </div>
            )}

            {meta.staff_role && (
              <FloatingCombobox id="role" label={t("role")} value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))} options={meta.staff_role.options} placeholder={t("select_role")} />
            )}

            {meta.staff_responsibility && (
              <OptionMultiSelect id="responsibilities" label={t("responsibilities")} icon={ListChecks} options={meta.staff_responsibility.options} value={form.responsibilities} onChange={(v) => setForm((f) => ({ ...f, responsibilities: v }))} />
            )}

            {editingId && (
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3.5">
                <p className="text-sm font-medium">{t("active")}</p>
                <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              </div>
            )}
          </div>

          <NoticeSlot state={dialogMsg} />
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={save} disabled={saving || (needsVerify && iv.stage !== "verified")}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {editingId ? tc("save_changes") : t("add_member")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editingStaff && (
        <PhotoUploadDialog
          open={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          currentPhoto={editingStaff.photo}
          title={t("change_photo")}
          onSave={(dataUrl) => savePhoto(dataUrl)}
          onRemove={() => savePhoto(null)}
        />
      )}
    </div>
  );
}
