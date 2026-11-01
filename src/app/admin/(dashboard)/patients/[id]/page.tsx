"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, ShieldCheck, ShieldOff,
  CheckCircle2, XCircle, Loader2, Ban, Undo2, HeartPulse, Cake, Users, Pill,
  Activity, FileText, Leaf, Clock, Building2, Stethoscope, Wallet, IdCard, Ruler, Scale,
  Pencil, Save, Siren, Droplet, CalendarClock, LogIn, LayoutGrid, ClipboardList, UserRound, AlertTriangle,
} from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FloatingField, FloatingSelect } from "@/components/shared/floating-field";
import { SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { mizajBadge } from "@/lib/avatar";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAge } from "@/lib/age";
import { calculateBmi, bmiBand } from "@/lib/bmi";
import { cmToFeetInches } from "@/lib/units";
import { findLatestWithField, type VisitVitals, type VisitWithVitals } from "@/lib/vitals-trend";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { VitalsPanel } from "@/components/facility/views/vitals-panel";
import { VitalsAiInsightCard } from "@/components/facility/views/vitals-ai-insight-card";
import { ScreeningCard } from "@/components/facility/views/screening-card";
import { ConsultationCard } from "@/components/facility/views/consultation-card";
import { cn } from "@/lib/utils";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";

interface PatientDetail {
  id: string; patientCode: string | null; name: string; email: string | null; phone: string | null; dob: string | null; gender: string | null;
  bloodGroup: string | null; address: string | null; emergencyContact: string | null; occupation: string | null;
  titlePrefix: string | null; maritalStatus: string | null; city: string | null; state: string | null; dobApprox: boolean;
  emergencyContactName: string | null; emergencyRelationship: string | null;
  height: string | null; weight: string | null; familyHistory: string | null; medicalHistory: string | null;
  chronicConditions: string | null; allergies: string | null; currentMedications: string | null;
  surgicalHistory: string | null; lifestyle: string | null; mizaj: string | null; photo: string | null; avatarColor: string;
  verified: boolean; active: boolean; lastLoginAt: string | null; createdAt: string; updatedAt: string;
  _count: { appointments: number; records: number; prescriptions: number; mizajAssessments: number; visits: number };
}

