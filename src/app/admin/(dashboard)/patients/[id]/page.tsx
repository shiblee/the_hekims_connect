"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, ShieldCheck, ShieldOff,
  CheckCircle2, XCircle, Loader2, Ban, Undo2, HeartPulse, Cake, Users, Pill,
  Activity, FileText, Leaf, Clock, Building2, Stethoscope, Wallet, IdCard, Ruler, Scale,
} from "lucide-react";
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
import { ScreeningCard } from "@/components/facility/views/screening-card";
import { ConsultationCard } from "@/components/facility/views/consultation-card";
import { cn } from "@/lib/utils";
import { LoginHistoryDialog } from "@/components/admin/login-history-dialog";

interface PatientDetail {
  id: string; patientCode: string | null; name: string; email: string | null; phone: string | null; dob: string | null; gender: string | null;
  bloodGroup: string | null; address: string | null; emergencyContact: string | null; occupation: string | null;
  height: string | null; weight: string | null; familyHistory: string | null; medicalHistory: string | null;
  chronicConditions: string | null; allergies: string | null; currentMedications: string | null;
  surgicalHistory: string | null; lifestyle: string | null; mizaj: string | null; photo: string | null; avatarColor: string;
  verified: boolean; active: boolean; lastLoginAt: string | null; createdAt: string; updatedAt: string;
  _count: { appointments: number; records: number; prescriptions: number; mizajAssessments: number };
}

