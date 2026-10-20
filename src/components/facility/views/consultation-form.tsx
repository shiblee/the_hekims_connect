"use client";

import { useEffect, useState } from "react";
import { useDateLocale, useValueLabel } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
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
import { IntakeStepper, type IntakeStep } from "@/components/facility/views/intake-stepper";
import {
  ChevronLeft, Loader2, Save, IdCard, Stethoscope, ClipboardList,
  Activity, HeartPulse, User, Contact, CreditCard, BriefcaseMedical, Pencil,
} from "lucide-react";

interface Patient {
  id: string; patientCode: string | null; name: string; gender: string | null; dob: string | null;
  bloodGroup: string | null; phone: string | null; avatarColor: string;
  maritalStatus: string | null; occupation: string | null; address: string | null; state: string | null; city: string | null;
  emergencyContact: string | null; emergencyContactName: string | null; emergencyRelationship: string | null;
}
interface VisitInfo {
  id: string; visitCode: string; visitDate: string; reasonForVisit: string | null;
  doctor: { id: string; name: string; designation: string | null } | null;
  payments: { id: string; amount: number; mode: string; status: string }[];
}

interface VitalsSummary {
  pulse: number | null; bpSystolic: number | null; bpDiastolic: number | null;
  spo2: number | null; temperatureF: number | null;
}
interface ScreeningSummary { chiefComplaints: string; aiSummary: string | null }

interface ClinicalAssessment {
  clinicalFindings: string | null; workingDiagnosis: string | null; treatmentRationale: string | null;
  requiresInvestigation: boolean; requiresUrgentReferral: boolean; notes: string | null;
}
interface TreatmentPlanT {
  diagnosis: string | null; treatmentObjective: string | null;
  plannedInvestigations: string | null; plannedModalities: string | null;
  referralRequired: boolean; referralNotes: string | null; reviewDate: string | null; clinicalNotes: string | null;
}


