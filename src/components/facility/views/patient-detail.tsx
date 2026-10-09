"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatAge } from "@/lib/age";
import { calculateBmi, bmiBand } from "@/lib/bmi";
import { cmToFeetInches } from "@/lib/units";
import { findLatestWithField, type VisitVitals } from "@/lib/vitals-trend";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { VitalsPanel } from "@/components/facility/views/vitals-panel";
import { ScreeningCard } from "@/components/facility/views/screening-card";
import { ConsultationCard } from "@/components/facility/views/consultation-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, Loader2, MapPin, Droplet, Activity, FileText, Camera,
  IdCard, Phone, Mail, Briefcase, HeartPulse, Pill, Ruler, Scale,
} from "lucide-react";

interface Patient {
  id: string; patientCode: string | null; name: string; email: string | null; phone: string | null;
  titlePrefix: string | null; registrationFor: string | null; relationship: string | null;
  dob: string | null; dobApprox: boolean; gender: string | null; maritalStatus: string | null;
  bloodGroup: string | null; address: string | null; state: string | null; city: string | null;
  emergencyContact: string | null; emergencyContactName: string | null; emergencyRelationship: string | null;
  occupation: string | null; height: string | null; weight: string | null;
  familyHistory: string | null; medicalHistory: string | null; chronicConditions: string | null;
  allergies: string | null; currentMedications: string | null; surgicalHistory: string | null;
  lifestyle: string | null; mizaj: string | null; photo: string | null; avatarColor: string;
}

interface VisitRow {
  id: string; visitDate: string;
  vitalSigns: VisitVitals | null;
  l1Screening: {
    id: string; chiefComplaints: string; overallFlag: string | null; aiSummary: string | null; updatedAt: string;
    answers?: { flagTriggered: string | null }[];
  } | null;
  clinicalAssessment: { id: string; workingDiagnosis: string | null; requiresUrgentReferral: boolean; updatedAt: string } | null;
  treatmentPlan: { id: string; careClassification: string; referralRequired: boolean; updatedAt: string } | null;
}

