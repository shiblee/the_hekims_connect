import type { VisitStage } from "@/lib/visit-stage";

// Where the latest visit stands, and where "Continue" takes you.
export const STAGES: Record<VisitStage, { label: string; tone: string; dot: string; action: string; href: (id: string) => string }> = {
  waiting: { label: "Waiting in queue", tone: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30", dot: "bg-amber-500", action: "Start vitals", href: (id) => `/facility/patients/${id}/record` },
  vitals: { label: "Vitals & intake", tone: "text-sky-700 dark:text-sky-400 bg-sky-500/10 border-sky-500/30", dot: "bg-sky-500", action: "Continue", href: (id) => `/facility/patients/${id}/record` },
  mizaj: { label: "Mizaj & Morphometry", tone: "text-violet-700 dark:text-violet-400 bg-violet-500/10 border-violet-500/30", dot: "bg-violet-500", action: "Continue", href: (id) => `/facility/mizaj?patientId=${id}` },
  asbab: { label: "Asbab-e-Sittah", tone: "text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30", dot: "bg-indigo-500", action: "Continue", href: (id) => `/facility/asbab?patientId=${id}` },
  handover: { label: "Tashkhees & Handover", tone: "text-teal-700 dark:text-teal-400 bg-teal-500/10 border-teal-500/30", dot: "bg-teal-500", action: "Continue", href: (id) => `/facility/tashkhees?patientId=${id}` },
  done: { label: "Handed over", tone: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-500", action: "View dossier", href: (id) => `/facility/tashkhees?patientId=${id}` },
  referred: { label: "Referred out", tone: "text-destructive bg-destructive/10 border-destructive/30", dot: "bg-destructive", action: "View record", href: (id) => `/facility/patients/${id}/record` },
};

