"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { formatAge } from "@/lib/age";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FloatingField } from "@/components/shared/floating-field";
import {
  ChevronLeft, Loader2, Save, IdCard, Stethoscope, ClipboardList,
  ShieldAlert, Activity, HeartPulse,
} from "lucide-react";

interface Patient {
  id: string; patientCode: string | null; name: string; gender: string | null; dob: string | null;
  bloodGroup: string | null; phone: string | null; avatarColor: string;
}
interface VisitInfo { id: string; visitCode: string; visitDate: string }

interface VitalsSummary {
  pulse: number | null; bpSystolic: number | null; bpDiastolic: number | null;
  spo2: number | null; temperatureF: number | null; respiratoryRate: number | null;
}
interface ScreeningSummary { chiefComplaints: string; overallFlag: string | null; aiSummary: string | null }

interface ClinicalAssessment {
  clinicalFindings: string | null; workingDiagnosis: string | null; treatmentRationale: string | null;
  requiresInvestigation: boolean; requiresUrgentReferral: boolean; notes: string | null;
}
interface TreatmentPlanT {
  careClassification: string; diagnosis: string | null; treatmentObjective: string | null;
  plannedInvestigations: string | null; plannedModalities: string | null;
  referralRequired: boolean; referralNotes: string | null; reviewDate: string | null; clinicalNotes: string | null;
}

const FLAG_STYLE: Record<string, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};
const FLAG_LABEL: Record<string, string> = { red: "High Risk", yellow: "Needs Review", green: "Low Risk" };

