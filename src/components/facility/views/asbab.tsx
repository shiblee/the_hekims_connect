"use client";

import Link from "next/link";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ArrowRight, Loader2, Printer, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AsbabAssessmentPanel, AsbabDriftCard, useAsbabAssessment } from "@/components/facility/views/asbab-assessment";
import { StageHeader, useStagePatient } from "@/components/facility/views/stage-frame";
import { HakeemInsightPanel, type HakeemInsightPanelHandle } from "@/components/facility/views/hakeem-insight-panel";
import { ResidentClinicalNote, type ResidentClinicalNoteHandle } from "@/components/facility/views/resident-clinical-note";
import { TriageNotesCard } from "@/components/facility/views/triage-notes-card";
import { MizajHistoryCard } from "@/components/facility/views/mizaj-history-card";
import { Stage3FindingsCards } from "@/components/facility/views/stage3-findings";
import { useStickyRail } from "@/hooks/use-sticky-rail";
import { RedFlagScreeningPanel, type RedFlagScreeningPanelHandle } from "@/components/facility/views/red-flag-screening-panel";
import { LoadFailed, NoticeSlot } from "@/components/shared/inline-notice";

/**
 * Stage 4 — Asbab-e-Sittah Review. Same header as Stage 3 (tracker, patient
 * signature card, recorded vitals); the centre is the Asbab-e-Sittah
 * assessment, the right column summarises everything recorded so far.
 */
export function AsbabView({ patientId }: { patientId?: string }) {
  const t = useTranslations("clinic.asbab");
  const ts = useTranslations("clinic.stage");
  if (!patientId) {
    return (
      <Card className="p-6 border-border/50 bg-card/60 max-w-xl">
        <h2 className="font-serif text-lg font-semibold">{ts("t_asbab")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t.rich("open_patient", { link: (c) => <Link href="/facility/patients" className="text-primary hover:underline">{c}</Link> })}
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
  // Right column — same cards as Stage 3, then Stage 3's own findings.
  const residentNoteRef = useRef<ResidentClinicalNoteHandle>(null);
  const insightRef = useRef<HakeemInsightPanelHandle>(null);
  const { spacerRef, contentRef, style: railStyle } = useStickyRail(!loading);
  const t = useTranslations("clinic.asbab");
  const ts = useTranslations("clinic.stage");
  const tc = useTranslations("common");
  const dl = useDateLocale();

  /** Saves the answers and the Resident Clinical Note together; false if either failed (each shows its own message). */
  const saveAll = async (complete: boolean) => {
    const [ok, note] = await Promise.all([
      asbab.save(complete),
      residentNoteRef.current?.save().then(() => true, () => false) ?? Promise.resolve(true),
    ]);
    return ok && note;
  };
  const saveDraft = async () => { if (await saveAll(false)) asbab.msg.success(ts("draft_saved"), ts("saved_at", { time: new Date().toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" }) })); };
  // Completes the review (required questions enforced here and on the
  // server), then hands over to Stage 5 — same pattern as Stages 2 and 3.
  const proceed = async () => {
    if (asbab.progress.missingRequired > 0) {
      const n = asbab.progress.missingRequired;
      asbab.msg.warning(
        t("missing", { count: n }),
        t("missing_hint"),
      );
      return;
    }
    if (await saveAll(true)) router.push(`/facility/tashkhees?patientId=${patientId}`);
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
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}</div>;
  }
  if (!patient) return loadError ? <LoadFailed what={ts("this_patient")} detail={loadError} onRetry={reload} /> : <p className="text-muted-foreground text-sm">{ts("not_found")}</p>;

  return (
    <div className="w-full">
      <StageHeader stage="asbab" patientId={patientId} patient={patient} onPatientChange={setPatient} visits={visits} sortedVisits={sortedVisits} onEditReferral={() => referralRef.current?.openEditReferral()} />
      {latestVisit && <RedFlagScreeningPanel ref={referralRef} visitId={latestVisit.id} onReferralChange={refreshVisits} dialogsOnly />}

      {/* Centre (2/3): the Asbab-e-Sittah assessment. Right (1/3): the same
          cards as Stage 3 (Hakeem Insight, triage notes, Mizaj history), then
          what was recorded at Stage 3 (body regions, onset & chronology), this
          stage's live humoral drift, and the Resident Clinical Note last. */}
      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0">
          {latestVisit
            ? <div data-tour="asbab.pillars"><AsbabAssessmentPanel state={asbab} visitId={latestVisit.id} /></div>
            : <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">{t("no_visit")}</Card>}
        </div>

        <div ref={spacerRef} className="relative min-w-0">
          <div ref={contentRef} className="space-y-5" style={railStyle || undefined}>
            {latestVisit && <div data-tour="stage.insight"><HakeemInsightPanel ref={insightRef} visitId={latestVisit.id} hasVitals={!!latestVisit.vitalSigns} /></div>}
            <TriageNotesCard visits={visits} />
            <MizajHistoryCard patientId={patientId} />
            {latestVisit && <Stage3FindingsCards visitId={latestVisit.id} patientId={patientId} />}
            {latestVisit && <div data-tour="asbab.drift"><AsbabDriftCard state={asbab} /></div>}
            {latestVisit && <div data-tour="stage.note"><ResidentClinicalNote ref={residentNoteRef} visitId={latestVisit.id} /></div>}
          </div>
        </div>
      </div>

      {/* Same action bar as Stages 2 and 3; its messages sit right above it. */}
      <NoticeSlot state={asbab.msg} className="mb-3" />
      {latestVisit && (
        <Card data-tour="stage.actions" className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 shrink-0 flex-wrap ms-auto">
            <Button size="sm" variant="ghost" onClick={openReport} title={t("print_title")}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60 dark:border-destructive/40 dark:hover:bg-destructive/20 dark:hover:text-destructive" onClick={referPatient} disabled={asbab.saving !== null}>
              <ShieldAlert className="h-3.5 w-3.5" /> {latestVisit.referral ? ts("edit_referral") : ts("refer")}
            </Button>
            <Button size="sm" variant="outline" onClick={saveDraft} disabled={asbab.saving !== null || !asbab.pillars}>
              {asbab.saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {ts("save_draft")}
            </Button>
            <Button size="sm" onClick={proceed} disabled={asbab.saving !== null || !asbab.pillars}>
              {asbab.saving === "complete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("to_handover")} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
