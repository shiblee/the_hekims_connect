"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatAge, daysAgo } from "@/lib/age";
import { type VisitVitals } from "@/lib/vitals-trend";
import { cn } from "@/lib/utils";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { VitalsPanel } from "@/components/facility/views/vitals-panel";
import { VitalsAiInsightCard } from "@/components/facility/views/vitals-ai-insight-card";
import { TriageNotesCard } from "@/components/facility/views/triage-notes-card";
import { RedFlagScreeningPanel, type RedFlagScreeningPanelHandle } from "@/components/facility/views/red-flag-screening-panel";
import { ChiefComplaintMatrix, type ChiefComplaintMatrixHandle } from "@/components/facility/views/chief-complaint-matrix";
import { AcuteSymptomsPanel, type AcuteSymptomsPanelHandle } from "@/components/facility/views/acute-symptoms-panel";
import { ClinicalRoutingPanel } from "@/components/facility/views/clinical-routing-panel";
import { HumoralCluesPanel, type HumoralCluesPanelHandle } from "@/components/facility/views/humoral-clues-panel";
import { ResidentClinicalNote, type ResidentClinicalNoteHandle } from "@/components/facility/views/resident-clinical-note";
import { PatientStageTracker, PATIENT_JOURNEY_STEPS } from "@/components/facility/views/patient-stage-tracker";
import { PatientSignatureCard } from "@/components/facility/views/patient-signature-card";
import { useStickyRail } from "@/hooks/use-sticky-rail";
import { Card } from "@/components/ui/card";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { savedAt } from "@/lib/flash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, Loader2,
  CheckCircle2, Printer, ArrowRight, ShieldAlert, ShieldQuestion,
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
  id: string; visitCode?: string; visitDate: string;
  vitalSigns: VisitVitals | null;
  l1Screening: {
    id: string; chiefComplaints: string; overallFlag: string | null; aiSummary: string | null; updatedAt: string;
    answers?: { flagTriggered: string | null }[];
  } | null;
  clinicalAssessment: { id: string; workingDiagnosis: string | null; requiresUrgentReferral: boolean; updatedAt: string } | null;
  treatmentPlan: { id: string; referralRequired: boolean; updatedAt: string } | null;
  referral?: { id: string; reason: string; referredTo: string; urgency: string; notes: string | null; createdAt: string } | null;
  amaDecline?: { id: string; reason: string; patientReason: string | null; createdAt: string } | null;
  doctor?: { id: string; name: string; staffCode: string } | null;
  payments?: { id: string; paymentCode: string; amount: number; mode: string; status: string; createdAt: string }[];
  intake?: {
    chiefComplaints: string; narrative: string | null; onsetTimeline: string | null;
    allergies: string; medications: string; mobility: string | null;
  } | null;
}

