"use client";

import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, FileSignature, Loader2, Printer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageHeader, useStagePatient } from "@/components/facility/views/stage-frame";
import { ClinicalSummaryColumn } from "@/components/facility/views/clinical-summary";
import { TashkheesDossierPanel, printDossier, useTashkhees } from "@/components/facility/views/tashkhees-dossier";

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
  const { loading, patient, setPatient, visits, sortedVisits, latestVisit } = useStagePatient(patientId);
  const t = useTashkhees(latestVisit?.id);

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!patient) return <p className="text-muted-foreground text-sm">Patient not found.</p>;

  const finalized = t.dossier.status === "finalized";
  const saveDraft = async () => { if (await t.save(false)) toast.success("Draft saved"); };
  const finalize = async () => {
    if (!t.dossier.mizajAsli || !t.dossier.suMizajQuality) {
      toast.error("Record the Mizaj-e-Asli and Su-e-Mizaj (Tashkhees tab) before finalising");
      return;
    }
    if (await t.save(true)) toast.success(finalized ? "Finalised dossier updated" : "Dossier finalised and handed over");
  };

  return (
    <div className="w-full">
      <StageHeader stage="handover" patientId={patientId} patient={patient} onPatientChange={setPatient} visits={visits} sortedVisits={sortedVisits} />

      <div className="mb-6 grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 min-w-0">
          {latestVisit
            ? <TashkheesDossierPanel state={t} patientId={patientId} visitId={latestVisit.id} />
            : <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No visit recorded yet — complete the earlier stages first.</Card>}
        </div>
        <div className="min-w-0">
          {latestVisit
            ? <ClinicalSummaryColumn visitId={latestVisit.id} showAsbab />
            : null}
        </div>
      </div>

      {/* Same action bar as the earlier stages. */}
      {latestVisit && (
        <Card className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              {finalized ? <CheckCircle2 className="h-5 w-5" /> : <FileSignature className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {finalized ? "Dossier Finalised & Handed Over" : "Tashkhees & Handover Dossier In Progress"}
                {t.dirty && <span className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400">· Unsaved changes</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {finalized && t.dossier.finalizedByName ? `Finalised by ${t.dossier.finalizedByName}` : "Diagnosis, treatment plan and handover for this visit"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
            <Button size="sm" variant="ghost" onClick={() => printDossier(t, patient)} title="Print dossier"><Printer className="h-3.5 w-3.5" /> Print</Button>
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