export function ConsultationForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [vitals, setVitals] = useState<VitalsSummary | null>(null);
  const [screening, setScreening] = useState<ScreeningSummary | null>(null);
  const [step, setStep] = useState<IntakeStep>("vitals");

  const [assessment, setAssessment] = useState<ClinicalAssessment>({
    clinicalFindings: "", workingDiagnosis: "", treatmentRationale: "",
    requiresInvestigation: false, requiresUrgentReferral: false, notes: "",
  });
  const [savingAssessment, setSavingAssessment] = useState(false);

  const [plan, setPlan] = useState<TreatmentPlanT>({
    diagnosis: "", treatmentObjective: "",
    plannedInvestigations: "", plannedModalities: "",
    referralRequired: false, referralNotes: "", reviewDate: "", clinicalNotes: "",
  });
  const [savingPlan, setSavingPlan] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const reviewMsg = useNotice();
  const tv = useTranslations("clinic.visit");
  const tc = useTranslations("common");
  const vl = useValueLabel();
  const dl = useDateLocale();
  const savedAt = () => tv("saved_at", { time: new Date().toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" }) });
  const planMsg = useNotice();

  useEffect(() => {
    Promise.all([
      api.get<{ visit: VisitInfo & { patient: Patient }; vitals: VitalsSummary | null }>(`/api/facility/visits/${visitId}/vitals`),
      api.get<{ screening: ScreeningSummary | null }>(`/api/facility/visits/${visitId}/screening`),
      api.get<{ assessment: ClinicalAssessment | null }>(`/api/facility/visits/${visitId}/clinical-assessment`),
      api.get<{ plan: TreatmentPlanT | null }>(`/api/facility/visits/${visitId}/treatment-plan`),
    ])
      .then(([vitalsRes, screeningRes, assessmentRes, planRes]) => {
        setPatient(vitalsRes.visit.patient);
        setVisit(vitalsRes.visit);
        setVitals(vitalsRes.vitals);
        setScreening(screeningRes.screening);
        if (assessmentRes.assessment) setAssessment({ ...assessmentRes.assessment });
        if (planRes.plan) setPlan({ ...planRes.plan, reviewDate: planRes.plan.reviewDate ? planRes.plan.reviewDate.slice(0, 10) : "" });
      })
      .catch((e) => { console.error("Consultation load failed:", e); setLoadError(e.message || tc("network_error")); })
      .finally(() => setLoading(false));
  }, [visitId]);

  const saveAssessment = async () => {
    setSavingAssessment(true);
    try {
      const res = await api.post<{ assessment: ClinicalAssessment }>(`/api/facility/visits/${visitId}/clinical-assessment`, assessment);
      setAssessment(res.assessment);
      reviewMsg.success(tv("review_saved"), savedAt());
    } catch (e: any) {
      reviewMsg.error(tv("review_not_saved"), tv("entries_here", { error: e.message || tc("network_error") }), { retry: saveAssessment, retryLabel: tv("save_again") });
    } finally {
      setSavingAssessment(false);
    }
  };

  const savePlan = async () => {
    setSavingPlan(true);
    try {
      const res = await api.post<{ plan: TreatmentPlanT }>(`/api/facility/visits/${visitId}/treatment-plan`, plan);
      setPlan({ ...res.plan, reviewDate: res.plan.reviewDate ? res.plan.reviewDate.slice(0, 10) : "" });
      planMsg.success(tv("plan_saved"), savedAt());
    } catch (e: any) {
      planMsg.error(tv("plan_not_saved"), tv("entries_here", { error: e.message || tc("network_error") }), { retry: savePlan, retryLabel: tv("save_again") });
    } finally {
      setSavingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}
      </div>
    );
  }
  if (!patient || !visit) {
    return loadError ? <LoadFailed what={tv("this_visit")} detail={loadError} /> : <p className="text-muted-foreground text-sm">{tv("not_found")}</p>;
  }

  const chiefComplaints: string[] = (() => { try { return JSON.parse(screening?.chiefComplaints || "[]"); } catch { return []; } })();

  return (
    <div className="w-full">
      <button onClick={() => router.push("/facility/patients")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> {tv("back")}
      </button>

      <div className="mb-4">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">{tv("review")}</h1>
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
          {patient.gender ? vl(patient.gender) : "—"} · {formatAge(patient.dob)} · {patient.bloodGroup || tv("blood_none")} · {patient.phone || "—"}
        </p>
        <div className="flex-1 min-w-4" />
        <div className="h-5 w-px bg-border shrink-0" />
        <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(visit.visitDate).toLocaleDateString(dl)}</p>
      </Card>

      {/* Junior Hakeem Intake Protocol — Mizaj/Handover steps are placeholders
          until Phase 2/3 land (see the plan). The deeper per-complaint capture
          now lives on the patient record page's Chief Complaint Matrix. */}
      <IntakeStepper step={step} onStepChange={setStep} completedSteps={vitals || screening ? ["vitals"] : []} />

      {step === "vitals" && (
        <div className="flex gap-5 items-start flex-wrap lg:flex-nowrap mb-5">
          {/* Chief complaints as reception captured them at registration. */}
          <div className="w-full lg:w-64 shrink-0">
            <Card className="p-4 border-border/40 bg-card/60 gap-3 lg:sticky lg:top-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <BriefcaseMedical className="h-3.5 w-3.5" /> {tv("chief_complaints")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{tv("captured")}</p>
              </div>
              {chiefComplaints.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {chiefComplaints.map((c) => (
                    <span key={c} className="rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm">{c}</span>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">{tv("no_chief")}</p>}
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => router.push(`/facility/patients/register?visitId=${visitId}`)}>
                <Pencil className="h-3.5 w-3.5" /> {tv("edit_registration")}
              </Button>
            </Card>
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <Card className="p-4 border-border/40 bg-card/60 gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {tv("profile")}
              </p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <p><span className="text-muted-foreground block text-xs">{tv("gender_age")}</span>{patient.gender ? vl(patient.gender) : "—"} · {formatAge(patient.dob)}</p>
                <p><span className="text-muted-foreground block text-xs">{tv("marital")}</span>{patient.maritalStatus ? vl(patient.maritalStatus) : "—"}</p>
                <p><span className="text-muted-foreground block text-xs">{tv("blood")}</span>{patient.bloodGroup || "—"}</p>
                <p><span className="text-muted-foreground block text-xs">{tv("occupation")}</span>{patient.occupation || "—"}</p>
                <p className="sm:col-span-2"><span className="text-muted-foreground block text-xs">{tv("address")}</span>{[patient.address, patient.city, patient.state].filter(Boolean).join(", ") || "—"}</p>
              </div>
            </Card>

            <Card className="p-4 border-border/40 bg-card/60 gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Contact className="h-3.5 w-3.5" /> {tv("emergency")}
              </p>
              {(patient.emergencyContact || patient.emergencyContactName) ? (
                <p className="text-sm">
                  {patient.emergencyContactName || "—"}{patient.emergencyRelationship ? ` (${vl(patient.emergencyRelationship)})` : ""} — {patient.emergencyContact || "—"}
                </p>
              ) : <p className="text-sm text-muted-foreground">{tv("not_at_reg")}</p>}
            </Card>

            <Card className="p-4 border-border/40 bg-card/60 gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> {tv("billing")}
              </p>
              <p className="text-sm">
                {visit.doctor ? `${tv("dr", { name: visit.doctor.name })}${visit.doctor.designation ? ` — ${visit.doctor.designation}` : ""}` : tv("no_doctor")}
              </p>
              {visit.payments.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {visit.payments.map((p) => (
                    <Badge key={p.id} variant="outline" className="text-xs font-normal">₹{p.amount} · {vl(p.mode)} · {p.status}</Badge>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">{tv("no_payment")}</p>}
            </Card>

            <Card className="p-4 border-border/40 bg-card/60 gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> {tv("so_far")}
              </p>
              {vitals && (
                <p className="text-sm text-foreground/90 flex items-center gap-1.5 flex-wrap">
                  <HeartPulse className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {vitals.pulse != null ? tv("v_pulse", { value: vitals.pulse }) : null}
                  {vitals.bpSystolic != null ? ` · ${tv("v_bp", { value: `${vitals.bpSystolic}/${vitals.bpDiastolic ?? "—"}` })}` : null}
                  {vitals.spo2 != null ? ` · ${tv("v_spo2", { value: vitals.spo2 })}` : null}
                  {vitals.temperatureF != null ? ` · ${tv("v_temp", { value: vitals.temperatureF })}` : null}
                  {!vitals.pulse && !vitals.bpSystolic && !vitals.spo2 && !vitals.temperatureF && tv("no_vitals")}
                </p>
              )}
              {!vitals && !screening && <p className="text-sm text-muted-foreground">{tv("nothing_yet")}</p>}
            </Card>
          </div>
        </div>
      )}

      {(step === "mizaj" || step === "handover") && (
        <Card className="p-8 mb-5 border-border/40 bg-card/60 text-center">
          <p className="text-sm text-muted-foreground">
            {tv("coming_later", { step: step === "mizaj" ? tv("step_mizaj") : tv("step_handover") })}
          </p>
        </Card>
      )}

      {/* Doctor Review */}
      <Card className="relative overflow-hidden p-5 sm:p-6 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl gap-4 mb-5">
        <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-primary" /> {tv("review")}
        </p>

        <Textarea maxLength={500}
          placeholder={tv("findings_ph")}
          value={assessment.clinicalFindings || ""}
          onChange={(e) => setAssessment((p) => ({ ...p, clinicalFindings: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <FloatingField
          id="workingDiagnosis" label={tv("working_dx")}
          value={assessment.workingDiagnosis || ""}
          onChange={(e) => setAssessment((p) => ({ ...p, workingDiagnosis: e.target.value }))}
        />
        <Textarea maxLength={500}
          placeholder={tv("rationale_ph")}
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
            <Label htmlFor="requiresInvestigation" className="text-sm font-normal cursor-pointer">{tv("investigation")}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="requiresUrgentReferral"
              checked={assessment.requiresUrgentReferral}
              onCheckedChange={(v) => setAssessment((p) => ({ ...p, requiresUrgentReferral: !!v }))}
            />
            <Label htmlFor="requiresUrgentReferral" className="text-sm font-normal cursor-pointer text-destructive">{tv("urgent_ref")}</Label>
          </div>
        </div>
        <Textarea maxLength={500}
          placeholder={tv("notes_ph")}
          value={assessment.notes || ""}
          onChange={(e) => setAssessment((p) => ({ ...p, notes: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <NoticeSlot state={reviewMsg} />
        <div className="flex justify-end">
          <Button size="sm" onClick={saveAssessment} disabled={savingAssessment}>
            {savingAssessment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {tv("save_review")}
          </Button>
        </div>
      </Card>

      {/* Treatment Plan */}
      <Card className="relative overflow-hidden p-5 sm:p-6 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl gap-4">
        <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-primary" /> {tv("plan")}
        </p>

        <FloatingField
          id="diagnosis" label={tv("diagnosis")}
          value={plan.diagnosis || ""}
          onChange={(e) => setPlan((p) => ({ ...p, diagnosis: e.target.value }))}
        />
        <Textarea maxLength={500}
          placeholder={tv("objective_ph")}
          value={plan.treatmentObjective || ""}
          onChange={(e) => setPlan((p) => ({ ...p, treatmentObjective: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <Textarea maxLength={500}
          placeholder={tv("investigations_ph")}
          value={plan.plannedInvestigations || ""}
          onChange={(e) => setPlan((p) => ({ ...p, plannedInvestigations: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />
        <Textarea maxLength={500}
          placeholder={tv("modalities_ph")}
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
          <Label htmlFor="referralRequired" className="text-sm font-normal cursor-pointer">{tv("referral_req")}</Label>
        </div>
        {plan.referralRequired && (
          <Textarea maxLength={500}
            placeholder={tv("referral_ph")}
            value={plan.referralNotes || ""}
            onChange={(e) => setPlan((p) => ({ ...p, referralNotes: e.target.value }))}
            className="bg-background/60"
            rows={2}
          />
        )}

        <div className="max-w-xs">
          <Label className="text-sm font-medium mb-2 block">{tv("review_date")}</Label>
          <Input
            type="date"
            value={plan.reviewDate || ""}
            onChange={(e) => setPlan((p) => ({ ...p, reviewDate: e.target.value }))}
            className="bg-background/60"
          />
        </div>
        <Textarea maxLength={500}
          placeholder={tv("clinical_notes_ph")}
          value={plan.clinicalNotes || ""}
          onChange={(e) => setPlan((p) => ({ ...p, clinicalNotes: e.target.value }))}
          className="bg-background/60"
          rows={2}
        />

        <NoticeSlot state={planMsg} />
        <div className="flex justify-end">
          <Button size="sm" onClick={savePlan} disabled={savingPlan}>
            {savingPlan ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {tv("save_plan")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
