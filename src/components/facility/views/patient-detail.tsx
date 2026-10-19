"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { useDateLocale, useListFormat } from "@/lib/i18n/use-date-locale";
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
import { ReferralLine } from "@/components/facility/views/visit-findings";
import { useStickyRail } from "@/hooks/use-sticky-rail";
import { Card } from "@/components/ui/card";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
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
  const t = useTranslations("clinic.record");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const list = useListFormat();

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
      setLoadError(e.message || tc("network_error"));
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
      msg.warning(t("refresh_failed"), t("refresh_failed_hint", { error: e.message || tc("network_error") }), { retry: () => window.location.reload(), retryLabel: tc("reload") });
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
        <Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}
      </div>
    );
  }
  if (!patient) {
    return loadError ? <LoadFailed what={t("this_patient")} detail={loadError} onRetry={load} /> : <p className="text-muted-foreground text-sm">{t("not_found")}</p>;
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
      redFlagRef.current?.save(),
    ]);
    // The Chief Complaint Matrix save recomputes HumoralAssessment
    // server-side — the clues panel has no other way to learn its tile
    // percentages just went stale, since it only fetches once on mount.
    humoralCluesRef.current?.refresh();
    const sections = [t("sec_complaints"), t("sec_symptoms"), t("sec_note"), t("sec_redflags")];
    const failed = sections.filter((_, i) => results[i].status === "rejected");
    if (failed.length) {
      // Each section shows its own error in place; this sums it up by the buttons.
      msg.error(
        failed.length === 1 ? t("one_not_saved", { section: failed[0] }) : t("n_not_saved", { count: failed.length }),
        failed.length === 1 ? t("one_not_saved_hint") : t("n_not_saved_hint", { sections: list(failed) }),
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
      if (allSaved) msg.success(t("draft_saved"), t("saved_at", { time: new Date().toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" }) }));
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
        <ChevronLeft className="h-4 w-4" /> {t("back")}
      </button>

      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">{t("title")}</h1>
        <button
          onClick={() => router.push(`/facility/patients/${patientId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          {t("edit_registration")} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* This page IS the "Acute Vitals & Intake" step's workspace — vitals
          being recorded only unlocks the Proceed button below (already
          gated on checkInComplete separately), it doesn't mean the user has
          left this stage. Jumping the tracker to "Mizaj" while still on
          this page claimed a stage that hadn't actually started yet. */}
      <div data-tour="stage.tracker"><PatientStageTracker
        steps={PATIENT_JOURNEY_STEPS.map((s) => (s.key === "registration" ? { ...s, href: `/facility/patients/${patientId}` } : s))}
        activeKey="vitals"
        completedKeys={["registration"]}
      /></div>

      <div data-tour="stage.patient"><PatientSignatureCard
        patient={patient}
        visitCount={visits.length}
        lastAmaAt={amaVisits[0]?.amaDecline?.createdAt}
        onPhotoClick={() => setPhotoDialogOpen(true)}
        visits={sortedVisits}
      /></div>

      <PhotoUploadDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        currentPhoto={patient.photo}
        title={t("change_photo")}
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
              {t("ama_title")} {amaVisits.length > 1 && `(${amaVisits.length})`}
            </p>
          </div>
          <div className="space-y-2">
            {amaVisits.map((v) => (
              <div key={v.id} className="rounded-lg border border-amber-500/20 bg-background/60 p-3 text-sm">
                <p className="font-medium mb-1">{v.visitCode ? t("visit_code", { code: v.visitCode }) : t("visit")} · {daysAgo(v.amaDecline!.createdAt)}</p>
                <p><span className="text-muted-foreground">{t("ama_reason")}</span> {v.amaDecline!.reason}</p>
                {v.amaDecline!.patientReason && <p><span className="text-muted-foreground">{t("patient_reason")}</span> {v.amaDecline!.patientReason}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div data-tour="record.vitals"><VitalsPanel visits={visits} patientId={patientId} onSaved={refreshVisits} patientDob={patient.dob} patientGender={patient.gender} currentVisitId={latestVisit?.id} /></div>
          {latestVisit && (
            <div data-tour="stage.complaints"><ChiefComplaintMatrix
              ref={chiefComplaintRef}
              visitId={latestVisit.id}
              intakeComplaints={intakeComplaints}
            /></div>
          )}
          {latestVisit && <div data-tour="record.redflags"><RedFlagScreeningPanel ref={redFlagRef} visitId={latestVisit.id} onReferralChange={refreshVisits} /></div>}
          {latestVisit && <div data-tour="record.symptoms"><AcuteSymptomsPanel ref={acuteSymptomsRef} visitId={latestVisit.id} /></div>}
        </div>
        <div ref={rightRailSpacerRef} className="relative">
        <div ref={rightRailContentRef} className="space-y-5" style={rightRailStyle || undefined}>
          {latestVisit && (
            <div data-tour="stage.insight"><HakeemInsightPanel
              ref={humoralCluesRef}
              visitId={latestVisit.id}
              hasVitals={!!latestVisit.vitalSigns}
              onBeforeGenerate={async () => { await chiefComplaintRef.current?.save(); }}
            /></div>
          )}
          {latestVisit && <div data-tour="stage.note"><ResidentClinicalNote ref={residentNoteRef} visitId={latestVisit.id} /></div>}
          <TriageNotesCard visits={visits} />
        </div>
        </div>
      </div>

      <NoticeSlot state={msg} className="mb-3" />
      <Card data-tour="stage.actions" className={cn(
        "p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap",
        checkInComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50 bg-card/60"
      )}>
        <div className="flex items-center gap-2 shrink-0 flex-wrap ms-auto">
          {latestVisit && (
            <Button size="sm" variant="ghost" onClick={openReport} title={t("print_title")}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
          )}
          {latestVisit && (
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60 dark:border-destructive/40 dark:hover:bg-destructive/20 dark:hover:text-destructive" onClick={referPatient} disabled={savingStage}>
              <ShieldAlert className="h-3.5 w-3.5" /> {t("refer")}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={saveDraft} disabled={savingStage}>
            {savingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t("save_draft")}
          </Button>
          <Button size="sm" onClick={proceedToStage2} disabled={savingStage || !checkInComplete}>
            {savingStage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t("proceed")} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

    </div>
  );
}