interface VisitRow {
  id: string; visitCode: string; status: string; reasonForVisit: string | null; visitDate: string;
  facility: { id: string; facilityName: string };
  doctor: { id: string; name: string; staffCode: string } | null;
  payments: { id: string; paymentCode: string; amount: number; mode: string; status: string }[];
  vitalSigns: VisitVitals | null;
  l1Screening: {
    id: string; chiefComplaints: string; aiSummary: string | null; updatedAt: string;
  } | null;
  clinicalAssessment: { id: string; workingDiagnosis: string | null; requiresUrgentReferral: boolean; updatedAt: string } | null;
  treatmentPlan: { id: string; referralRequired: boolean; updatedAt: string } | null;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ago = (iso: string | null) => {
  if (!iso) return "Never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 30 ? `${d} days ago` : d < 365 ? `${Math.floor(d / 30)} mo ago` : `${Math.floor(d / 365)} yr ago`;
};
const isPaid = (status: string) => status.toLowerCase() === "paid";
type Tab = "overview" | "visits" | "profile";
type ProfileForm = Record<string, string>;
const PROFILE_KEYS = ["name", "titlePrefix", "gender", "dob", "maritalStatus", "bloodGroup", "occupation", "address", "city", "state",
  "emergencyContactName", "emergencyContact", "emergencyRelationship", "height", "weight",
  "chronicConditions", "allergies", "currentMedications", "medicalHistory", "familyHistory", "surgicalHistory", "lifestyle"] as const;
const MEDICAL_TEXT: [string, string][] = [
  ["chronicConditions", "Chronic conditions"], ["allergies", "Allergies"], ["currentMedications", "Current medications"],
  ["medicalHistory", "Medical history"], ["familyHistory", "Family history"], ["surgicalHistory", "Surgical history"], ["lifestyle", "Lifestyle"],
];

function Fact({ icon: Icon, label, value, hint, className }: { icon: typeof Activity; label: string; value: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card/60 px-3 py-2.5" title={hint}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{label}</span></p>
      <div className={cn("mt-0.5 truncate text-[15px] font-bold tabular-nums", className)}>{value}</div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{value || <span className="font-normal text-muted-foreground">Not provided</span>}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, action }: { icon: typeof Activity; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>{title}</h2>
      {action}
    </div>
  );
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<ProfileForm>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [meta, setMeta] = useState<Record<string, { options: string[] }>>({});

  const load = () => {
    setLoading(true);
    adminApi.get<{ patient: PatientDetail }>(`/api/admin/patients/${id}`)
      .then((res) => setPatient(res.patient))
      .catch(() => toast.error("Could not load patient"))
      .finally(() => setLoading(false));
    adminApi.get<{ visits: VisitRow[] }>(`/api/admin/patients/${id}/visits`)
      .then((res) => setVisits(res.visits || []))
      .catch(() => {});
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { adminApi.get<{ sections: Record<string, { options: string[] }> }>("/api/admin/metadata/flat").then((r) => setMeta(r.sections)).catch(() => {}); }, []);

  const openEdit = () => {
    if (!patient) return;
    const p = patient as unknown as Record<string, string | null>;
    setForm(Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k] ?? ""])));
    setEditOpen(true);
  };
  const saveProfile = async () => {
    if (!form.name?.trim()) { toast.error("Name is required"); return; }
    setSavingProfile(true);
    try {
      await adminApi.patch(`/api/admin/patients/${id}`, { profile: form });
      toast.success("Profile saved");
      setEditOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Could not save the profile");
    } finally {
      setSavingProfile(false);
    }
  };
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleActive = async () => {
    if (!patient) return;
    setUpdating(true);
    try {
      const res = await adminApi.patch<{ patient: { active: boolean } }>(`/api/admin/patients/${id}`, { active: !patient.active });
      setPatient({ ...patient, active: res.patient.active });
      toast.success(res.patient.active ? "Patient account activated" : "Patient account suspended");
    } catch (err: any) {
      toast.error(err.message || "Could not update account status");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }
  if (!patient) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <p className="text-muted-foreground">Patient not found.</p>
      </div>
    );
  }

  const latestHeightCm = findLatestWithField(visits as VisitWithVitals[], "heightCm");
  const latestWeightKg = findLatestWithField(visits as VisitWithVitals[], "weightKg");
  const latestBmi = calculateBmi(latestHeightCm, latestWeightKg);
  const latestBmiBand = bmiBand(latestBmi);

  const clinics = [...new Map(visits.map((v) => [v.facility.id, v.facility.facilityName])).values()];
  const payments = visits.flatMap((v) => v.payments);
  const paidTotal = payments.filter((x) => isPaid(x.status)).reduce((n, x) => n + x.amount, 0);
  const lastVisit = visits[0]?.visitDate ?? null;
  const flags = [patient.allergies && { label: "Allergies", value: patient.allergies }, patient.chronicConditions && { label: "Chronic", value: patient.chronicConditions }].filter(Boolean) as { label: string; value: string }[];
  const TABS: { key: Tab; label: string; icon: typeof Activity; count?: number }[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid },
    { key: "visits", label: "Visits", icon: ClipboardList, count: visits.length },
    { key: "profile", label: "Profile & history", icon: UserRound },
  ];

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/patients" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Patients
      </Link>

      {/* Header */}
      <Card className="relative mb-5 gap-0 overflow-hidden border-border bg-card/60 p-0">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
        <div className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <EntityAvatar name={patient.name} photo={patient.photo} avatarColor={patient.avatarColor} size="lg" className="h-16 w-16 text-lg shadow-lg ring-4 ring-background" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-2xl font-bold tracking-tight">{patient.titlePrefix ? `${patient.titlePrefix} ` : ""}{patient.name}</h1>
                {patient.patientCode && (
                  <Badge className="flex items-center gap-1 border-amber-400/30 bg-amber-400/15 font-mono text-[10px] text-amber-600 dark:text-amber-400"><IdCard className="h-3 w-3" /> {patient.patientCode}</Badge>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{[patient.gender, formatAge(patient.dob) !== "—" ? formatAge(patient.dob) : null, patient.maritalStatus, [patient.city, patient.state].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ") || "Details not provided"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {patient.active ? (
                  <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="me-1 h-3 w-3" /> Active</Badge>
                ) : (
                  <Badge variant="outline" className="border-rose-500/40 bg-rose-500/5 text-rose-600 dark:text-rose-400"><ShieldOff className="me-1 h-3 w-3" /> Suspended</Badge>
                )}
                {patient.verified ? (
                  <Badge variant="outline" className="border-sky-500/40 bg-sky-500/5 text-sky-600 dark:text-sky-400"><CheckCircle2 className="me-1 h-3 w-3" /> Verified</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground"><XCircle className="me-1 h-3 w-3" /> Unverified</Badge>
                )}
                {patient.mizaj && <Badge variant="outline" className={cn("border", mizajBadge(patient.mizaj))}><Leaf className="me-1 h-3 w-3" /> {patient.mizaj}</Badge>}
                {latestBmi != null && latestBmiBand && (
                  <Badge variant="outline" className={cn("border font-medium", latestBmiBand.bg, latestBmiBand.tint)}>BMI {latestBmi.toFixed(1)} · {latestBmiBand.label}</Badge>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {patient.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{patient.phone}</span>}
                {patient.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{patient.email}</span>}
                {patient.emergencyContact && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Siren className="h-3.5 w-3.5" />{[patient.emergencyContactName, patient.emergencyContact].filter(Boolean).join(" · ")}</span>}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit profile</Button>
            <Button variant="outline" disabled={updating} className={patient.active ? "text-destructive hover:text-destructive" : "text-emerald-600 hover:text-emerald-600 dark:text-emerald-400"} onClick={toggleActive}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : patient.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
              {patient.active ? "Suspend" : "Reactivate"}
            </Button>
          </div>
        </div>

        {flags.length > 0 && (
          <div className="relative flex flex-wrap gap-2 border-t border-amber-500/20 bg-amber-500/5 px-5 py-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {flags.map((f) => <span key={f.label}><span className="font-semibold text-amber-700 dark:text-amber-400">{f.label}:</span> {f.value}</span>)}
          </div>
        )}

        {/* Key facts */}
        <div className="grid grid-cols-2 gap-2.5 border-t border-border bg-background/30 p-4 sm:grid-cols-4 xl:grid-cols-8">
          <Fact icon={Cake} label="Age" value={formatAge(patient.dob)} hint={patient.dob ? `DOB ${patient.dob}${patient.dobApprox ? " (estimated)" : ""}` : undefined} />
          <Fact icon={Leaf} label="Mizaj" value={patient.mizaj || "—"} />
          <Fact icon={Droplet} label="Blood group" value={patient.bloodGroup || "—"} className={patient.bloodGroup ? "text-red-600 dark:text-red-400" : ""} />
          <Fact icon={ClipboardList} label="Visits" value={patient._count.visits} />
          <Fact icon={Building2} label="Clinics visited" value={clinics.length} hint={clinics.join(", ")} />
          <Fact icon={Wallet} label="Paid" value={`₹${paidTotal.toLocaleString("en-IN")}`} hint={`${payments.length} payment${payments.length === 1 ? "" : "s"}`} />
          <Fact icon={CalendarClock} label="Last visit" value={ago(lastVisit)} hint={lastVisit ? formatDateTime(lastVisit) : undefined} />
          <Fact icon={LogIn} label="Last sign-in" value={<button type="button" className="hover:text-primary hover:underline" onClick={() => setHistoryOpen(true)}>{ago(patient.lastLoginAt)}</button>} hint="Click for sign-in history" />
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-5 inline-flex flex-wrap rounded-xl border border-border bg-card/60 p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors", tab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}{t.count !== undefined && <span className={cn("rounded-full px-1.5 text-xs tabular-nums", tab === t.key ? "bg-primary-foreground/20" : "bg-muted")}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            <VitalsPanel visits={visits as VisitWithVitals[]} patientId={patient.id} apiClient={adminApi} showNewVisitButton={false} patientDob={patient.dob} patientGender={patient.gender} />
            <VitalsAiInsightCard patientId={patient.id} apiClient={adminApi} insightPath={`/api/admin/patients/${patient.id}/vitals-insight`} />
            <ScreeningCard visits={visits} patientId={patient.id} apiClient={adminApi} showStartButton={false} />
            <ConsultationCard visits={visits} showStartButton={false} />
          </div>
          <div className="space-y-5">
            <Card className="gap-0 border-border bg-card/60 p-5">
              <SectionTitle icon={Activity} title="At a glance" />
              <div className="grid grid-cols-2 gap-2">
                {([["Appointments", patient._count.appointments], ["Records", patient._count.records], ["Prescriptions", patient._count.prescriptions], ["Mizaj assessments", patient._count.mizajAssessments]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold tabular-nums">{v}</p></div>
                ))}
              </div>
              <div className="mt-4 space-y-1.5 text-sm">
                {latestHeightCm != null && <p className="flex items-center gap-2"><Ruler className="h-4 w-4 text-muted-foreground" /> Qad {latestHeightCm} cm <span className="text-muted-foreground">({cmToFeetInches(latestHeightCm)})</span></p>}
                {latestWeightKg != null && <p className="flex items-center gap-2"><Scale className="h-4 w-4 text-muted-foreground" /> Wazan {latestWeightKg} kg</p>}
                <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> Registered {formatDate(patient.createdAt)}</p>
              </div>
            </Card>
            {clinics.length > 0 && (
              <Card className="gap-0 border-border bg-card/60 p-5">
                <SectionTitle icon={Building2} title="Clinics" />
                <ul className="space-y-2">
                  {clinics.map((c) => {
                    const n = visits.filter((v) => v.facility.facilityName === c).length;
                    return <li key={c} className="flex items-center justify-between gap-2 text-sm"><span className="truncate font-medium">{c}</span><span className="shrink-0 text-xs text-muted-foreground">{n} visit{n === 1 ? "" : "s"}</span></li>;
                  })}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "visits" && (
        <Card className="gap-0 overflow-hidden border-border bg-card/60 p-0">
          {visits.length === 0 ? (
            <div className="px-4 py-14 text-center"><ClipboardList className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" /><p className="text-sm text-muted-foreground">This patient has no visits at any clinic yet.</p></div>
          ) : (
            <ol className="divide-y divide-border">
              {visits.map((v) => (
                <li key={v.id} className="flex gap-4 px-5 py-4">
                  <div className="w-20 shrink-0 text-end">
                    <p className="text-sm font-semibold">{new Date(v.visitDate).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                    <p className="text-xs text-muted-foreground">{new Date(v.visitDate).getFullYear()}</p>
                  </div>
                  <span className="relative flex w-3 shrink-0 justify-center"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/15" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex items-center gap-1.5 font-semibold"><Building2 className="h-4 w-4 text-muted-foreground" /> {v.facility.facilityName}</p>
                      <span className="font-mono text-xs text-muted-foreground">{v.visitCode}</span>
                      <Badge variant="outline" className="text-[11px]">{v.status}</Badge>
                    </div>
                    {v.reasonForVisit && <p className="mt-1 text-sm text-foreground/80">{v.reasonForVisit}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {v.doctor && <Badge variant="outline" className="gap-1"><Stethoscope className="h-3 w-3" /> {v.doctor.name}</Badge>}
                      {v.vitalSigns && <Badge variant="outline" className="gap-1 border-sky-500/30 text-sky-600 dark:text-sky-400"><Activity className="h-3 w-3" /> Vitals</Badge>}
                      {v.l1Screening && <Badge variant="outline" className="gap-1 border-violet-500/30 text-violet-600 dark:text-violet-400"><FileText className="h-3 w-3" /> Screening</Badge>}
                      {v.clinicalAssessment?.workingDiagnosis && <Badge variant="outline" className="gap-1 border-primary/30 text-primary"><HeartPulse className="h-3 w-3" /> {v.clinicalAssessment.workingDiagnosis}</Badge>}
                      {(v.clinicalAssessment?.requiresUrgentReferral || v.treatmentPlan?.referralRequired) && <Badge variant="outline" className="gap-1 border-red-500/30 text-red-600 dark:text-red-400"><AlertTriangle className="h-3 w-3" /> Referral</Badge>}
                      {v.payments.map((pay) => (
                        <Badge key={pay.id} variant="outline" className={cn("gap-1", isPaid(pay.status) ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "")}><Wallet className="h-3 w-3" /> ₹{pay.amount} · {pay.mode} · {pay.status}</Badge>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {tab === "profile" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="gap-0 border-border bg-card/60 p-5">
            <SectionTitle icon={UserRound} title="Contact & personal" action={<Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>} />
            <div className="divide-y divide-border">
              <Detail icon={Phone} label="Mobile (sign-in)" value={patient.phone} />
              <Detail icon={Mail} label="Email (sign-in)" value={patient.email} />
              <Detail icon={Cake} label="Date of birth" value={patient.dob ? `${patient.dob}${patient.dobApprox ? " (estimated)" : ""}` : null} />
              <Detail icon={Users} label="Gender · Marital status" value={[patient.gender, patient.maritalStatus].filter(Boolean).join(" · ")} />
              <Detail icon={Briefcase} label="Occupation" value={patient.occupation} />
              <Detail icon={MapPin} label="Address" value={[patient.address, patient.city, patient.state].filter(Boolean).join(", ")} />
              <Detail icon={Siren} label="Emergency contact" value={[patient.emergencyContactName, patient.emergencyRelationship, patient.emergencyContact].filter(Boolean).join(" · ")} />
              <Detail icon={Clock} label="Registered · Updated" value={`${formatDate(patient.createdAt)} · ${formatDateTime(patient.updatedAt)}`} />
            </div>
          </Card>
          <Card className="gap-0 border-border bg-card/60 p-5">
            <SectionTitle icon={HeartPulse} title="Medical profile" action={<Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>} />
            <div className="divide-y divide-border">
              <Detail icon={Droplet} label="Blood group" value={patient.bloodGroup} />
              <Detail icon={Ruler} label="Height · Weight (profile)" value={[patient.height, patient.weight].filter(Boolean).join(" · ")} />
              <Detail icon={HeartPulse} label="Chronic conditions" value={patient.chronicConditions} />
              <Detail icon={AlertTriangle} label="Allergies" value={patient.allergies} />
              <Detail icon={Pill} label="Current medications" value={patient.currentMedications} />
              <Detail icon={FileText} label="Medical history" value={patient.medicalHistory} />
              <Detail icon={Users} label="Family history" value={patient.familyHistory} />
              <Detail icon={FileText} label="Surgical history" value={patient.surgicalHistory} />
              <Detail icon={Activity} label="Lifestyle" value={patient.lifestyle} />
            </div>
          </Card>
        </div>
      )}

      {/* Edit profile */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-xl"><Pencil className="h-5 w-5 text-primary" /> Edit {patient.name}</DialogTitle>
            <p className="text-sm text-muted-foreground">Sign-in mobile and email stay as they are — the patient changes those themselves with a code.</p>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <section className="space-y-4">
              <h3 className="flex items-center gap-1.5 text-[15px] font-semibold"><IdCard className="h-4 w-4 text-primary" /> Personal</h3>
              <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
                <FloatingField id="titlePrefix" label="Title" value={form.titlePrefix ?? ""} onChange={(e) => setF("titlePrefix", e.target.value)} />
                <FloatingField id="name" label="Full name" value={form.name ?? ""} onChange={(e) => setF("name", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {meta.gender ? (
                  <FloatingSelect id="gender" label="Gender" value={form.gender ?? ""} onValueChange={(v) => setF("gender", v)} placeholder="Select">
                    {meta.gender.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                ) : <FloatingField id="gender" label="Gender" value={form.gender ?? ""} onChange={(e) => setF("gender", e.target.value)} />}
                <FloatingField id="dob" type="date" label="Date of birth" value={form.dob ?? ""} onChange={(e) => setF("dob", e.target.value)} />
                {meta.marital_status ? (
                  <FloatingSelect id="maritalStatus" label="Marital status" value={form.maritalStatus ?? ""} onValueChange={(v) => setF("maritalStatus", v)} placeholder="Select">
                    {meta.marital_status.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </FloatingSelect>
                ) : <FloatingField id="maritalStatus" label="Marital status" value={form.maritalStatus ?? ""} onChange={(e) => setF("maritalStatus", e.target.value)} />}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingSelect id="bloodGroup" label="Blood group" value={form.bloodGroup ?? ""} onValueChange={(v) => setF("bloodGroup", v)} placeholder="Select">
                  {BLOOD_GROUPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </FloatingSelect>
                <FloatingField id="occupation" label="Occupation" value={form.occupation ?? ""} onChange={(e) => setF("occupation", e.target.value)} />
              </div>
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <h3 className="flex items-center gap-1.5 text-[15px] font-semibold"><MapPin className="h-4 w-4 text-primary" /> Address & emergency contact</h3>
              <FloatingField id="address" label="Address" value={form.address ?? ""} onChange={(e) => setF("address", e.target.value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingField id="city" label="City" value={form.city ?? ""} onChange={(e) => setF("city", e.target.value)} />
                <FloatingField id="state" label="State" value={form.state ?? ""} onChange={(e) => setF("state", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FloatingField id="emergencyContactName" label="Emergency contact name" value={form.emergencyContactName ?? ""} onChange={(e) => setF("emergencyContactName", e.target.value)} />
                <FloatingField id="emergencyRelationship" label="Relationship" value={form.emergencyRelationship ?? ""} onChange={(e) => setF("emergencyRelationship", e.target.value)} />
                <FloatingField id="emergencyContact" label="Emergency mobile" value={form.emergencyContact ?? ""} onChange={(e) => setF("emergencyContact", e.target.value)} />
              </div>
            </section>

            <section className="space-y-4 border-t border-border pt-5">
              <h3 className="flex items-center gap-1.5 text-[15px] font-semibold"><HeartPulse className="h-4 w-4 text-primary" /> Medical profile</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FloatingField id="height" label="Height" value={form.height ?? ""} onChange={(e) => setF("height", e.target.value)} />
                <FloatingField id="weight" label="Weight" value={form.weight ?? ""} onChange={(e) => setF("weight", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {MEDICAL_TEXT.map(([k, l]) => (
                  <label key={k} className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">{l}</span>
                    <Textarea rows={2} value={form[k] ?? ""} onChange={(e) => setF(k, e.target.value)} className="bg-background/60" />
                  </label>
                ))}
              </div>
            </section>
          </div>
          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LoginHistoryDialog
        role="patient"
        id={patient.id}
        name={patient.name}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </div>
  );
}
