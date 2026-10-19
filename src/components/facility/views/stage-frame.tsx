"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { type VisitVitals } from "@/lib/vitals-trend";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { PatientStageTracker, PATIENT_JOURNEY_STEPS } from "@/components/facility/views/patient-stage-tracker";
import { PatientSignatureCard, RecordedVitalsStrip, type SignaturePatient } from "@/components/facility/views/patient-signature-card";
import { ReferralLine, TriageFindingsLine } from "@/components/facility/views/visit-findings";
import { ChevronLeft, Pencil } from "lucide-react";

export interface StagePatient extends SignaturePatient { id: string; mizaj: string | null }
export interface StageVisit {
  id: string; visitDate: string; visitCode?: string;
  vitalSigns: VisitVitals | null;
  doctor?: { name: string } | null;
  intake?: { chiefComplaints: string; allergies?: string; medications?: string; onsetTimeline?: string | null; mobility?: string | null } | null;
  referral?: { reason: string; referredTo: string; urgency: string; notes: string | null; createdAt: string } | null;
  redFlagScreening?: { outcome: string; answers: { criterionLabel: string; present: boolean }[] } | null;
  acuteSymptomAssessment?: { symptoms: string } | null;
  amaDecline?: { createdAt: string } | null;
}

/** Loads the patient and their visits (newest first) for a clinical stage page. */
export function useStagePatient(patientId: string) {
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<StagePatient | null>(null);
  const [visits, setVisits] = useState<StageVisit[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const tc = useTranslations("common");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ patient: StagePatient }>(`/api/facility/patients/${patientId}`),
      api.get<{ visits: StageVisit[] }>(`/api/facility/visits?patientId=${patientId}`),
    ])
      .then(([p, v]) => { if (!cancelled) { setLoadError(null); setPatient(p.patient); setVisits(v.visits || []); } })
      .catch((e) => { if (!cancelled) setLoadError(e.message || tc("network_error")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, reloadTick]);
  const reload = () => { setLoading(true); setLoadError(null); setReloadTick((t) => t + 1); };
  /** Re-fetch the visits in place (no loading screen), so unsaved edits on the page survive. */
  const refreshVisits = () =>
    api.get<{ visits: StageVisit[] }>(`/api/facility/visits?patientId=${patientId}`).then((v) => setVisits(v.visits || [])).catch(() => {});

  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()),
    [visits],
  );
  return { loading, patient, setPatient, visits, sortedVisits, latestVisit: sortedVisits[0] as StageVisit | undefined, loadError, reload, refreshVisits };
}

type StageKey = "mizaj" | "asbab" | "handover";

/**
 * Shared top of the doctor stages (3 onward): back link, title, stage tracker
 * with links to earlier stages, and the patient signature card with the
 * vitals recorded at Stage 2.
 */
export function StageHeader({ stage, patientId, patient, onPatientChange, visits, sortedVisits, onEditReferral }: {
  stage: StageKey;
  patientId: string;
  patient: StagePatient;
  onPatientChange: (p: StagePatient) => void;
  visits: StageVisit[];
  sortedVisits: StageVisit[];
  /** Edit the referral right here (opens the referral pop-up) instead of linking back to the Clinical Record. */
  onEditReferral?: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("clinic.stage");
  const [photoOpen, setPhotoOpen] = useState(false);
  const recordUrl = `/facility/patients/${patientId}/record`;
  const stageUrls: Record<string, string> = {
    registration: `/facility/patients/${patientId}`,
    vitals: recordUrl,
    mizaj: `/facility/mizaj?patientId=${patientId}`,
    asbab: `/facility/asbab?patientId=${patientId}`,
  };
  const order = PATIENT_JOURNEY_STEPS.map((s) => s.key);
  const completed = order.slice(0, order.indexOf(stage));
  const back = stage === "mizaj"
    ? { href: recordUrl, label: t("back_record") }
    : stage === "asbab"
      ? { href: stageUrls.mizaj, label: t("back_mizaj") }
      : { href: stageUrls.asbab, label: t("back_asbab") };

  const savePhoto = async (dataUrl: string | null) => {
    const res = await api.patch<{ patient: StagePatient }>(`/api/facility/patients/${patientId}`, { photo: dataUrl });
    onPatientChange(res.patient);
  };

  const latest = sortedVisits[0];
  return (
    <>
      <button onClick={() => router.push(back.href)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> {back.label}
      </button>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">{t(`t_${stage}`)}</h1>
      </div>

      <div data-tour="stage.tracker"><PatientStageTracker
        steps={PATIENT_JOURNEY_STEPS.map((s) => (completed.includes(s.key) && stageUrls[s.key] ? { ...s, href: stageUrls[s.key] } : s))}
        activeKey={stage}
        completedKeys={completed}
      /></div>

      <div data-tour="stage.patient"><PatientSignatureCard
        patient={patient}
        visitCount={visits.length}
        lastAmaAt={sortedVisits.find((v) => v.amaDecline)?.amaDecline?.createdAt}
        onPhotoClick={() => setPhotoOpen(true)}
        visits={sortedVisits}
      >
        <RecordedVitalsStrip
          vitals={latest?.vitalSigns ?? null}
          visits={sortedVisits}
          action={
            <button onClick={() => router.push(recordUrl)} className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline">
              <Pencil className="h-3 w-3" /> {t("edit_in_record")}
            </button>
          }
        />
      </PatientSignatureCard></div>

      {/* What triage recorded — the referral (if any) and the findings the main doctor must see. */}
      {sortedVisits.some((v) => v.referral) && (
        <ReferralLine visits={sortedVisits.filter((v) => v.referral)} onEdit={latest?.referral ? onEditReferral : undefined} editHref={latest?.referral && !onEditReferral ? recordUrl : undefined} className="mb-3 -mt-3" />
      )}
      {latest && (
        <TriageFindingsLine
          visit={latest}
          editHref={latest.referral ? undefined : recordUrl}
          className={sortedVisits.some((v) => v.referral) ? "mb-6" : undefined}
        />
      )}

      <PhotoUploadDialog
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        currentPhoto={patient.photo}
        title={t("change_photo")}
        onSave={(dataUrl) => savePhoto(dataUrl)}
        onRemove={() => savePhoto(null)}
      />
    </>
  );
}