export function PatientDetail({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const chiefComplaintRef = useRef<ChiefComplaintMatrixHandle>(null);
  const acuteSymptomsRef = useRef<AcuteSymptomsPanelHandle>(null);
  const residentNoteRef = useRef<ResidentClinicalNoteHandle>(null);
  const redFlagRef = useRef<RedFlagScreeningPanelHandle>(null);
  const humoralCluesRef = useRef<HumoralCluesPanelHandle>(null);

  // Right rail pinned to the viewport while the center column scrolls.
  const { spacerRef: rightRailSpacerRef, contentRef: rightRailContentRef, style: rightRailStyle } = useStickyRail(!loading);

  // Messages for the bottom action bar (save results, print problems) — shown right above it.
  const msg = useNotice();
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, v] = await Promise.all([
        api.get<{ patient: Patient }>(`/api/facility/patients/${patientId}`),
        api.get<{ visits: VisitRow[] }>(`/api/facility/visits?patientId=${patientId}`),
      ]);
      setPatient(p.patient);
      setVisits(v.visits || []);
    } catch (e: any) {
      setLoadError(e.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  // Used after a quick single-metric reading is saved from the Vitals KPI
  // pop-up — refetches just the visits list in place, without the full-page
  // loading spinner `load()` shows, so the pop-up stays open and visibly
  // reflects the new reading instead of being unmounted mid-interaction.
  const refreshVisits = async () => {
    try {
      const v = await api.get<{ visits: VisitRow[] }>(`/api/facility/visits?patientId=${patientId}`);
      setVisits(v.visits || []);
    } catch (e: any) {
      msg.warning("The reading was saved, but this page couldn't refresh", `${e.message || "Network error"}. Reload the page to see the latest vitals.`, { retry: () => window.location.reload(), retryLabel: "Reload" });
    }
  };

  const savePhoto = async (dataUrl: string | null) => {
    const res = await api.patch<{ patient: Patient }>(`/api/facility/patients/${patientId}`, { photo: dataUrl });
    setPatient(res.patient);
  };

  // Stable array reference for ChiefComplaintMatrix's intakeComplaints prop —
  // computing this inline in JSX would create a new array on every render
  // (including the frequent re-renders from the scroll-driven right-rail
  // positioning above), which re-triggers that component's load effect and
  // wipes out whatever the doctor has typed but not yet saved.
  const intakeComplaints = useMemo(() => {
    const latest = [...visits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
    try {
      return JSON.parse(latest?.intake?.chiefComplaints || "[]");
    } catch {
      return [];
    }
  }, [visits]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!patient) {
    return loadError ? <LoadFailed what="this patient" detail={loadError} onRetry={load} /> : <p className="text-muted-foreground text-sm">Patient not found.</p>;
  }

  // Patient journey step state — each flag is derived from a real record,
  // not decorative. "Latest" means the most recent visit, newest first.
  const sortedVisits = [...visits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  const latestVisit = sortedVisits[0];
  // L1 Screening used to be this page's gate too, but its only entry point
  // on this page (the Screening card) was removed — Chief Complaint Matrix
  // and Red Flag now cover that ground here, so recorded vitals is the real
  // signal that Stage 1 is ready to hand off. Requiring l1Screening as well
  // would make this permanently unreachable from this page.
  const checkInComplete = !!latestVisit && !!latestVisit.vitalSigns;
  const referredVisits = sortedVisits.filter((v) => v.referral);
  const amaVisits = sortedVisits.filter((v) => v.amaDecline);

  const printTriageSlip = () => {
    if (!latestVisit) return;
    const v = latestVisit.vitalSigns;
    const complaints: string[] = (() => { try { return JSON.parse(latestVisit.l1Screening?.chiefComplaints || "[]"); } catch { return []; } })();
    const win = window.open("", "_blank");
    if (!win) {
      msg.warning("The print window was blocked", "Your browser stopped the triage slip from opening. Allow pop-ups for this site (icon at the right of the address bar), then print again.");
      return;
    }
    win.document.write(`
      <html><head><title>Triage Slip - ${patient.name}</title>
      <style>
        body { font-family: Georgia, serif; padding: 40px; max-width: 700px; margin: auto; color: #1a1a1a; }
        h1 { color: #0f766e; margin-bottom: 0; }
        .meta { color: #666; font-size: 14px; margin: 4px 0 24px; }
        h2 { color: #b45309; font-size: 16px; border-bottom: 2px solid #b45309; padding-bottom: 6px; margin-top: 24px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ddd; font-size: 14px; }
        .row b { color: #0f766e; }
        .chip { display: inline-block; background: #f6f5f0; border-radius: 12px; padding: 3px 10px; margin: 2px; font-size: 13px; }
        .notes { margin-top: 10px; font-style: italic; color: #555; font-size: 14px; }
      </style></head><body>
      <h1>The Hekim&apos;s Connect</h1>
      <div class="meta">Triage Check-in Slip · ${patient.patientCode || ""}<br/>
      ${new Date(latestVisit.visitDate).toLocaleDateString("en-IN", { dateStyle: "full" })}</div>

      <h2>Patient</h2>
      <div class="row"><span>Name</span><b>${patient.name}</b></div>
      <div class="row"><span>Gender / Age</span><b>${patient.gender || "—"} / ${formatAge(patient.dob)}</b></div>
      <div class="row"><span>Blood Group</span><b>${patient.bloodGroup || "—"}</b></div>
      ${patient.allergies ? `<div class="row"><span>Allergies</span><b style="color:#b91c1c">${patient.allergies}</b></div>` : ""}

      ${v ? `<h2>Core Vitals</h2>
      <div class="row"><span>Blood Pressure</span><b>${v.bpSystolic ?? "—"}/${v.bpDiastolic ?? "—"} mmHg</b></div>
      <div class="row"><span>Heart Rate (Nabz)</span><b>${v.pulse ?? "—"} bpm</b></div>
      <div class="row"><span>SpO₂</span><b>${v.spo2 ?? "—"}%</b></div>
      <div class="row"><span>Core Temp (Hararat)</span><b>${v.temperatureF ?? "—"}°F</b></div>
      ${v.heightCm != null || v.weightKg != null ? `<div class="row"><span>Height / Weight</span><b>${v.heightCm ?? "—"}cm / ${v.weightKg ?? "—"}kg</b></div>` : ""}` : ""}

      ${complaints.length ? `<h2>Chief Complaints</h2>${complaints.map((c) => `<span class="chip">${c}</span>`).join("")}` : ""}

      ${v?.painNotes ? `<h2>Pain Notes</h2><p class="notes">${v.painNotes}</p>` : ""}
      ${v?.primaryFocusArea ? `<div class="row"><span>Primary Focus Area</span><b>${v.primaryFocusArea}</b></div>` : ""}
      ${v?.triageRemarks ? `<h2>Triage Remarks</h2><p class="notes">${v.triageRemarks}</p>` : ""}

      <p style="margin-top:40px;font-size:12px;color:#999;">Generated by The Hekim&apos;s Connect platform for internal clinical handover.</p>
      </body></html>`);
    win.document.close();
    win.print();
  };

  // Unified Stage 1 save — each child panel keeps its own fetch/save logic,
  // exposed via a ref's save() so one bottom action bar can save them all
  // together instead of each panel having its own inline save button.
  // allSettled (not all) so one panel failing doesn't stop the others from
  // saving, and the caller can tell exactly which ones actually went through
  // instead of a blanket success/failure that could mask a partial save.
  const saveStageDrafts = async (): Promise<boolean> => {
    const results = await Promise.allSettled([
      chiefComplaintRef.current?.save(),
      acuteSymptomsRef.current?.save(),
      residentNoteRef.current?.save(),
    ]);
    // The Chief Complaint Matrix save recomputes HumoralAssessment
    // server-side — the clues panel has no other way to learn its tile
    // percentages just went stale, since it only fetches once on mount.
    humoralCluesRef.current?.refresh();
    const sections = ["Main Complaints", "Other Symptoms", "Resident Clinical Note"];
    const failed = sections.filter((_, i) => results[i].status === "rejected");
    if (failed.length) {
      // Each section shows its own error in place; this sums it up by the buttons.
      msg.error(
        failed.length === 1 ? `${failed[0]} wasn't saved` : `${failed.length} sections weren't saved`,
        `${failed.length === 1 ? "See the message in that section above." : `${failed.join(", ")} — see the message in each section above.`} Everything else was saved, and nothing you entered was lost.`,
      );
      return false;
    }
    msg.clear();
    return true;
  };

  const saveDraft = async () => {
    setSavingStage(true);
    try {
      const allSaved = await saveStageDrafts();
      if (allSaved) msg.success("Draft saved", savedAt());
    } finally {
      setSavingStage(false);
    }
  };

  const proceedToStage2 = async () => {
    setSavingStage(true);
    try {
      const allSaved = await saveStageDrafts();
      if (!allSaved) return; // the sections and the summary above the bar say what failed
      const clear = await redFlagRef.current?.attemptResolve();
      if (clear) {
        router.push(`/facility/mizaj?patientId=${patientId}`);
      }
    } finally {
      setSavingStage(false);
    }
  };

  const referPatient = () => redFlagRef.current?.openReferDialog();

  return (
    <div className="w-full">
      <button onClick={() => router.push("/facility/patients")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Patients
      </button>

      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">Clinical Record</h1>
        <button
          onClick={() => router.push(`/facility/patients/${patientId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Edit Registration <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* This page IS the "Acute Vitals & Intake" step's workspace — vitals
          being recorded only unlocks the Proceed button below (already
          gated on checkInComplete separately), it doesn't mean the user has
          left this stage. Jumping the tracker to "Mizaj" while still on
          this page claimed a stage that hadn't actually started yet. */}
      <PatientStageTracker
        steps={PATIENT_JOURNEY_STEPS.map((s) => (s.key === "registration" ? { ...s, href: `/facility/patients/${patientId}` } : s))}
        activeKey="vitals"
        completedKeys={["registration"]}
      />

      <PatientSignatureCard
        patient={patient}
        visitCount={visits.length}
        lastReferralAt={referredVisits[0]?.referral?.createdAt}
        lastAmaAt={amaVisits[0]?.amaDecline?.createdAt}
        onPhotoClick={() => setPhotoDialogOpen(true)}
        visits={sortedVisits}
      />

      <PhotoUploadDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        currentPhoto={patient.photo}
        title="Change patient photo"
        onSave={(dataUrl) => savePhoto(dataUrl)}
        onRemove={() => savePhoto(null)}
      />

      {referredVisits.length > 0 && (
        <Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Emergency Referral History {referredVisits.length > 1 && `(${referredVisits.length})`}
            </p>
          </div>
          <div className="space-y-2">
            {referredVisits.map((v) => (
              <div key={v.id} className="rounded-lg border border-destructive/20 bg-background/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="font-medium">{v.visitCode ? `Visit ${v.visitCode}` : "Visit"} · {daysAgo(v.referral!.createdAt)}</span>
                  <Badge variant="outline" className="border-destructive/40 text-destructive text-xs shrink-0">{v.referral!.urgency}</Badge>
                </div>
                <p><span className="text-muted-foreground">Referred to:</span> <span className="font-medium">{v.referral!.referredTo}</span></p>
                <p><span className="text-muted-foreground">Reason:</span> {v.referral!.reason}</p>
                {v.referral!.notes && <p><span className="text-muted-foreground">Notes:</span> {v.referral!.notes}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {amaVisits.length > 0 && (
        <Card className="p-4 mb-6 border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldQuestion className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Declined Referral — Continued Against Medical Advice {amaVisits.length > 1 && `(${amaVisits.length})`}
            </p>
          </div>
          <div className="space-y-2">
            {amaVisits.map((v) => (
              <div key={v.id} className="rounded-lg border border-amber-500/20 bg-background/60 p-3 text-sm">
                <p className="font-medium mb-1">{v.visitCode ? `Visit ${v.visitCode}` : "Visit"} · {daysAgo(v.amaDecline!.createdAt)}</p>
                <p><span className="text-muted-foreground">Referral recommended for:</span> {v.amaDecline!.reason}</p>
                {v.amaDecline!.patientReason && <p><span className="text-muted-foreground">Patient&apos;s reason:</span> {v.amaDecline!.patientReason}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <VitalsPanel visits={visits} patientId={patientId} onSaved={refreshVisits} patientDob={patient.dob} patientGender={patient.gender} currentVisitId={latestVisit?.id} />
          {latestVisit && (
            <ChiefComplaintMatrix
              ref={chiefComplaintRef}
              visitId={latestVisit.id}
              intakeComplaints={intakeComplaints}
            />
          )}
          {latestVisit && <RedFlagScreeningPanel ref={redFlagRef} visitId={latestVisit.id} />}
          {latestVisit && <AcuteSymptomsPanel ref={acuteSymptomsRef} visitId={latestVisit.id} />}
          <VitalsAiInsightCard patientId={patientId} visitId={latestVisit?.id} />
        </div>
        <div ref={rightRailSpacerRef} className="relative">
        <div ref={rightRailContentRef} className="space-y-5" style={rightRailStyle || undefined}>
          {latestVisit && <ClinicalRoutingPanel visitId={latestVisit.id} />}
          {latestVisit && (
            <HumoralCluesPanel
              ref={humoralCluesRef}
              visitId={latestVisit.id}
              onBeforeGenerate={async () => { await chiefComplaintRef.current?.save(); }}
            />
          )}
          {latestVisit && <ResidentClinicalNote ref={residentNoteRef} visitId={latestVisit.id} />}
          <TriageNotesCard visits={visits} />
        </div>
        </div>
      </div>

      <NoticeSlot state={msg} className="mb-3" />
      <Card className={cn(
        "p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap",
        checkInComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50 bg-card/60"
      )}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
            checkInComplete ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          )}>
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {checkInComplete ? "Triage Check-in Ready for Doctor Handover" : "Triage Check-in In Progress"}
            </p>
            <p className="text-xs text-muted-foreground">
              {checkInComplete
                ? "Vitals and screening recorded for this visit · Next phase: Mizaj Constitution & Pulse (Nabz) Assessment"
                : "Record vitals and complete L1 screening to proceed to the Mizaj exam."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {latestVisit && (
            <Button size="sm" variant="ghost" onClick={printTriageSlip} title="Print Triage Slip">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          )}
          {latestVisit && (
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={referPatient} disabled={savingStage}>
              <ShieldAlert className="h-3.5 w-3.5" /> Refer Patient
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={saveDraft} disabled={savingStage}>
            {savingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Draft
          </Button>
          <Button size="sm" onClick={proceedToStage2} disabled={savingStage || !checkInComplete}>
            {savingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Proceed to Mizaj Morphometry (Stage 3) <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

    </div>
  );
}
