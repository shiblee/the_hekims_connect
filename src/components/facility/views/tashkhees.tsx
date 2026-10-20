"use client";

import Link from "next/link";
import { useDateLocale, useListFormat } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
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
import { FloatingTextarea } from "@/components/shared/floating-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TashkheesDossierPanel, useTashkhees } from "@/components/facility/views/tashkhees-dossier";
import { RedFlagScreeningPanel, type RedFlagScreeningPanelHandle } from "@/components/facility/views/red-flag-screening-panel";
import { CaseReadinessCard, CaseSummaryPanel, useCaseContext } from "@/components/facility/views/case-context";

/**
 * Stage 5 — Tashkhees & Handover Dossier. Same header as Stages 3–4; the
 * centre is the dossier (Dala'il, Tashkhees, Usool-e-Ilaj, Ilaj trinity,
 * prognosis & handover); the right column holds the complete assessment.
 */
export function TashkheesView({ patientId }: { patientId?: string }) {
  const tr = useTranslations("clinic.stage5");
  const ts = useTranslations("clinic.stage");
  if (!patientId) {
    return (
      <Card className="p-6 border-border/50 bg-card/60 max-w-xl">
        <h2 className="font-serif text-lg font-semibold">{ts("t_handover")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tr.rich("open_patient", { link: (c) => <Link href="/facility/patients" className="text-primary hover:underline">{c}</Link> })}
        </p>
      </Card>
    );
  }
  return <TashkheesStage key={patientId} patientId={patientId} />;
}

function TashkheesStage({ patientId }: { patientId: string }) {
  const { loading, patient, setPatient, visits, sortedVisits, latestVisit, loadError, reload, refreshVisits } = useStagePatient(patientId);
  const t = useTashkhees(latestVisit?.id);
  // The sourced case picture (Khulasa) and readiness checks — refreshed after every save.
  const cc = useCaseContext(latestVisit?.id);
  const tr = useTranslations("clinic.stage5");
  const ts = useTranslations("clinic.stage");
  const ta = useTranslations("clinic.asbab");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const list = useListFormat();
  const savedAt = () => ts("saved_at", { time: new Date().toLocaleTimeString(dl, { hour: "numeric", minute: "2-digit" }) });
  const router = useRouter();
  // Referral pop-up (shared with the earlier stages) — only its dialogs are rendered here.
  const referralRef = useRef<RedFlagScreeningPanelHandle>(null);
  // Right column — same as Stages 3–4, then Stage 4's findings, Resident Clinical Note last.
  const residentNoteRef = useRef<ResidentClinicalNoteHandle>(null);
  // Amending a finalised dossier asks why; the reason is kept with the new version.
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
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
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}</div>;
  }
  if (!patient) return loadError ? <LoadFailed what={ts("this_patient")} detail={loadError} onRetry={reload} /> : <p className="text-muted-foreground text-sm">{ts("not_found")}</p>;

  const finalized = t.dossier.status === "finalized";
  const saveDraft = async () => {
    const [ok, note] = await Promise.all([t.save(false), saveNote()]);
    cc.reload();
    if (ok && note) t.msg.success(ts("draft_saved"), savedAt());
  };
  const finalize = async (reason?: string) => {
    if (finalized && reason === undefined) { setAmendReason(""); setAmendOpen(true); return; }
    if (!t.dossier.mizajAsli || !t.dossier.suMizajQuality) {
      const missing = list([!t.dossier.mizajAsli && "Mizaj-e-Asli", !t.dossier.suMizajQuality && "Su-e-Mizaj"].filter(Boolean) as string[]);
      t.msg.warning(tr("need_diag", { items: missing }), tr("need_diag_hint"));
      return;
    }
    if (t.safety === "failed" || t.safety === "checking") {
      t.msg.warning(tr("need_safety"), tr("need_safety_hint"));
      return;
    }
    const [ok, note] = await Promise.all([t.save(true, reason), saveNote()]);
    cc.reload();
    if (ok) setAmendOpen(false);
    if (ok && note) t.msg.success(finalized ? tr("final_updated") : tr("finalised"), savedAt());
  };

  return (
    <div className="w-full">
      <StageHeader stage="handover" patientId={patientId} patient={patient} onPatientChange={setPatient} visits={visits} sortedVisits={sortedVisits} onEditReferral={() => referralRef.current?.openEditReferral()} />
      {latestVisit && <RedFlagScreeningPanel ref={referralRef} visitId={latestVisit.id} onReferralChange={refreshVisits} dialogsOnly />}

      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 min-w-0 space-y-5">
          {latestVisit && <CaseSummaryPanel state={cc} />}
          {latestVisit
            ? <div data-tour="dossier.panel"><TashkheesDossierPanel state={t} patientId={patientId} visitId={latestVisit.id} /></div>
            : <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">{ta("no_visit")}</Card>}
        </div>
        <div ref={spacerRef} className="relative min-w-0">
          <div ref={contentRef} className="space-y-5" style={railStyle || undefined}>
            {latestVisit && <CaseReadinessCard state={cc} />}
            {latestVisit && <div data-tour="stage.insight"><HakeemInsightPanel visitId={latestVisit.id} hasVitals={!!latestVisit.vitalSigns} /></div>}
            <TriageNotesCard visits={visits} />
            <MizajHistoryCard patientId={patientId} />
            {latestVisit && <Stage3FindingsCards visitId={latestVisit.id} patientId={patientId} />}
            {latestVisit && <Stage4AsbabCard visitId={latestVisit.id} patientId={patientId} />}
            {latestVisit && <div data-tour="stage.note"><ResidentClinicalNote ref={residentNoteRef} visitId={latestVisit.id} /></div>}
          </div>
        </div>
      </div>

      {/* Same action bar as the earlier stages; its messages sit right above it. */}
      <NoticeSlot state={t.msg} className="mb-3" />
      {latestVisit && (
        <Card data-tour="stage.actions" className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-2 shrink-0 flex-wrap ms-auto">
            <Button size="sm" variant="ghost" onClick={openReport} title={tr("print_title")}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/60 dark:border-destructive/40 dark:hover:bg-destructive/20 dark:hover:text-destructive" onClick={referPatient} disabled={t.saving !== null}>
              <ShieldAlert className="h-3.5 w-3.5" /> {latestVisit.referral ? ts("edit_referral") : ts("refer")}
            </Button>
            {!finalized && (
              <Button size="sm" variant="outline" onClick={saveDraft} disabled={t.saving !== null || !t.options}>
                {t.saving === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {ts("save_draft")}
              </Button>
            )}
            <Button size="sm" onClick={() => finalize()} disabled={t.saving !== null || !t.options}>
              {t.saving === "finalize" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {finalized ? tr("amend") : tr("finalise")}
            </Button>
          </div>
        </Card>
      )}
      <Dialog open={amendOpen} onOpenChange={setAmendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr("amend_title")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{tr("amend_info")}</p>
          <FloatingTextarea id="amendReason" label={tr("amend_reason")} required value={amendReason} onChange={(e) => setAmendReason(e.target.value)} rows={3} />
          <NoticeSlot state={t.msg} />
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setAmendOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={() => finalize(amendReason.trim())} disabled={t.saving !== null || amendReason.trim().length < 3}>
              {t.saving === "finalize" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {tr("amend_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
