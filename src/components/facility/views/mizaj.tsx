"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { type VisitVitals } from "@/lib/vitals-trend";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PhotoUploadDialog } from "@/components/shared/photo-upload-dialog";
import { PatientStageTracker, PATIENT_JOURNEY_STEPS } from "@/components/facility/views/patient-stage-tracker";
import { PatientSignatureCard, RecordedVitalsStrip, type SignaturePatient } from "@/components/facility/views/patient-signature-card";
import { ChiefComplaintMatrix, type ChiefComplaintMatrixHandle } from "@/components/facility/views/chief-complaint-matrix";
import { AnatomicalRegionSelector, type AnatomicalRegionSelectorHandle } from "@/components/facility/views/anatomical-region-selector";
import { ClinicalRoutingPanel } from "@/components/facility/views/clinical-routing-panel";
import { HumoralCluesPanel, type HumoralCluesPanelHandle } from "@/components/facility/views/humoral-clues-panel";
import { ResidentClinicalNote, type ResidentClinicalNoteHandle } from "@/components/facility/views/resident-clinical-note";
import { TriageNotesCard } from "@/components/facility/views/triage-notes-card";
import { useStickyRail } from "@/hooks/use-sticky-rail";
import { toast } from "sonner";
import { Save, Loader2, History, ChevronLeft, Pencil } from "lucide-react";

// Colours for the Mizaj History balance bar.
const AKHLAT = [
  { key: "dam", color: "oklch(0.62 0.2 25)" },
  { key: "saffra", color: "oklch(0.78 0.14 80)" },
  { key: "balgham", color: "oklch(0.7 0.13 220)" },
  { key: "sauda", color: "oklch(0.5 0.15 300)" },
] as const;

