"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatAge, daysAgo } from "@/lib/age";
import { type VisitVitals } from "@/lib/vitals-trend";
import { cn } from "@/lib/utils";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { VitalsPanel } from "@/components/facility/views/vitals-panel";
import { TriageNotesCard } from "@/components/facility/views/triage-notes-card";
import { RedFlagScreeningPanel, type RedFlagScreeningPanelHandle } from "@/components/facility/views/red-flag-screening-panel";
import { ChiefComplaintMatrix, type ChiefComplaintMatrixHandle } from "@/components/facility/views/chief-complaint-matrix";
import { AcuteSymptomsPanel, type AcuteSymptomsPanelHandle } from "@/components/facility/views/acute-symptoms-panel";
import { HakeemInsightPanel, type HakeemInsightPanelHandle } from "@/components/facility/views/hakeem-insight-panel";
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
  Printer, ArrowRight, ShieldAlert, ShieldQuestion, Pencil,
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
    id: string; chiefComplaints: string; aiSummary: string | null; updatedAt: string;
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
  const humoralCluesRef = useRef<HakeemInsightPanelHandle>(null);

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

  // Print icon → the Comprehensive Assessment Report, in a new tab. It reads
  // only what's saved and never writes anything, so this tab (and any unsaved
  // edits on it) stays exactly as it is.
  const openReport = () => {
    if (!latestVisit) return;
    const url = `/facility/patients/${patientId}/record/report?visit=${latestVisit.id}`;
    if (!window.open(url, "_blank")) router.push(url);
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
        <ReferralLine
          visits={referredVisits}
          onEdit={latestVisit && referredVisits[0].id === latestVisit.id ? () => redFlagRef.current?.openEditReferral() : undefined}
        />
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
          {latestVisit && <RedFlagScreeningPanel ref={redFlagRef} visitId={latestVisit.id} onReferralChange={refreshVisits} />}
          {latestVisit && <AcuteSymptomsPanel ref={acuteSymptomsRef} visitId={latestVisit.id} />}
        </div>
        <div ref={rightRailSpacerRef} className="relative">
        <div ref={rightRailContentRef} className="space-y-5" style={rightRailStyle || undefined}>
          {latestVisit && (
            <HakeemInsightPanel
              ref={humoralCluesRef}
              visitId={latestVisit.id}
              hasVitals={!!latestVisit.vitalSigns}
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
        <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
          {latestVisit && (
            <Button size="sm" variant="ghost" onClick={openReport} title="Print assessment report (opens in a new tab; shows saved data)">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          )}
          {latestVisit && (
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60 dark:border-destructive/40 dark:hover:bg-destructive/20 dark:hover:text-destructive" onClick={referPatient} disabled={savingStage}>
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

/**
 * One slim line under the signature card summarising the visit's referral —
 * urgency, destination, reason, notes, visit and time — with earlier
 * referrals (if any) tucked behind a "+N earlier" toggle.
 */
function ReferralLine({ visits, onEdit }: { onEdit?: () => void; visits: { id: string; visitCode?: string; referral?: { reason: string; referredTo: string; urgency: string; notes: string | null; createdAt: string } | null }[] }) {
  const [open, setOpen] = useState(false);
  const row = (v: (typeof visits)[number], first: boolean) => {
    const r = v.referral!;
    const when = `${daysAgo(r.createdAt)}, ${new Date(r.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
    const full = `Referred (${r.urgency}) to ${r.referredTo}. Reason: ${r.reason}.${r.notes ? ` Notes: ${r.notes}.` : ""} ${v.visitCode ? `Visit ${v.visitCode}, ` : ""}${when}`;
    return (
      <div key={v.id} title={full} className="flex items-center gap-2 min-w-0 text-sm">
        {first ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive text-white px-2 py-0.5 text-xs font-semibold shrink-0">
            <ShieldAlert className="h-3 w-3" /> Referred · {r.urgency}
          </span>
        ) : (
          <span className="rounded-full border border-destructive/30 text-destructive px-2 py-0.5 text-[11px] font-medium shrink-0">{r.urgency}</span>
        )}
        <span className="shrink-0"><span className="text-muted-foreground">to</span> <span className="font-semibold">{r.referredTo}</span></span>
        <span className="truncate min-w-0 text-muted-foreground">
          · <span className="text-foreground">{r.reason}</span>
          {r.notes && <> · Notes: <span className="text-foreground">{r.notes}</span></>}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground whitespace-nowrap">{v.visitCode ? `${v.visitCode} · ` : ""}{when}</span>
      </div>
    );
  };
  return (
    <div className="mb-6 -mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">{row(visits[0], true)}</div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-destructive/30 px-2 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
        {visits.length > 1 && (
          <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 text-xs font-medium text-destructive hover:underline">
            {open ? "Hide" : `+${visits.length - 1} earlier`}
          </button>
        )}
      </div>
      {open && <div className="border-t border-destructive/20 pt-1.5 space-y-1">{visits.slice(1).map((v) => row(v, false))}</div>}
    </div>
  );
}
