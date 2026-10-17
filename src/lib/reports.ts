import { Droplet, FlaskConical, ScanLine, HeartPulse, FileText, ClipboardList, Files, type LucideIcon } from "lucide-react";

// Fixed report format shared by the add form, the sidebar list and the viewer.

export const REPORT_CATEGORIES: { value: string; label: string; icon: LucideIcon; tint: string }[] = [
  { value: "blood", label: "Blood / Lab Test", icon: Droplet, tint: "bg-red-500/10 text-red-600 dark:text-red-400" },
  { value: "urine_stool", label: "Urine & Stool", icon: FlaskConical, tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { value: "imaging", label: "Imaging (X-ray / USG / CT / MRI)", icon: ScanLine, tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
  { value: "cardiac", label: "ECG / Cardiac", icon: HeartPulse, tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  { value: "prescription", label: "Previous Prescription", icon: ClipboardList, tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { value: "discharge", label: "Discharge Summary", icon: FileText, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { value: "other", label: "Other Document", icon: Files, tint: "bg-muted text-muted-foreground" },
];
export const reportCategory = (v: string) => REPORT_CATEGORIES.find((c) => c.value === v) ?? REPORT_CATEGORIES[REPORT_CATEGORIES.length - 1];

export const RESULT_FLAGS: { value: string; label: string; className: string }[] = [
  { value: "normal", label: "Normal", className: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40" },
  { value: "abnormal", label: "Abnormal", className: "text-amber-600 dark:text-amber-400 border-amber-500/40" },
  { value: "critical", label: "Critical", className: "text-destructive border-destructive/40" },
  { value: "unknown", label: "Not assessed", className: "text-muted-foreground" },
];
export const resultFlag = (v: string) => RESULT_FLAGS.find((f) => f.value === v) ?? RESULT_FLAGS[3];

export interface ReportValue { name: string; value: string; unit?: string; range?: string; flag?: "high" | "low" | "abnormal" | "normal" | null }
export interface ReportExtraction { summary?: string; values?: ReportValue[] }

export const REPORT_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const REPORT_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const REPORT_MAX_FILES = 10;
