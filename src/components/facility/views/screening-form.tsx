"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { formatAge } from "@/lib/age";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InsightBody } from "@/components/shared/screening-insight-body";
import {
  ChevronLeft, Loader2, Save, IdCard, Sparkles, RotateCcw, Search, Mic, X,
} from "lucide-react";

interface ChiefComplaintT { id: string; key: string; label: string; labelLocal: string | null; category: string; active: boolean }
interface ScreeningConfig { complaints: ChiefComplaintT[] }

interface Patient {
  id: string; patientCode: string | null; name: string; gender: string | null; dob: string | null;
  bloodGroup: string | null; phone: string | null; avatarColor: string;
}
interface VisitInfo { id: string; visitCode: string; visitDate: string }
interface ScreeningResult { id: string; chiefComplaints: string; aiSummary: string | null }

export function ScreeningForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScreeningConfig | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [step, setStep] = useState<"complaints" | "results">("complaints");
  const [selectedComplaintIds, setSelectedComplaintIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const msg = useNotice();        // beside the Complete Screening button
  const voiceMsg = useNotice();   // under the complaint search box
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [complaintSearch, setComplaintSearch] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setVoiceSupported(!!Ctor);
  }, []);

  const toggleVoiceSearch = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      voiceMsg.info("Voice search isn't available in this browser", "Type the complaint instead — Chrome and Edge support voice search.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => setComplaintSearch(e.results[0][0].transcript);
    voiceMsg.clear();
    recognition.onerror = () => { setListening(false); voiceMsg.warning("Didn't catch that", "Check the microphone is allowed for this site, then tap the mic and speak again — or type the complaint."); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  useEffect(() => {
    Promise.all([
      api.get<ScreeningConfig>("/api/facility/screening/config"),
      api.get<{ visit: VisitInfo; patient: Patient; screening: ScreeningResult | null }>(`/api/facility/visits/${visitId}/screening`),
    ])
      .then(([cfg, data]) => {
        setConfig(cfg);
        setPatient(data.patient);
        setVisit(data.visit);
        if (data.screening) {
          setResult(data.screening);
          // chiefComplaints is stored as labels (for display) — re-derive the ids
          // from the config so editing can pre-select the same chips.
          const labels: string[] = JSON.parse(data.screening.chiefComplaints || "[]");
          setSelectedComplaintIds(cfg.complaints.filter((c) => labels.includes(c.label)).map((c) => c.id));
          setStep("results");
        }
      })
      .catch((e) => setLoadError(e.message || "Network error"))
      .finally(() => setLoading(false));
  }, [visitId]);

  // Active, not-yet-selected complaints — filtered by search, then grouped by
  // category so a long list stays easy to scan for a receptionist/junior doctor.
  const groupedComplaints = useMemo(() => {
    if (!config) return [];
    const q = complaintSearch.trim().toLowerCase();
    const matches = config.complaints.filter((c) => {
      if (!c.active || selectedComplaintIds.includes(c.id)) return false;
      if (!q) return true;
      return c.label.toLowerCase().includes(q) || (c.labelLocal || "").toLowerCase().includes(q);
    });
    const byCategory = new Map<string, ChiefComplaintT[]>();
    for (const c of matches) {
      const list = byCategory.get(c.category) || [];
      list.push(c);
      byCategory.set(c.category, list);
    }
    return Array.from(byCategory.entries());
  }, [config, complaintSearch, selectedComplaintIds]);

  const toggleComplaint = (id: string) => {
    const isSelecting = !selectedComplaintIds.includes(id);
    setSelectedComplaintIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    // Clear the search box on selection — otherwise it keeps showing the
    // typed query while the result list (filtered by that same query) only
    // ever narrows, making every other complaint look like it vanished.
    if (isSelecting) setComplaintSearch("");
  };

  const submit = async () => {
    if (selectedComplaintIds.length === 0) {
      msg.warning("Select at least one chief complaint", "Go Back to the complaint list and pick what the patient came in with.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ screening: ScreeningResult }>(`/api/facility/visits/${visitId}/screening`, {
        chiefComplaintIds: selectedComplaintIds,
      });
      setResult(res.screening);
      setStep("results"); // the results screen itself confirms completion
      msg.clear();
    } catch (e: any) {
      msg.error("The screening wasn't saved", `${e.message || "Network error"}. Your selection is still here — try again.`, { retry: submit, retryLabel: "Try again" });
    } finally {
      setSubmitting(false);
    }
  };

  const editScreening = () => {
    // Previously-recorded complaints are already loaded into
    // state (see the load effect above) — this just reopens the wizard on
    // top of them, so editing starts from what was actually last recorded
    // rather than a blank form.
    setStep("complaints");
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!patient || !visit || !config) {
    return loadError ? <LoadFailed what="this screening" detail={loadError} /> : <p className="text-muted-foreground text-sm">Visit not found.</p>;
  }

  return (
    <div className="w-full">
      <button onClick={() => router.push("/facility/patients")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Patients
      </button>

      <div className="mb-4">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">L1 Screening</h1>
      </div>

      {/* Patient header — single line, matches the vitals assessment page */}
      <Card className="p-3 mb-5 border-primary/30 bg-primary/5 flex flex-row items-center gap-3 overflow-x-auto">
        <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(patient.avatarColor))}>
          {initials(patient.name)}
        </div>
        <p className="text-sm font-semibold whitespace-nowrap shrink-0">{patient.name}</p>
        {patient.patientCode && (
          <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-[10px] flex items-center gap-1 shrink-0">
            <IdCard className="h-3 w-3" /> {patient.patientCode}
          </Badge>
        )}
        <div className="h-5 w-px bg-border shrink-0" />
        <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {patient.gender || "—"} · {formatAge(patient.dob)} · {patient.bloodGroup || "Blood group —"} · {patient.phone || "—"}
        </p>
        <div className="flex-1 min-w-4" />
        <div className="h-5 w-px bg-border shrink-0" />
        <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(visit.visitDate).toLocaleDateString()}</p>
      </Card>

      <AnimatePresence mode="wait">
      {step === "complaints" && (
        <motion.div key="complaints" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
        <Card className="relative overflow-hidden p-6 sm:p-8 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl gap-5">
          <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chief Complaint(s)</p>

          {selectedComplaintIds.length > 0 && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1.5">Selected</p>
              <div className="flex flex-wrap gap-2">
                {selectedComplaintIds.map((id) => {
                  const c = config.complaints.find((cc) => cc.id === id);
                  if (!c) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleComplaint(id)}
                      className="px-3 py-1.5 rounded-full text-sm border bg-primary text-primary-foreground border-primary flex items-center gap-1.5"
                    >
                      {c.label} <X className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={complaintSearch}
              onChange={(e) => setComplaintSearch(e.target.value)}
              placeholder="Search chief complaint…"
              className={cn("ps-9 bg-background/60", voiceSupported && "pe-10")}
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoiceSearch}
                aria-label="Search by voice"
                className={cn(
                  "absolute end-2.5 top-1/2 -translate-y-1/2 transition-colors",
                  listening ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>
          <NoticeSlot state={voiceMsg} />

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pe-1">
            {groupedComplaints.map(([category, items]) => (
              <div key={category}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{category}</p>
                <div className="flex flex-wrap gap-2">
                  {items.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleComplaint(c.id)}
                      className="px-3 py-1.5 rounded-full text-sm border bg-background/60 border-border/50 hover:border-primary/40 transition-colors"
                    >
                      {c.label}{c.labelLocal ? ` (${c.labelLocal})` : ""}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {groupedComplaints.length === 0 && (
              <p className="text-sm text-muted-foreground">No matching complaints{complaintSearch ? ` for "${complaintSearch}"` : ""}.</p>
            )}
          </div>

          <NoticeSlot state={msg} />
          <div className="flex items-center justify-end pt-2">
            <Button size="lg" onClick={submit} disabled={submitting || selectedComplaintIds.length === 0}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Complete Screening
            </Button>
          </div>
        </Card>
        </motion.div>
      )}

      {step === "results" && result && (
        <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <Card className="relative overflow-hidden p-6 sm:p-8 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl gap-5">
          <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screening Result</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedComplaintIds.map((id) => {
              const c = config.complaints.find((cc) => cc.id === id);
              return c ? <Badge key={id} variant="outline" className="text-xs">{c.label}</Badge> : null;
            })}
          </div>

          {result.aiSummary ? (
            <InsightBody aiSummary={result.aiSummary} flag={null} />
          ) : (
            <Card className="p-4 border-primary/20 bg-primary/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Hakeem Insight
              </p>
              <p className="text-sm text-muted-foreground">Hakeem Insight isn&apos;t configured for this portal yet.</p>
            </Card>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={editScreening}>
              <RotateCcw className="h-4 w-4" /> Edit Screening
            </Button>
            <Button onClick={() => router.push(`/facility/patients/${patient.id}/record`)}>
              Back to Patient
            </Button>
          </div>
        </Card>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
