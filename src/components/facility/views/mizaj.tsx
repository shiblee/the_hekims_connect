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
import { ClinicalRoutingPanel } from "@/components/facility/views/clinical-routing-panel";
import { HumoralCluesPanel, type HumoralCluesPanelHandle } from "@/components/facility/views/humoral-clues-panel";
import { ResidentClinicalNote, type ResidentClinicalNoteHandle } from "@/components/facility/views/resident-clinical-note";
import { TriageNotesCard } from "@/components/facility/views/triage-notes-card";
import { useStickyRail } from "@/hooks/use-sticky-rail";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { savedAt } from "@/lib/flash";
import { ArrowRight, Loader2, History, Stethoscope } from "lucide-react";

// Colours for the Mizaj History balance bar.
const AKHLAT = [
  { key: "dam", color: "oklch(0.62 0.2 25)" },
  { key: "saffra", color: "oklch(0.78 0.14 80)" },
  { key: "balgham", color: "oklch(0.7 0.13 220)" },
  { key: "sauda", color: "oklch(0.5 0.15 300)" },
] as const;

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
  const { loading, patient, setPatient, visits, sortedVisits, latestVisit, loadError, reload } = useStagePatient(patientId);
  const msg = useNotice();
  const [history, setHistory] = useState<Assessment[]>([]);
  const [saving, setSaving] = useState<"draft" | "proceed" | null>(null);
  const chiefComplaintRef = useRef<ChiefComplaintMatrixHandle>(null);
  const regionRef = useRef<AnatomicalRegionSelectorHandle>(null);
  const chronologyRef = useRef<OnsetChronologyPanelHandle>(null);
  // Live complaint durations from the matrix — drives the chronology auto-fill.
  const [complaintDurations, setComplaintDurations] = useState<ComplaintDuration[] | null>(null);
  const residentNoteRef = useRef<ResidentClinicalNoteHandle>(null);
  const humoralCluesRef = useRef<HumoralCluesPanelHandle>(null);
  const { spacerRef, contentRef, style: railStyle } = useStickyRail(!loading);

  const loadHistory = () =>
    api.get<{ assessments: Assessment[] }>(`/api/mizaj?patientId=${patientId}`).then((r) => setHistory(r.assessments || [])).catch(() => {});

  useEffect(() => { loadHistory(); }, [patientId]);
  // Stable reference — a new array each render would re-trigger the matrix's
  // load effect and wipe unsaved edits (same reason as on the Clinical Record).
  const intakeComplaints = useMemo(() => {
    try { return JSON.parse(latestVisit?.intake?.chiefComplaints || "[]"); } catch { return []; }
  }, [latestVisit]);

  /** Saves the anatomical regions, the senior doctor's chief-complaint edits and the clinical note. */
  const saveEdits = async () => {
    const sections = ["Anatomical Region", "Chief Complaint Matrix", "Onset & Chronology", "Resident Clinical Note"];
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

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  if (!patient) return loadError ? <LoadFailed what="this patient" detail={loadError} onRetry={reload} /> : <p className="text-muted-foreground text-sm">Patient not found.</p>;

  return (
    <div className="w-full">
      <StageHeader stage="mizaj" patientId={patientId} patient={patient} onPatientChange={setPatient} visits={visits} sortedVisits={sortedVisits} />

      <div className="mb-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {latestVisit && <AnatomicalRegionSelector ref={regionRef} visitId={latestVisit.id} patientGender={patient.gender} />}
          {latestVisit ? (
            <ChiefComplaintMatrix ref={chiefComplaintRef} visitId={latestVisit.id} intakeComplaints={intakeComplaints} onDurationsChange={setComplaintDurations} />
          ) : (
            <Card className="p-5 border-border/50 bg-card/60 text-sm text-muted-foreground">No visit recorded yet — complete Stage 2 first.</Card>
          )}
          {latestVisit && <OnsetChronologyPanel ref={chronologyRef} visitId={latestVisit.id} complaintDurations={complaintDurations} />}
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

      {/* Same action bar as Stage 2 (Clinical Record), so every stage ends the same way; its messages sit right above it. */}
      <NoticeSlot state={msg} className="mb-3" />
      <Card className="p-4 mb-6 flex flex-row items-center justify-between gap-3 flex-wrap border-emerald-500/30 bg-emerald-500/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Mizaj &amp; Morphometry — Doctor Assessment</p>
            <p className="text-xs text-muted-foreground">
              Regions, complaints &amp; chronology recorded · Next phase: Asbab-e-Sittah Review
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap ml-auto">
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
