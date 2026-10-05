"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { formatAge } from "@/lib/age";
import { questionApplies } from "@/lib/screening-eligibility";
import { flagForAnswer, computeOverallFlag, type FlagQuestion, type FlagSeverity } from "@/lib/screening-flags";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { FloatingField } from "@/components/shared/floating-field";
import {
  ChevronLeft, Loader2, Save, IdCard, Sparkles, ShieldAlert, Info,
  ArrowRight, ArrowLeft, RotateCcw, Search, Mic, X,
  CheckCircle2, CircleDot,
} from "lucide-react";

interface ScreeningOption { id: string; label: string; labelLocal: string | null; flagSeverity: string | null }
interface ScreeningQuestion {
  id: string; label: string; labelLocal: string | null; instructionText: string | null; type: string;
  active: boolean; applicableGender: string | null; minAgeDays: number | null; maxAgeDays: number | null;
  numericOperator: string | null; numericThreshold: number | null; numericFlagSeverity: string | null;
  numericOperator2: string | null; numericThreshold2: number | null; numericFlagSeverity2: string | null;
  options: ScreeningOption[];
}
interface ScreeningModuleT { id: string; key: string; label: string; active: boolean; triggerComplaintIds: string[]; questions: ScreeningQuestion[] }
interface ChiefComplaintT { id: string; key: string; label: string; labelLocal: string | null; category: string; active: boolean }
interface ScreeningConfig { complaints: ChiefComplaintT[]; modules: ScreeningModuleT[] }

interface Patient {
  id: string; patientCode: string | null; name: string; gender: string | null; dob: string | null;
  bloodGroup: string | null; phone: string | null; avatarColor: string;
}
interface VisitInfo { id: string; visitCode: string; visitDate: string }
interface AnswerRow { id: string; questionId: string | null; questionLabel: string; value: string; flagTriggered: string | null }
interface ScreeningResult { id: string; chiefComplaints: string; overallFlag: string | null; aiSummary: string | null; answers: AnswerRow[] }

const FLAG_STYLE: Record<string, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};
const FLAG_LABEL: Record<string, string> = { red: "High Risk", yellow: "Needs Review", green: "Low Risk" };
const FLAG_DOT: Record<string, string> = { red: "bg-destructive", yellow: "bg-amber-400", green: "bg-emerald-500" };