export function PatientDetail({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [detail, setDetail] = useState<{ mizaj: any[]; prescriptions: any[] }>({ mizaj: [], prescriptions: [] });
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, mizaj, presc, v] = await Promise.all([
        api.get<{ patient: Patient }>(`/api/facility/patients/${patientId}`),
        api.get<{ assessments: any[] }>(`/api/mizaj?patientId=${patientId}`),
        api.get<{ prescriptions: any[] }>(`/api/prescriptions?patientId=${patientId}`),
        api.get<{ visits: VisitRow[] }>(`/api/facility/visits?patientId=${patientId}`),
      ]);
      setPatient(p.patient);
      setDetail({ mizaj: mizaj.assessments || [], prescriptions: presc.prescriptions || [] });
      setVisits(v.visits || []);
    } catch (e: any) {
      toast.error(e.message || "Could not load this patient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  const savePhoto = async (dataUrl: string | null) => {
    const res = await api.patch<{ patient: Patient }>(`/api/facility/patients/${patientId}`, { photo: dataUrl });
    setPatient(res.patient);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!patient) {
    return <p className="text-muted-foreground text-sm">Patient not found.</p>;
  }

  const latestHeightCm = findLatestWithField(visits, "heightCm");
  const latestWeightKg = findLatestWithField(visits, "weightKg");
  const latestBmi = calculateBmi(latestHeightCm, latestWeightKg);
  const latestBmiBand = bmiBand(latestBmi);
  return (
    <div className="w-full">
      <button onClick={() => router.push("/facility/patients")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Patients
      </button>

      <Card className="p-4 sm:p-5 mb-6 border-border/50 bg-gradient-to-br from-card to-card/60 flex flex-row items-center gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => setPhotoDialogOpen(true)}
          className="group relative h-16 w-16 rounded-full shrink-0"
          aria-label="Change patient photo"
        >
          <EntityAvatar name={patient.name} photo={patient.photo} avatarColor={patient.avatarColor} size="lg" className="h-16 w-16 text-lg" />
          <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
            <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-card">
            <Camera className="h-2.5 w-2.5 text-primary-foreground" />
          </span>
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">{patient.name}</h1>
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
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{patient.email || "No email"}</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone || "No phone"}</span>
          </p>
          {(latestHeightCm != null || latestWeightKg != null) && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
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
          )}
        </div>
      </Card>

      <PhotoUploadDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        currentPhoto={patient.photo}
        title="Change patient photo"
        onSave={(dataUrl) => savePhoto(dataUrl)}
        onRemove={() => savePhoto(null)}
      />

      <div className="mb-6">
        <VitalsPanel visits={visits} patientId={patientId} />
      </div>

      <div className="mb-6">
        <ScreeningCard visits={visits} patientId={patientId} />
      </div>

      <div className="mb-6">
        <ConsultationCard visits={visits} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Quick facts */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { l: "Blood", v: patient.bloodGroup || "—", i: Droplet },
              { l: "Mizaj", v: patient.mizaj || "—", i: Activity },
            ].map((f) => (
              <Card key={f.l} className="p-2.5 border-border/50 bg-card/60">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><f.i className="h-3 w-3" />{f.l}</p>
                <p className="text-sm font-medium">{f.v}</p>
              </Card>
            ))}
          </div>

          {/* Mizaj history */}
          <Card className="p-4 border-border/50 bg-card/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Mizaj Assessments</p>
            {detail.mizaj.length ? (
              <div className="space-y-2">
                {detail.mizaj.map((m: any) => (
                  <div key={m.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-primary">{m.result}</p>
                      <span className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</span>
                    </div>
                    {m.pulse && <p className="text-xs text-muted-foreground">Pulse: {m.pulse}</p>}
                    {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No assessments yet.</p>}
          </Card>

          {/* Prescriptions */}
          <Card className="p-4 border-border/50 bg-card/60">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Prescriptions</p>
            {detail.prescriptions.length ? (
              <div className="space-y-2">
                {detail.prescriptions.map((pr: any) => (
                  <div key={pr.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{pr.therapyType}</p>
                      <span className="text-[10px] text-muted-foreground">{new Date(pr.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-1">
                      {pr.items.map((it: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground">• {it.name} — {it.dose} {it.frequency} ({it.instructions})</div>
                      ))}
                    </div>
                    {pr.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{pr.notes}</p>}
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No prescriptions yet.</p>}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-4 border-border/50 bg-card/60 gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</p>
            {patient.phone && <p className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {patient.phone}</p>}
            {patient.email && <p className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {patient.email}</p>}
            {patient.address && (
              <p className="flex items-start gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                {patient.address}{patient.city ? `, ${patient.city}` : ""}{patient.state ? `, ${patient.state}` : ""}
              </p>
            )}
            {patient.occupation && <p className="flex items-center gap-2 text-sm"><Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {patient.occupation}</p>}
            {(patient.emergencyContact || patient.emergencyContactName) && (
              <p className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                Emergency: {patient.emergencyContactName ? `${patient.emergencyContactName} — ` : ""}{patient.emergencyContact || "—"}
              </p>
            )}
          </Card>

          {patient.chronicConditions && (
            <Card className="p-4 border-accent/30 bg-accent/5">
              <p className="text-xs font-medium text-accent mb-1 flex items-center gap-1"><Activity className="h-3.5 w-3.5" /> Chronic Conditions</p>
              <p className="text-sm">{patient.chronicConditions}</p>
            </Card>
          )}

          {(patient.allergies || patient.currentMedications || patient.medicalHistory) && (
            <Card className="p-4 border-border/50 bg-card/60 gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><HeartPulse className="h-3.5 w-3.5" /> Medical Profile</p>
              {patient.allergies && <p className="text-sm"><span className="text-muted-foreground">Allergies:</span> {patient.allergies}</p>}
              {patient.currentMedications && <p className="text-sm flex items-start gap-1.5"><Pill className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /> {patient.currentMedications}</p>}
              {patient.medicalHistory && <p className="text-sm"><span className="text-muted-foreground">History:</span> {patient.medicalHistory}</p>}
            </Card>
          )}
        </div>
      </div>

    </div>
  );
}