interface Patient extends SignaturePatient { id: string; mizaj: string | null }
interface VisitRow {
  id: string; visitDate: string;
  vitalSigns: VisitVitals | null;
  intake?: { chiefComplaints: string } | null;
  referral?: { createdAt: string } | null;
  amaDecline?: { createdAt: string } | null;
}
interface Assessment {
  id: string; createdAt: string; result: string; pulse: string | null; notes: string | null;
  dam: number; saffra: number; balgham: number; sauda: number;
  patient?: { id: string; name: string } | null;
}

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
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Select Patient</Label>
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
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const chiefComplaintRef = useRef<ChiefComplaintMatrixHandle>(null);
  const regionRef = useRef<AnatomicalRegionSelectorHandle>(null);
  const residentNoteRef = useRef<ResidentClinicalNoteHandle>(null);
  const humoralCluesRef = useRef<HumoralCluesPanelHandle>(null);
  const { spacerRef, contentRef, style: railStyle } = useStickyRail(!loading);

  const loadHistory = () =>
    api.get<{ assessments: Assessment[] }>(`/api/mizaj?patientId=${patientId}`).then((r) => setHistory(r.assessments || [])).catch(() => {});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, v] = await Promise.all([
          api.get<{ patient: Patient }>(`/api/facility/patients/${patientId}`),
          api.get<{ visits: VisitRow[] }>(`/api/facility/visits?patientId=${patientId}`),
        ]);
        setPatient(p.patient);
        setVisits(v.visits || []);
      } catch (e: any) {
        toast.error(e.message || "Could not load this patient");
      } finally {
        setLoading(false);
      }
    })();
    loadHistory();
  }, [patientId]);

  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()),
    [visits],
  );
  const latestVisit = sortedVisits[0];
  // Stable reference — a new array each render would re-trigger the matrix's
  // load effect and wipe unsaved edits (same reason as on the Clinical Record).
  const intakeComplaints = useMemo(() => {
    try { return JSON.parse(latestVisit?.intake?.chiefComplaints || "[]"); } catch { return []; }
  }, [latestVisit]);

  const savePhoto = async (dataUrl: string | null) => {
    const res = await api.patch<{ patient: Patient }>(`/api/facility/patients/${patientId}`, { photo: dataUrl });
    setPatient(res.patient);
  };

  /** Saves the anatomical regions, the senior doctor's chief-complaint edits and the clinical note. */
  const saveEdits = async () => {
    const results = await Promise.allSettled([regionRef.current?.save(), chiefComplaintRef.current?.save(), residentNoteRef.current?.save()]);
    // The matrix save recomputes the humoral assessment server-side.
    humoralCluesRef.current?.refresh();
    return results.every((r) => r.status === "fulfilled");
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      if (await saveEdits()) toast.success("Draft saved");
    } finally {
      setSavingDraft(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!patient) return <p className="text-muted-foreground text-sm">Patient not found.</p>;

  const recordUrl = `/facility/patients/${patientId}/record`;
  const referred = sortedVisits.find((v) => v.referral);
  const ama = sortedVisits.find((v) => v.amaDecline);

  return (
    <div className="w-full">
      <button onClick={() => router.push(recordUrl)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Clinical Record
      </button>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">Mizaj & Morphometry</h1>
      </div>

      <PatientStageTracker
        steps={PATIENT_JOURNEY_STEPS.map((s) =>
          s.key === "registration" ? { ...s, href: `/facility/patients/${patientId}` }
            : s.key === "vitals" ? { ...s, href: recordUrl }
            : s)}
        activeKey="mizaj"
        completedKeys={["registration", "vitals"]}
      />

      <PatientSignatureCard
        patient={patient}
        visitCount={visits.length}
        lastReferralAt={referred?.referral?.createdAt}
        lastAmaAt={ama?.amaDecline?.createdAt}
        onPhotoClick={() => setPhotoDialogOpen(true)}
      >
        <RecordedVitalsStrip
          vitals={latestVisit?.vitalSigns ?? null}
          visits={sortedVisits}
          action={
            <button onClick={() => router.push(recordUrl)} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Pencil className="h-3 w-3" /> Edit in Clinical Record
            </button>
          }
        />
      </PatientSignatureCard>

      <PhotoUploadDialog
        open={photoDialogOpen}
        onOpenChange={setPhotoDialogOpen}
        currentPhoto={patient.photo}
        title="Change patient photo"
        onSave={(dataUrl) => savePhoto(dataUrl)}
        onRemove={() => savePhoto(null)}
      />

      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {latestVisit && <AnatomicalRegionSelector ref={regionRef} visitId={latestVisit.id} />}
          {latestVisit ? (
            <ChiefComplaintMatrix ref={chiefComplaintRef} visitId={latestVisit.id} intakeComplaints={intakeComplaints} />
          ) : (
            <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No visit recorded yet — complete Stage 2 first.</Card>
          )}

        </div>

        <div ref={spacerRef} className="relative">
          <div ref={contentRef} className="space-y-5" style={railStyle || undefined}>
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
            {history.length > 0 && (
            <Card className="p-5 border-border/50 bg-card/60">
              <div className="flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-primary" />
                <h3 className="font-serif text-base font-semibold">Mizaj History</h3>
              </div>
                <div className="space-y-3">
                  {history.map((a) => (
                    <div key={a.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-primary">{a.result.split(" — ")[0]}</p>
                        <span className="text-[10px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-1 h-1.5 rounded-full overflow-hidden mb-2">
                        {AKHLAT.map((k) => (
                          <div key={k.key} style={{ width: `${a[k.key]}%`, background: k.color }} />
                        ))}
                      </div>
                      {a.pulse && <p className="text-[11px] text-muted-foreground">Pulse: {a.pulse}</p>}
                    </div>
                  ))}
                </div>
            </Card>
            )}
          </div>
        </div>
      </div>

      <Card className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-border/50 bg-card/60">
        <p className="text-sm text-muted-foreground min-w-0">
          Saves the anatomical regions, chief-complaint changes and the clinical note for this visit.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={saveDraft} disabled={savingDraft}>
            {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Draft
          </Button>
        </div>
      </Card>
    </div>
  );
}
