"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Printer, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageHeader, useStagePatient } from "@/components/facility/views/stage-frame";
import { HakeemInsightPanel } from "@/components/facility/views/hakeem-insight-panel";
import { ResidentClinicalNote, type ResidentClinicalNoteHandle } from "@/components/facility/views/resident-clinical-note";
import { TriageNotesCard } from "@/components/facility/views/triage-notes-card";
import { MizajHistoryCard } from "@/components/facility/views/mizaj-history-card";
import { Stage3FindingsCards } from "@/components/facility/views/stage3-findings";
import { Stage4AsbabCard } from "@/components/facility/views/stage4-findings";
import { useStickyRail } from "@/hooks/use-sticky-rail";
import { LoadFailed, NoticeSlot } from "@/components/shared/inline-notice";
import { savedAt } from "@/lib/flash";
import { TashkheesDossierPanel, useTashkhees } from "@/components/facility/views/tashkhees-dossier";
import { RedFlagScreeningPanel, type RedFlagScreeningPanelHandle } from "@/components/facility/views/red-flag-screening-panel";

/**
 * Stage 5 — Tashkhees & Handover Dossier. Same header as Stages 3–4; the
 * centre is the dossier (Dala'il, Tashkhees, Usool-e-Ilaj, Ilaj trinity,
 * prognosis & handover); the right column holds the complete assessment.
 */
export function TashkheesView({ patientId }: { patientId?: string }) {
  if (!patientId) {
    return (
      <Card className="p-6 border-border/50 bg-card/60 max-w-xl">
        <h2 className="font-serif text-lg font-semibold">Tashkhees &amp; Handover Dossier</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Open a patient from <Link href="/facility/patients" className="text-primary hover:underline">Patients</Link> and continue through the earlier stages to reach this one.
        </p>
      </Card>
    );
  }
  return <TashkheesStage key={patientId} patientId={patientId} />;
}

function TashkheesStage({ patientId }: { patientId: string }) {
  const { loading, patient, setPatient, visits, sortedVisits, latestVisit, loadError, reload, refreshVisits } = useStagePatient(patientId);
  const t = useTashkhees(latestVisit?.id);
  const router = useRouter();
  // Referral pop-up (shared with the earlier stages) — only its dialogs are rendered here.
  const referralRef = useRef<RedFlagScreeningPanelHandle>(null);
  // Right column — same as Stages 3–4, then Stage 4's findings, Resident Clinical Note last.
  const residentNoteRef = useRef<ResidentClinicalNoteHandle>(null);
  const { spacerRef, contentRef, style: railStyle } = useStickyRail(!loading);
  const saveNote = () => residentNoteRef.current?.save().then(() => true, () => false) ?? Promise.resolve(true);
  // Print icon → the full assessment report (now including this dossier), in a
  // new tab. Read-only: shows what's saved, so Save Draft first.
  const openReport = () => {
    if (!latestVisit) return;
    const url = `/facility/patients/${patientId}/record/report?visit=${latestVisit.id}`;
    if (!window.open(url, "_blank")) router.push(url);
  };
  const referPatient = () => {
    if (latestVisit?.referral) referralRef.current?.openEditReferral();
    else referralRef.current?.openReferDialog();
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!patient) return loadError ? <LoadFailed what="this patient" detail={loadError} onRetry={reload} /> : <p className="text-muted-foreground text-sm">Patient not found.</p>;

  const finalized = t.dossier.status === "finalized";
  const saveDraft = async () => {
    const [ok, note] = await Promise.all([t.save(false), saveNote()]);
    if (ok && note) t.msg.success("Draft saved", savedAt());
  };
  const finalize = async () => {
    if (!t.dossier.mizajAsli || !t.dossier.suMizajQuality) {
      const missing = [!t.dossier.mizajAsli && "Mizaj-e-Asli", !t.dossier.suMizajQuality && "Su-e-Mizaj"].filter(Boolean).join(" and ");
      t.msg.warning(`Record the ${missing} before finalising`, "Open the Tashkhees tab above — the diagnosis is needed for the handover.");
      return;
    }
    const [ok, note] = await Promise.all([t.save(true), saveNote()]);
    if (ok && note) t.msg.success(finalized ? "Finalised dossier updated" : "Dossier finalised and handed over", savedAt());
  };

  return (
    <div className="w-full">
      <StageHeader stage="handover" patientId={patientId} patient={patient} onPatientChange={setPatient} visits={visits} sortedVisits={sortedVisits} onEditReferral={() => referralRef.current?.openEditReferral()} />
      {latestVisit && <RedFlagScreeningPanel ref={referralRef} visitId={latestVisit.id} onReferralChange={refreshVisits} dialogsOnly />}

      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0">
          {latestVisit
            ? <TashkheesDossierPanel state={t} patientId={patientId} visitId={latestVisit.id} />
            : <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No visit recorded yet — complete the earlier stages first.</Card>}
        </div>
        <div ref={spacerRef} className="relative min-w-0">
          <div ref={contentRef} className="space-y-5" style={railStyle || undefined}>
            {latestVisit && <HakeemInsightPanel visitId={latestVisit.id} hasVitals={!!latestVisit.vitalSigns} />}
            <TriageNotesCard visits={visits} />
            <MizajHistoryCard patientId={patientId} />
            {latestVisit && <Stage3FindingsCards visitId={latestVisit.id} patientId={patientId} />}
            {latestVisit && <Stage4AsbabCard visitId={latestVisit.id} patientId={patientId} />}
            {latestVisit && <ResidentClinicalNote ref={residentNoteRef} visitId={latestVisit.id} />}
          </div>
        </div>
      </div>

      {/* Same action bar as the earlier stages; its messages sit right above it. */}
      <NoticeSlot state={t.msg} className="mb-3" />
      {latestVisit && (
        <Card className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
            <Button size="sm" variant="ghost" onClick={openReport} title="Print assessment report incl. this dossier (opens in a new tab; shows saved data — Save Draft first)">
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60 dark:border-destructive/40 dark:hover:bg-destructive/20 dark:hover:text-destructive" onClick={referPatient} disabled={t.saving !== null}>
              <ShieldAlert className="h-3.5 w-3.5" /> {latestVisit.referral ? "Edit Referral" : "Refer Patient"}
            </Button>
            <Button size="sm" variant="outline" onClick={saveDraft} disabled={t.saving !== null || !t.options}>
              {t.saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Draft
            </Button>
            <Button size="sm" onClick={finalize} disabled={t.saving !== null || !t.options}>
              {t.saving === "finalize" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {finalized ? "Update Finalised Dossier" : "Finalise Dossier & Hand Over"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
