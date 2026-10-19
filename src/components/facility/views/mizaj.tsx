"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { StageHeader, useStagePatient } from "@/components/facility/views/stage-frame";
import { ChiefComplaintMatrix, type ChiefComplaintMatrixHandle, type ComplaintDuration } from "@/components/facility/views/chief-complaint-matrix";
import { OnsetChronologyPanel, type OnsetChronologyPanelHandle } from "@/components/facility/views/onset-chronology-panel";
import { AnatomicalRegionSelector, type AnatomicalRegionSelectorHandle } from "@/components/facility/views/anatomical-region-selector";
import { HakeemInsightPanel, type HakeemInsightPanelHandle } from "@/components/facility/views/hakeem-insight-panel";
import { ResidentClinicalNote, type ResidentClinicalNoteHandle } from "@/components/facility/views/resident-clinical-note";
import { TriageNotesCard } from "@/components/facility/views/triage-notes-card";
import { RedFlagScreeningPanel, type RedFlagScreeningPanelHandle } from "@/components/facility/views/red-flag-screening-panel";
import { useStickyRail } from "@/hooks/use-sticky-rail";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { savedAt } from "@/lib/flash";
import { ArrowRight, Loader2, Printer, ShieldAlert } from "lucide-react";
import { MizajHistoryCard } from "@/components/facility/views/mizaj-history-card";

/**
 * Stage 3 — Mizaj & Morphometry. Arriving from the Clinical Record's
 * "Proceed to Mizaj Morphometry" (or picking a patient here) opens the
 * patient's Stage 3 workspace; with no patient it shows a picker.
 */
export function MizajView({ initialPatientId }: { initialPatientId?: string } = {}) {
  const router = useRouter();
  // The patient lives in the URL (?patientId=), so picking one is a navigation
  // and Back returns to the picker.
  if (initialPatientId) return <MizajStage key={initialPatientId} patientId={initialPatientId} />;
  return <PatientPicker onPick={(id) => router.push(`/facility/mizaj?patientId=${id}`)} />;
}