export function ScreeningForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ScreeningConfig | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [step, setStep] = useState<"complaints" | "questions" | "results">("complaints");
  const [selectedComplaintIds, setSelectedComplaintIds] = useState<string[]>([]);
  const [answerValues, setAnswerValues] = useState<Record<string, string | string[] | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScreeningResult | null>(null);
  const [complaintSearch, setComplaintSearch] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [activeComplaintId, setActiveComplaintId] = useState<string | null>(null);
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
      toast.error("Voice search isn't supported in this browser");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e: any) => setComplaintSearch(e.results[0][0].transcript);
    recognition.onerror = () => { setListening(false); toast.error("Could not capture voice input"); };
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
          // from the config so the "Retake" flow can pre-select the same chips.
          const labels: string[] = JSON.parse(data.screening.chiefComplaints || "[]");
          setSelectedComplaintIds(cfg.complaints.filter((c) => labels.includes(c.label)).map((c) => c.id));
          setStep("results");
        }
      })
      .catch(() => toast.error("Could not load this screening"))
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

  const triggeredModules = useMemo(() => {
    if (!config) return [];
    return config.modules.filter((m) => m.active && m.triggerComplaintIds.some((id) => selectedComplaintIds.includes(id)));
  }, [config, selectedComplaintIds]);

  const applicableQuestions = useMemo(() => {
    if (!patient) return [];
    const list: { module: ScreeningModuleT; question: ScreeningQuestion }[] = [];
    for (const m of triggeredModules) {
      for (const q of m.questions) {
        if (q.active && questionApplies(q, patient)) list.push({ module: m, question: q });
      }
    }
    return list;
  }, [triggeredModules, patient]);

  // Live, client-side flag preview as the doctor fills the form — reuses the
  // exact same pure function the server uses to compute the final flags, so
  // what's shown here always matches what submit() will actually save.
  const liveFlags = useMemo(() => {
    const map: Record<string, FlagSeverity | null> = {};
    for (const { question: q } of applicableQuestions) {
      const value = answerValues[q.id];
      if (value === undefined || value === "") continue;
      map[q.id] = flagForAnswer(q as FlagQuestion, value);
    }
    return map;
  }, [applicableQuestions, answerValues]);

  const liveOverallFlag = useMemo(() => computeOverallFlag(Object.values(liveFlags)), [liveFlags]);

  const answerableQuestions = useMemo(() => applicableQuestions.filter(({ question: q }) => q.type !== "instruction"), [applicableQuestions]);
  const answeredCount = useMemo(
    () => answerableQuestions.filter(({ question: q }) => answerValues[q.id] !== undefined && answerValues[q.id] !== "").length,
    [answerableQuestions, answerValues]
  );

  // Questions bucketed per selected complaint, so the left nav can route to
  // each complaint's own question set and show its own completion state.
  const questionsByComplaint = useMemo(() => {
    const map: Record<string, { module: ScreeningModuleT; question: ScreeningQuestion }[]> = {};
    for (const id of selectedComplaintIds) {
      map[id] = applicableQuestions.filter(({ module: m }) => m.triggerComplaintIds.includes(id));
    }
    return map;
  }, [selectedComplaintIds, applicableQuestions]);

  const complaintProgress = useMemo(() => {
    const map: Record<string, { answered: number; total: number; flag: FlagSeverity | null }> = {};
    for (const id of selectedComplaintIds) {
      const qs = (questionsByComplaint[id] || []).filter(({ question: q }) => q.type !== "instruction");
      const answered = qs.filter(({ question: q }) => answerValues[q.id] !== undefined && answerValues[q.id] !== "").length;
      const flags = qs.map(({ question: q }) => liveFlags[q.id]).filter((f): f is FlagSeverity => !!f);
      map[id] = { answered, total: qs.length, flag: computeOverallFlag(flags) };
    }
    return map;
  }, [selectedComplaintIds, questionsByComplaint, answerValues, liveFlags]);

  const activeComplaint = activeComplaintId && selectedComplaintIds.includes(activeComplaintId) ? activeComplaintId : selectedComplaintIds[0];
  const activeQuestions = questionsByComplaint[activeComplaint] || [];
  const activeModules = useMemo(() => {
    const seen = new Set<string>();
    const list: ScreeningModuleT[] = [];
    for (const { module: m } of activeQuestions) {
      if (!seen.has(m.id)) { seen.add(m.id); list.push(m); }
    }
    return list;
  }, [activeQuestions]);

  const toggleComplaint = (id: string) => {
    setSelectedComplaintIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (selectedComplaintIds.length === 0) {
      toast.error("Select at least one chief complaint");
      return;
    }
    const answers = applicableQuestions
      .filter(({ question }) => question.type !== "instruction")
      .map(({ question }) => ({ questionId: question.id, value: answerValues[question.id] }))
      .filter((a) => a.value !== undefined && a.value !== "");

    setSubmitting(true);
    try {
      const res = await api.post<{ screening: ScreeningResult }>(`/api/facility/visits/${visitId}/screening`, {
        chiefComplaintIds: selectedComplaintIds, answers,
      });
      setResult(res.screening);
      setStep("results");
      toast.success("Screening complete");
    } catch (e: any) {
      toast.error(e.message || "Could not save the screening");
    } finally {
      setSubmitting(false);
    }
  };

  const retake = () => {
    setAnswerValues({});
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
    return <p className="text-muted-foreground text-sm">Visit not found.</p>;
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
        <Card className="relative overflow-hidden p-6 sm:p-8 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl space-y-5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step 1 — Chief Complaint(s)</p>

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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={complaintSearch}
              onChange={(e) => setComplaintSearch(e.target.value)}
              placeholder="Search chief complaint…"
              className={cn("pl-9 bg-background/60", voiceSupported && "pr-10")}
            />
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoiceSearch}
                aria-label="Search by voice"
                className={cn(
                  "absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors",
                  listening ? "text-destructive animate-pulse" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
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

          <div className="flex items-center justify-end pt-2">
            <Button size="lg" onClick={() => setStep("questions")} disabled={selectedComplaintIds.length === 0}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
        </motion.div>
      )}

      {step === "questions" && (
        <motion.div key="questions" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
        <Card className="relative overflow-hidden p-5 sm:p-7 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl space-y-4">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assessment</p>
              {liveOverallFlag && (
                <Badge variant="outline" className={cn("border flex items-center gap-1 animate-in fade-in", FLAG_STYLE[liveOverallFlag])}>
                  <ShieldAlert className="h-3 w-3" /> {FLAG_LABEL[liveOverallFlag] || liveOverallFlag}
                </Badge>
              )}
            </div>

            {answerableQuestions.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Progress</span>
                  <span>{answeredCount} of {answerableQuestions.length} answered</span>
                </div>
                <Progress value={(answeredCount / answerableQuestions.length) * 100} className="h-1.5" />
              </div>
            )}
          </div>

          {applicableQuestions.length === 0 && (
            <p className="text-sm text-muted-foreground">No follow-up questions are configured for this complaint yet.</p>
          )}

          {applicableQuestions.length > 0 && (
            <div className="flex gap-8 items-start">
              {/* Left nav — fixed in place (sticky), does not scroll with the
                  question list on the right; one entry per selected complaint. */}
              <div className="w-60 shrink-0 sticky top-4 self-start space-y-1.5">
                {selectedComplaintIds.map((id) => {
                  const c = config.complaints.find((cc) => cc.id === id);
                  if (!c) return null;
                  const prog = complaintProgress[id];
                  const isActive = id === activeComplaint;
                  const done = prog && prog.total > 0 && prog.answered === prog.total;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveComplaintId(id)}
                      className={cn(
                        "w-full flex items-start gap-1.5 px-3 py-2.5 rounded-lg text-left text-sm transition-colors",
                        isActive ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span className="flex-1 leading-snug">{c.label}</span>
                      <span className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {prog?.flag && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", FLAG_DOT[prog.flag])} />}
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : prog && prog.total > 0 ? (
                          <span className="text-[10px] text-muted-foreground shrink-0">{prog.answered}/{prog.total}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right panel — all of the active complaint's questions at once,
                  no per-question cards/borders; just relaxed vertical rhythm. */}
              <div className="flex-1 min-w-0 space-y-5">
                {activeQuestions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No follow-up questions are configured for this complaint yet.</p>
                )}
                {activeModules.map((m) => (
                  <div key={m.id} className="space-y-4">
                    {activeModules.length > 1 && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">{m.label}</p>
                    )}
                    {activeQuestions.filter(({ module: qm }) => qm.id === m.id).map(({ question: q }) => {
                      const flag = liveFlags[q.id];
                      return (
                        <div key={q.id} className={cn("py-1", flag && "border-l-2 pl-3 -ml-3", flag && FLAG_DOT[flag].replace("bg-", "border-"))}>
                          {q.type === "instruction" ? (
                            <div className="flex items-start gap-1.5 text-sm text-muted-foreground italic">
                              <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{q.instructionText || q.label}</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Label className="text-sm font-medium">{q.label}{q.labelLocal ? ` (${q.labelLocal})` : ""}</Label>
                                {flag && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", FLAG_DOT[flag])} title={FLAG_LABEL[flag]} />}
                              </div>
                              {q.type === "single_select" && (
                                <div className="flex flex-wrap gap-2">
                                  {q.options.map((o) => {
                                    const selected = (answerValues[q.id] as string) === o.label;
                                    return (
                                      <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => setAnswerValues((p) => ({ ...p, [q.id]: o.label }))}
                                        className={cn(
                                          "px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1.5",
                                          selected
                                            ? o.flagSeverity ? cn(FLAG_STYLE[o.flagSeverity], "border-2") : "bg-primary text-primary-foreground border-primary"
                                            : "bg-background/60 border-border/50 hover:border-primary/40"
                                        )}
                                      >
                                        {selected ? <CircleDot className="h-3 w-3" /> : null}
                                        {o.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {q.type === "multi_select" && (
                                <div className="flex flex-wrap gap-2">
                                  {q.options.map((o) => {
                                    const arr = (answerValues[q.id] as string[]) || [];
                                    const checked = arr.includes(o.label);
                                    return (
                                      <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => setAnswerValues((p) => ({
                                          ...p,
                                          [q.id]: checked ? arr.filter((v) => v !== o.label) : [...arr, o.label],
                                        }))}
                                        className={cn(
                                          "px-3 py-1.5 rounded-full text-sm border transition-colors flex items-center gap-1.5",
                                          checked
                                            ? o.flagSeverity ? cn(FLAG_STYLE[o.flagSeverity], "border-2") : "bg-primary text-primary-foreground border-primary"
                                            : "bg-background/60 border-border/50 hover:border-primary/40"
                                        )}
                                      >
                                        {checked ? <CheckCircle2 className="h-3 w-3" /> : null}
                                        {o.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                              {q.type === "numeric" && (
                                <div className="max-w-xs">
                                  <FloatingField
                                    id={q.id} label="Value" type="number" inputMode="decimal"
                                    value={answerValues[q.id] != null ? String(answerValues[q.id]) : ""}
                                    onChange={(e) => setAnswerValues((p) => ({ ...p, [q.id]: e.target.value === "" ? "" : parseFloat(e.target.value) }))}
                                  />
                                </div>
                              )}
                              {q.type === "text" && (
                                <Textarea
                                  value={(answerValues[q.id] as string) || ""}
                                  onChange={(e) => setAnswerValues((p) => ({ ...p, [q.id]: e.target.value }))}
                                  className="bg-background/60"
                                  rows={2}
                                />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setStep("complaints")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="lg" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Complete Screening
            </Button>
          </div>
        </Card>
        </motion.div>
      )}

      {step === "results" && result && (
        <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <Card className="relative overflow-hidden p-6 sm:p-8 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl space-y-5">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screening Result</p>
            {result.overallFlag && (
              <Badge variant="outline" className={cn("border flex items-center gap-1", FLAG_STYLE[result.overallFlag])}>
                <ShieldAlert className="h-3 w-3" /> {FLAG_LABEL[result.overallFlag] || result.overallFlag}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedComplaintIds.map((id) => {
              const c = config.complaints.find((cc) => cc.id === id);
              return c ? <Badge key={id} variant="outline" className="text-xs">{c.label}</Badge> : null;
            })}
          </div>

          <Card className="p-4 border-primary/20 bg-primary/5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Summary
            </p>
            {result.aiSummary ? (
              <>
                <p className="text-sm leading-relaxed">{result.aiSummary}</p>
                <p className="text-[10px] text-muted-foreground mt-2 italic">AI-generated from the screening answers — decision support only, not a diagnosis.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">AI insights aren&apos;t configured for this portal yet.</p>
            )}
          </Card>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Answers</p>
            <div className="space-y-1.5">
              {result.answers.map((a) => (
                <div key={a.id} className={cn("flex items-center justify-between text-sm px-3 py-2 rounded-lg", a.flagTriggered ? FLAG_STYLE[a.flagTriggered] : "bg-background/40")}>
                  <span>{a.questionLabel}</span>
                  <span className="font-medium">{(() => { try { const v = JSON.parse(a.value); return Array.isArray(v) ? v.join(", ") : String(v); } catch { return a.value; } })()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={retake}>
              <RotateCcw className="h-4 w-4" /> Retake Screening
            </Button>
            <Button onClick={() => router.push(`/facility/patients/${patient.id}`)}>
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
