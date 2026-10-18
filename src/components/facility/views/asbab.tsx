"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ArrowRight, Loader2, Printer, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AsbabAssessmentPanel, AsbabDriftCard, useAsbabAssessment } from "@/components/facility/views/asbab-assessment";
import { StageHeader, useStagePatient } from "@/components/facility/views/stage-frame";
import { ClinicalSummaryColumn } from "@/components/facility/views/clinical-summary";
import { RedFlagScreeningPanel, type RedFlagScreeningPanelHandle } from "@/components/facility/views/red-flag-screening-panel";
import { LoadFailed, NoticeSlot } from "@/components/shared/inline-notice";
import { savedAt } from "@/lib/flash";

/**
 * Stage 4 — Asbab-e-Sittah Review. Same header as Stage 3 (tracker, patient
 * signature card, recorded vitals); the centre is the Asbab-e-Sittah
 * assessment, the right column summarises everything recorded so far.
 */
export function AsbabView({ patientId }: { patientId?: string }) {
  if (!patientId) {
    return (
      <Card className="p-6 border-border/50 bg-card/60 max-w-xl">
        <h2 className="font-serif text-lg font-semibold">Asbab-e-Sittah Review</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Open a patient from <Link href="/facility/patients" className="text-primary hover:underline">Patients</Link> and continue through Mizaj &amp; Morphometry to reach this stage.
        </p>
      </Card>
    );
  }
  return <AsbabStage key={patientId} patientId={patientId} />;
}

function AsbabStage({ patientId }: { patientId: string }) {
  const { loading, patient, setPatient, visits, sortedVisits, latestVisit, loadError, reload, refreshVisits } = useStagePatient(patientId);
  // Referral pop-up (shared with Stages 2 and 3) — only its dialogs are rendered here.
  const referralRef = useRef<RedFlagScreeningPanelHandle>(null);
  const asbab = useAsbabAssessment(latestVisit?.id);
  const router = useRouter();

  const saveDraft = async () => { if (await asbab.save(false)) asbab.msg.success("Draft saved", savedAt()); };
  // Completes the review (required questions enforced here and on the
  // server), then hands over to Stage 5 — same pattern as Stages 2 and 3.
  const proceed = async () => {
    if (asbab.progress.missingRequired > 0) {
      const n = asbab.progress.missingRequired;
      asbab.msg.warning(
        `${n} required question${n === 1 ? " is" : "s are"} still unanswered`,
        "Pillars with an amber dot in the tabs above still have some. Answer them, then proceed to Stage 5.",
      );
      return;
    }
    if (await asbab.save(true)) router.push(`/facility/tashkhees?patientId=${patientId}`);
  };

  // Print icon → the assessment report in a new tab (read-only: shows what's
  // saved, so Save Draft first to include new answers).
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

  return (
    <div className="w-full">
      <StageHeader stage="asbab" patientId={patientId} patient={patient} onPatientChange={setPatient} visits={visits} sortedVisits={sortedVisits} onEditReferral={() => referralRef.current?.openEditReferral()} />
      {latestVisit && <RedFlagScreeningPanel ref={referralRef} visitId={latestVisit.id} onReferralChange={refreshVisits} dialogsOnly />}

      {/* Centre (2/3): the Asbab-e-Sittah assessment. Right (1/3): everything
          recorded so far, grouped by who assessed it — same column split as
          Stages 2 and 3. */}
      <div className="mb-6 grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 min-w-0">
          {latestVisit
            ? <AsbabAssessmentPanel state={asbab} />
            : <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No visit recorded yet — complete the earlier stages first.</Card>}
        </div>

        <div className="min-w-0 space-y-4">
          {latestVisit && <AsbabDriftCard state={asbab} />}
          {latestVisit
            ? <ClinicalSummaryColumn visitId={latestVisit.id} />
            : <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No visit recorded yet — complete the earlier stages first.</Card>}
        </div>
      </div>

      {/* Same action bar as Stages 2 and 3; its messages sit right above it. */}
      <NoticeSlot state={asbab.msg} className="mb-3" />
      {latestVisit && (
        <Card className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
            <Button size="sm" variant="ghost" onClick={openReport} title="Print assessment report (opens in a new tab; shows saved data — Save Draft first to include new answers)">
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60 dark:border-destructive/40 dark:hover:bg-destructive/20 dark:hover:text-destructive" onClick={referPatient} disabled={asbab.saving !== null}>
              <ShieldAlert className="h-3.5 w-3.5" /> {latestVisit.referral ? "Edit Referral" : "Refer Patient"}
            </Button>
            <Button size="sm" variant="outline" onClick={saveDraft} disabled={asbab.saving !== null || !asbab.pillars}>
              {asbab.saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Save Draft
            </Button>
            <Button size="sm" onClick={proceed} disabled={asbab.saving !== null || !asbab.pillars}>
              {asbab.saving === "complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Proceed to Tashkhees &amp; Handover Dossier (Stage 5) <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