function PatientPicker({ onPick }: { onPick: (id: string) => void }) {
  const [patients, setPatients] = useState<{ id: string; name: string; mizaj: string | null }[]>([]);
  useEffect(() => {
    api.get<{ patients: any[] }>("/api/facility/patients").then((r) => setPatients(r.patients || [])).catch(() => {});
  }, []);
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold">Mizaj & Morphometry</h2>
        <p className="text-sm text-muted-foreground">Choose a patient to open their Stage 3 assessment.</p>
      </div>
      <Card className="p-5 border-border/50 bg-card/60">
        <Label className="text-[13px] uppercase tracking-wide text-muted-foreground">Select Patient</Label>
        <Select value="" onValueChange={onPick}>
          <SelectTrigger className="mt-1.5 bg-background/60"><SelectValue placeholder="Choose a patient…" /></SelectTrigger>
          <SelectContent>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name} {p.mizaj ? `· ${p.mizaj}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>
    </div>
  );
}

function MizajStage({ patientId }: { patientId: string }) {
  const router = useRouter();
  const { loading, patient, setPatient, visits, sortedVisits, latestVisit, loadError, reload, refreshVisits } = useStagePatient(patientId);
  const msg = useNotice();
  const [saving, setSaving] = useState<"draft" | "proceed" | null>(null);
  const chiefComplaintRef = useRef<ChiefComplaintMatrixHandle>(null);
  const regionRef = useRef<AnatomicalRegionSelectorHandle>(null);
  const chronologyRef = useRef<OnsetChronologyPanelHandle>(null);
  // Live complaint durations from the matrix — drives the chronology auto-fill.
  const [complaintDurations, setComplaintDurations] = useState<ComplaintDuration[] | null>(null);
  const residentNoteRef = useRef<ResidentClinicalNoteHandle>(null);
  const humoralCluesRef = useRef<HakeemInsightPanelHandle>(null);
  // Referral pop-up (shared with Stage 2) — only its dialogs are rendered here.
  const referralRef = useRef<RedFlagScreeningPanelHandle>(null);
  const { spacerRef, contentRef, style: railStyle } = useStickyRail(!loading);

  // Stable reference — a new array each render would re-trigger the matrix's
  // load effect and wipe unsaved edits (same reason as on the Clinical Record).
  const intakeComplaints = useMemo(() => {
    try { return JSON.parse(latestVisit?.intake?.chiefComplaints || "[]"); } catch { return []; }
  }, [latestVisit]);

  /** Saves the anatomical regions, the senior doctor's chief-complaint edits and the clinical note. */
  const saveEdits = async () => {
    const sections = ["Anatomical Region", "Main Complaints", "Onset & Chronology", "Resident Clinical Note"];
    const results = await Promise.allSettled([
      regionRef.current?.save(), chiefComplaintRef.current?.save(), chronologyRef.current?.save(), residentNoteRef.current?.save(),
    ]);
    // The matrix save recomputes the humoral assessment server-side.
    humoralCluesRef.current?.refresh();
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
    setSaving("draft");
    try {
      if (await saveEdits()) msg.success("Draft saved", savedAt());
    } finally {
      setSaving(null);
    }
  };

  // Saves everything, then hands over to Stage 4 — same pattern as Stage 2's
  // "Proceed to Mizaj Morphometry (Stage 3)".
  const proceedToAsbab = async () => {
    setSaving("proceed");
    try {
      if (await saveEdits()) router.push(`/facility/asbab?patientId=${patientId}`);
    } finally {
      setSaving(null);
    }
  };

  // Print icon → the Comprehensive Assessment Report (now including this
  // stage's findings), in a new tab. Read-only: it shows what's saved, so
  // Save Draft first to include edits made on this page.
  const openReport = () => {
    if (!latestVisit) return;
    const url = `/facility/patients/${patientId}/record/report?visit=${latestVisit.id}`;
    if (!window.open(url, "_blank")) router.push(url);
  };

  // Refer Patient — the same referral pop-up as Stage 2; if the visit is
  // already referred it opens that referral to edit or remove instead.
  const referPatient = () => {
    if (latestVisit?.referral) referralRef.current?.openEditReferral();
    else referralRef.current?.openReferDialog();
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!patient) return loadError ? <LoadFailed what="this patient" detail={loadError} onRetry={reload} /> : <p className="text-muted-foreground text-sm">Patient not found.</p>;

  return (
    <div className="w-full">
      <StageHeader stage="mizaj" patientId={patientId} patient={patient} onPatientChange={setPatient} visits={visits} sortedVisits={sortedVisits} onEditReferral={() => referralRef.current?.openEditReferral()} />
      {latestVisit && <RedFlagScreeningPanel ref={referralRef} visitId={latestVisit.id} onReferralChange={refreshVisits} dialogsOnly />}

      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {latestVisit && <div data-tour="mizaj.regions"><AnatomicalRegionSelector ref={regionRef} visitId={latestVisit.id} patientGender={patient.gender} /></div>}
          {latestVisit ? (
            <div data-tour="stage.complaints"><ChiefComplaintMatrix ref={chiefComplaintRef} visitId={latestVisit.id} intakeComplaints={intakeComplaints} onDurationsChange={setComplaintDurations} /></div>
          ) : (
            <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No visit recorded yet — complete Stage 2 first.</Card>
          )}
          {latestVisit && <div data-tour="mizaj.chronology"><OnsetChronologyPanel ref={chronologyRef} visitId={latestVisit.id} complaintDurations={complaintDurations} /></div>}
        </div>

        <div ref={spacerRef} className="relative">
          <div ref={contentRef} className="space-y-5" style={railStyle || undefined}>
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
            <MizajHistoryCard patientId={patientId} />
          </div>
        </div>
      </div>

      {/* Same action bar as Stage 2 (Clinical Record), so every stage ends the same way; its messages sit right above it. */}
      <NoticeSlot state={msg} className="mb-3" />
      <Card data-tour="stage.actions" className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
          {latestVisit && (
            <Button size="sm" variant="ghost" onClick={openReport} title="Print assessment report (opens in a new tab; shows saved data — Save Draft first to include new edits)">
              <Printer className="h-3.5 w-3.5" />
            </Button>
          )}
          {latestVisit && (
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60 dark:border-destructive/40 dark:hover:bg-destructive/20 dark:hover:text-destructive" onClick={referPatient} disabled={saving !== null}>
              <ShieldAlert className="h-3.5 w-3.5" /> {latestVisit.referral ? "Edit Referral" : "Refer Patient"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={saveDraft} disabled={saving !== null}>
            {saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Draft
          </Button>
          <Button size="sm" onClick={proceedToAsbab} disabled={saving !== null || !latestVisit}>
            {saving === "proceed" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Proceed to Asbab-e-Sittah Review (Stage 4) <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
