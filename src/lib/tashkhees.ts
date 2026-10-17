// Stage 5 (Tashkhees & Handover Dossier) shared definitions.

export const TASHKHEES_LISTS = [
  { key: "mizaj", label: "Mizaj (Temperaments)", hint: "Used for Mizaj-e-Asli and the quality of Su-e-Mizaj." },
  { key: "organ", label: "Udw (Organs)", hint: "Affected organs (Udw-e-Mutathir)." },
  { key: "usool", label: "Usool-e-Ilaj (Principles)", hint: "Principles of treatment." },
  { key: "ghiza", label: "Ghiza (Foods)", hint: "Foods the Hakim recommends or restricts (Parhez)." },
  { key: "tadbeer", label: "Tadbeer (Regimens)", hint: "Regimenal therapies — Ilaj-bil-Tadbeer." },
  { key: "dosage_form", label: "Dosage Forms", hint: "Forms offered on prescription lines." },
  { key: "timing", label: "Dose Timings", hint: "Timing choices on prescription lines." },
  { key: "prognosis", label: "Prognosis", hint: "Expected course." },
] as const;
export type TashkheesListKey = (typeof TASHKHEES_LISTS)[number]["key"];
export const isTashkheesList = (v: unknown): v is TashkheesListKey => TASHKHEES_LISTS.some((l) => l.key === v);

export const SU_MIZAJ_TYPES = [
  { value: "Sada", description: "Simple — qualitative change without morbid matter" },
  { value: "Maddi", description: "Material — with accumulation of a morbid humour" },
];
export const DARJA = [1, 2, 3, 4];
export const PRIORITIES = [
  { value: "routine", label: "Routine" },
  { value: "priority", label: "Priority" },
  { value: "urgent", label: "Urgent" },
];

export interface TashkheesOptionRow { id: string; list: string; label: string; localName: string | null; description: string | null }
export interface TadbeerLine { label: string; frequency: string; duration: string; notes: string }
export interface PrescriptionLine { tagId: string | null; name: string; form: string; dose: string; timing: string; duration: string; adjuvant: string; instructions: string }