interface VisitRow {
  id: string; visitCode: string; status: string; reasonForVisit: string | null; visitDate: string;
  facility: { id: string; facilityName: string };
  doctor: { id: string; name: string; staffCode: string } | null;
  payments: { id: string; paymentCode: string; amount: number; mode: string; status: string }[];
  vitalSigns: VisitVitals | null;
  l1Screening: {
    id: string; chiefComplaints: string; overallFlag: string | null; aiSummary: string | null; updatedAt: string;
    answers?: { flagTriggered: string | null }[];
  } | null;
  clinicalAssessment: { id: string; workingDiagnosis: string | null; requiresUrgentReferral: boolean; updatedAt: string } | null;
  treatmentPlan: { id: string; careClassification: string; referralRequired: boolean; updatedAt: string } | null;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4 border-border/50 bg-card/60">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function InfoRow({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground shrink-0" /> {children}</div>;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <Link href="/admin/patients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Patient list
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 min-w-0">
          <EntityAvatar name={patient.name} photo={patient.photo} avatarColor={patient.avatarColor} size="lg" className="h-16 w-16 text-lg shadow-lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-2xl font-bold tracking-tight">{patient.name}</h1>
              {patient.patientCode && (
                <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-[10px] flex items-center gap-1">
                  <IdCard className="h-3 w-3" /> {patient.patientCode}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{patient.gender || "—"}</span>
              <span className="text-border">·</span>
              <span>{formatAge(patient.dob)}</span>
              {patient.mizaj && (<><span className="text-border">·</span><span>{patient.mizaj} Mizaj</span></>)}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={updating}
          className={patient.active ? "text-destructive hover:text-destructive" : "text-emerald-400 hover:text-emerald-400"}
          onClick={toggleActive}
        >
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : patient.active ? <Ban className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
          {patient.active ? "Suspend account" : "Reactivate account"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {patient.verified ? (
          <Badge className="bg-primary/15 text-primary border-primary/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Verified</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Unverified</Badge>
        )}
        {patient.active ? (
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400"><ShieldCheck className="h-3 w-3 mr-1" /> Active</Badge>
        ) : (
          <Badge variant="outline" className="border-destructive/40 text-destructive"><ShieldOff className="h-3 w-3 mr-1" /> Suspended</Badge>
        )}
        {latestHeightCm != null && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 bg-muted/60 rounded-full px-2 py-0.5">
            <Ruler className="h-3 w-3 text-muted-foreground" /> Qad: {latestHeightCm} cm <span className="text-muted-foreground font-normal">({cmToFeetInches(latestHeightCm)})</span>
          </span>
        )}
        {latestWeightKg != null && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 bg-muted/60 rounded-full px-2 py-0.5">
            <Scale className="h-3 w-3 text-muted-foreground" /> Wazan: {latestWeightKg} kg
          </span>
        )}
        {latestBmi != null && latestBmiBand && (
          <Badge variant="outline" className={cn("border text-[11px] font-medium", latestBmiBand.bg, latestBmiBand.tint)}>
            BMI {latestBmi.toFixed(1)} · {latestBmiBand.label}
          </Badge>
        )}
      </div>

      <div className="mb-6 max-w-4xl">
        <VitalsPanel
          visits={visits as VisitWithVitals[]}
          patientId={patient.id}
          apiClient={adminApi}
          insightPath={`/api/admin/patients/${patient.id}/vitals-insight`}
          showNewVisitButton={false}
        />
      </div>

      <div className="mb-8 max-w-4xl">
        <ScreeningCard visits={visits} patientId={patient.id} apiClient={adminApi} showStartButton={false} />
      </div>

      <div className="mb-8 max-w-4xl">
        <ConsultationCard visits={visits} showStartButton={false} />
      </div>

      <Card className="p-6 border-border/50 bg-card/60 mb-8 max-w-4xl">
        <h2 className="font-serif text-lg font-semibold mb-4 flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Facilities & Visits</h2>
        {visits.length === 0 ? (
          <p className="text-sm text-muted-foreground">This patient has no visits at any facility yet.</p>
        ) : (
          <div className="space-y-2.5">
            {visits.map((v) => (
              <div key={v.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {v.facility.facilityName}
                  </p>
                  <span className="text-xs text-muted-foreground">{new Date(v.visitDate).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span>{v.visitCode}</span>
                  {v.doctor && <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {v.doctor.name}</span>}
                  <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
                  {v.vitalSigns && <Badge variant="outline" className="text-[10px] flex items-center gap-1"><Activity className="h-2.5 w-2.5" /> Vitals recorded</Badge>}
                </p>
                {v.reasonForVisit && <p className="text-xs text-muted-foreground mt-1">{v.reasonForVisit}</p>}
                {v.payments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {v.payments.map((pay) => (
                      <Badge key={pay.id} variant="outline" className="text-[10px] flex items-center gap-1">
                        <Wallet className="h-2.5 w-2.5" /> ₹{pay.amount} · {pay.mode} · {pay.status}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid sm:grid-cols-4 gap-4 mb-8 max-w-3xl">
        <StatCard label="Appointments" value={patient._count.appointments} />
        <StatCard label="Records" value={patient._count.records} />
        <StatCard label="Prescriptions" value={patient._count.prescriptions} />
        <StatCard label="Mizaj Assessments" value={patient._count.mizajAssessments} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 max-w-4xl">
        <Card className="p-6 border-border/50 bg-card/60">
          <h2 className="font-serif text-lg font-semibold mb-4">Contact Information</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow icon={Mail}>{patient.email || "No email on file"}</InfoRow>
            <InfoRow icon={Phone}>{patient.phone || "No phone on file"}</InfoRow>
            <InfoRow icon={Cake}>DOB: {patient.dob || "Not provided"}</InfoRow>
            <InfoRow icon={Users}>Gender: {patient.gender || "Not provided"}</InfoRow>
            <InfoRow icon={MapPin}>{patient.address || "Address not provided"}</InfoRow>
            <InfoRow icon={Briefcase}>{patient.occupation || "Occupation not provided"}</InfoRow>
            <InfoRow icon={Phone}>Emergency contact: {patient.emergencyContact || "Not provided"}</InfoRow>
            <InfoRow icon={Calendar}>Registered {new Date(patient.createdAt).toLocaleDateString()}</InfoRow>
            <InfoRow icon={Clock}>
              Last login:{" "}
              <button type="button" className="hover:text-primary hover:underline transition-colors" onClick={() => setHistoryOpen(true)}>
                {patient.lastLoginAt ? new Date(patient.lastLoginAt).toLocaleString() : "Never"}
              </button>
            </InfoRow>
          </dl>
        </Card>
        <Card className="p-6 border-border/50 bg-card/60">
          <h2 className="font-serif text-lg font-semibold mb-4">Medical Profile</h2>
          <dl className="space-y-3 text-sm">
            <InfoRow icon={Leaf}>Mizaj: {patient.mizaj || "Not assessed"}</InfoRow>
            <InfoRow icon={HeartPulse}>Blood group: {patient.bloodGroup || "—"}</InfoRow>
            <InfoRow icon={HeartPulse}>Height / Weight: {patient.height || "—"} / {patient.weight || "—"}</InfoRow>
            <InfoRow icon={HeartPulse}>Chronic conditions: {patient.chronicConditions || "None on file"}</InfoRow>
            <InfoRow icon={HeartPulse}>Allergies: {patient.allergies || "None on file"}</InfoRow>
            <InfoRow icon={Pill}>Current medications: {patient.currentMedications || "None on file"}</InfoRow>
            <InfoRow icon={FileText}>Medical history: {patient.medicalHistory || "Not provided"}</InfoRow>
            <InfoRow icon={Users}>Family history: {patient.familyHistory || "Not provided"}</InfoRow>
            <InfoRow icon={FileText}>Surgical history: {patient.surgicalHistory || "Not provided"}</InfoRow>
            <InfoRow icon={Activity}>Lifestyle: {patient.lifestyle || "Not provided"}</InfoRow>
          </dl>
        </Card>
      </div>

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