export function ConsultationForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [vitals, setVitals] = useState<VitalsSummary | null>(null);
  const [screening, setScreening] = useState<ScreeningSummary | null>(null);
  const [careClassifications, setCareClassifications] = useState<string[]>([]);

  const [assessment, setAssessment] = useState<ClinicalAssessment>({
    clinicalFindings: "", workingDiagnosis: "", treatmentRationale: "",
    requiresInvestigation: false, requiresUrgentReferral: false, notes: "",
  });
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [plan, setPlan] = useState<TreatmentPlanT>({
    careClassification: "", diagnosis: "", treatmentObjective: "",
    plannedInvestigations: "", plannedModalities: "",
    referralRequired: false, referralNotes: "", reviewDate: "", clinicalNotes: "",
  });
  const [savingPlan, setSavingPlan] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ visit: VisitInfo; patient: Patient; vitals: VitalsSummary | null }>(`/api/facility/visits/${visitId}/vitals`),
      api.get<{ screening: ScreeningSummary | null }>(`/api/facility/visits/${visitId}/screening`),
      api.get<{ assessment: ClinicalAssessment | null }>(`/api/facility/visits/${visitId}/clinical-assessment`),
      api.get<{ plan: TreatmentPlanT | null }>(`/api/facility/visits/${visitId}/treatment-plan`),
      api.get<{ sections: Record<string, { label: string; options: string[] }> }>("/api/facility/metadata"),
    ])
      .then(([vitalsRes, screeningRes, assessmentRes, planRes, metaRes]) => {
        setPatient(vitalsRes.patient);
        setVisit(vitalsRes.visit);
        setVitals(vitalsRes.vitals);
        setScreening(screeningRes.screening);
        if (assessmentRes.assessment) setAssessment({ ...assessmentRes.assessment });
        if (planRes.plan) setPlan({ ...planRes.plan, reviewDate: planRes.plan.reviewDate ? planRes.plan.reviewDate.slice(0, 10) : "" });
        setCareClassifications(metaRes.sections?.care_classification?.options || []);
      })
      .catch(() => toast.error("Could not load this visit"))
      .finally(() => setLoading(false));
  }, [visitId]);

  const saveAssessment = async () => {
    setSavingAssessment(true);
    try {
      const res = await api.post<{ assessment: ClinicalAssessment }>(`/api/facility/visits/${visitId}/clinical-assessment`, assessment);
      setAssessment(res.assessment);
      toast.success("Clinical review saved");
    } catch (e: any) {
      toast.error(e.message || "Could not save the clinical review");
    } finally {
      setSavingAssessment(false);
    }
  };

  const savePlan = async () => {
    if (!plan.careClassification) {
      toast.error("Select a care classification");
      return;
    }
    setSavingPlan(true);
    try {
      const res = await api.post<{ plan: TreatmentPlanT }>(`/api/facility/visits/${visitId}/treatment-plan`, plan);
      setPlan({ ...res.plan, reviewDate: res.plan.reviewDate ? res.plan.reviewDate.slice(0, 10) : "" });
      toast.success("Treatment plan saved");
    } catch (e: any) {
      toast.error(e.message || "Could not save the treatment plan");
    } finally {
      setSavingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!patient || !visit) {
    return <p className="text-muted-foreground text-sm">Visit not found.</p>;
  }

  const chiefComplaints: string[] = (() => { try { return JSON.parse(screening?.chiefComplaints || "[]"); } catch { return []; } })();

  return (
    <div className="w-full">
      <button onClick={() => router.push("/facility/patients")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Patients
      </button>

      <div className="mb-4">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">Doctor Review</h1>
      </div>

      <Card className="p-3 mb-5 border-primary/30 bg-primary/5 flex flex-row items-center gap-3 overflow-x-auto">
        <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(patient.avatarColor))}>
          {initials(patient.name)}
        </div>
        <p className="text-sm font-semibold whitespace-nowrap shrink-0">{patient.name}</p>
        {patient.patientCode && (
          <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-[10px] flex items-center gap-1 shrink-0">
            <IdCard className="h-3 w-3" /> {patient.patientCode}
          </Badge>
        )}
        <div className="h-5 w-px bg-border shrink-0" />
        <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {patient.gender || "—"} · {formatAge(patient.dob)} · {patient.bloodGroup || "Blood group —"} · {patient.phone || "—"}
        </p>
        <div className="flex-1 min-w-4" />
        <div className="h-5 w-px bg-border shrink-0" />
        <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(visit.visitDate).toLocaleDateString()}</p>
      </Card>

      {/* Read-only recap of vitals + L1 screening for this visit */}
      {(vitals || screening) && (
        <Card className="p-4 mb-5 border-border/40 bg-card/60 gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> This Visit So Far
          </p>
          {vitals && (
            <p className="text-sm text-foreground/90 flex items-center gap-1.5 flex-wrap">
              <HeartPulse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {vitals.pulse != null ? `Pulse ${vitals.pulse} bpm` : null}
              {vitals.bpSystolic != null ? ` · BP ${vitals.bpSystolic}/${vitals.bpDiastolic ?? "—"}` : null}
              {vitals.spo2 != null ? ` · SpO2 ${vitals.spo2}%` : null}
              {vitals.temperatureF != null ? ` · Temp ${vitals.temperatureF}°F` : null}
              {vitals.respiratoryRate != null ? ` · RR ${vitals.respiratoryRate}/min` : null}
              {!vitals.pulse && !vitals.bpSystolic && !vitals.spo2 && !vitals.temperatureF && !vitals.respiratoryRate && "No vitals recorded"}
            </p>
          )}
          {screening && (
            <div className="flex items-center gap-2 flex-wrap">
              {screening.overallFlag && (
                <Badge variant="outline" className={cn("border text-xs", FLAG_STYLE[screening.overallFlag])}>
                  <ShieldAlert className="h-3 w-3" /> {FLAG_LABEL[screening.overallFlag] || screening.overallFlag}
                </Badge>
              )}
              {chiefComplaints.map((c) => <Badge key={c} variant="outline" className="text-[11px] font-normal">{c}</Badge>)}
            </div>
          )}
          {!vitals && !screening && <p className="text-sm text-muted-foreground">No vitals or screening recorded yet for this visit.</p>}
        </Card>
      )}

      {/* Doctor Review */}
      <Card className="relative overflow-hidden p-5 sm:p-6 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl gap-4 mb-5">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-primary" /> Doctor Review
        </p>

        <Textarea
          placeholder="Clinical findings…"
          value={assessment.clinicalFindings || ""}
          onChange={(e) => setAssessment((p) => ({ ...p, clinicalFindings: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <FloatingField
          id="workingDiagnosis" label="Working / confirmed diagnosis"
          value={assessment.workingDiagnosis || ""}
          onChange={(e) => setAssessment((p) => ({ ...p, workingDiagnosis: e.target.value }))}
        />
        <Textarea
          placeholder="Treatment rationale…"
          value={assessment.treatmentRationale || ""}
          onChange={(e) => setAssessment((p) => ({ ...p, treatmentRationale: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="requiresInvestigation"
              checked={assessment.requiresInvestigation}
              onCheckedChange={(v) => setAssessment((p) => ({ ...p, requiresInvestigation: !!v }))}
            />
            <Label htmlFor="requiresInvestigation" className="text-sm font-normal cursor-pointer">Requires further investigation</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="requiresUrgentReferral"
              checked={assessment.requiresUrgentReferral}
              onCheckedChange={(v) => setAssessment((p) => ({ ...p, requiresUrgentReferral: !!v }))}
            />
            <Label htmlFor="requiresUrgentReferral" className="text-sm font-normal cursor-pointer text-destructive">Requires urgent referral</Label>
          </div>
        </div>
        <Textarea
          placeholder="Additional notes…"
          value={assessment.notes || ""}
          onChange={(e) => setAssessment((p) => ({ ...p, notes: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={saveAssessment} disabled={savingAssessment}>
            {savingAssessment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Review
          </Button>
        </div>
      </Card>

      {/* Care Classification & Treatment Plan */}
      <Card className="relative overflow-hidden p-5 sm:p-6 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl gap-4">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> Care Classification &amp; Treatment Plan
        </p>

        <div>
          <Label className="text-sm font-medium mb-2 block">Care Classification</Label>
          <div className="flex flex-wrap gap-2">
            {careClassifications.map((c) => {
              const selected = plan.careClassification === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPlan((p) => ({ ...p, careClassification: c }))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm border transition-colors",
                    selected ? "bg-primary text-primary-foreground border-primary" : "bg-background/60 border-border/50 hover:border-primary/40"
                  )}
                >
                  {c}
                </button>
              );
            })}
            {careClassifications.length === 0 && <p className="text-sm text-muted-foreground">No care classifications configured yet — add some in Admin → Meta.</p>}
          </div>
        </div>

        <FloatingField
          id="diagnosis" label="Diagnosis"
          value={plan.diagnosis || ""}
          onChange={(e) => setPlan((p) => ({ ...p, diagnosis: e.target.value }))}
        />
        <Textarea
          placeholder="Treatment objective…"
          value={plan.treatmentObjective || ""}
          onChange={(e) => setPlan((p) => ({ ...p, treatmentObjective: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <Textarea
          placeholder="Planned investigations…"
          value={plan.plannedInvestigations || ""}
          onChange={(e) => setPlan((p) => ({ ...p, plannedInvestigations: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <Textarea
          placeholder="Planned treatment modalities (diet, medicine, regimen, etc.)…"
          value={plan.plannedModalities || ""}
          onChange={(e) => setPlan((p) => ({ ...p, plannedModalities: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />

        <div className="flex items-center gap-2">
          <Checkbox
            id="referralRequired"
            checked={plan.referralRequired}
            onCheckedChange={(v) => setPlan((p) => ({ ...p, referralRequired: !!v }))}
          />
          <Label htmlFor="referralRequired" className="text-sm font-normal cursor-pointer">Referral required</Label>
        </div>
        {plan.referralRequired && (
          <Textarea
            placeholder="Referral details (facility, specialty, urgency, reason)…"
            value={plan.referralNotes || ""}
            onChange={(e) => setPlan((p) => ({ ...p, referralNotes: e.target.value }))}
            className="bg-background/60"
            rows={2}
          />
        )}

        <div className="max-w-xs">
          <Label className="text-sm font-medium mb-2 block">Review Date</Label>
          <Input
            type="date"
            value={plan.reviewDate || ""}
            onChange={(e) => setPlan((p) => ({ ...p, reviewDate: e.target.value }))}
            className="bg-background/60"
          />
        </div>
        <Textarea
          placeholder="Clinical notes…"
          value={plan.clinicalNotes || ""}
          onChange={(e) => setPlan((p) => ({ ...p, clinicalNotes: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />

        <div className="flex justify-end">
          <Button size="sm" onClick={savePlan} disabled={savingPlan}>
            {savingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Treatment Plan
          </Button>
        </div>
      </Card>
    </div>
  );
}
