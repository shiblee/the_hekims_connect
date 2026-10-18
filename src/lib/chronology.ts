// Duration helpers for Stage 3 "Chronology & Duration" — the same units the
// Chief Complaint Matrix uses for each complaint's duration.

export const DURATION_UNITS = [
  { value: "hours", label: "Hours (Sa'aat)", hours: 1 },
  { value: "days", label: "Days (Ayyam)", hours: 24 },
  { value: "weeks", label: "Weeks (Asabee')", hours: 24 * 7 },
  { value: "months", label: "Months (Shuhoor)", hours: 24 * 30 },
  { value: "years", label: "Years (Sineen)", hours: 24 * 365 },
] as const;

const hoursPer = (unit: string) => DURATION_UNITS.find((u) => u.value === unit)?.hours ?? 24;

export const durationInHours = (value: number, unit: string) => value * hoursPer(unit);

/** The complaint with the longest duration — what the visit's chronology defaults to. */
export function longestDuration<T extends { value: number | null; unit: string }>(items: T[]): T | null {
  let best: T | null = null;
  for (const i of items) {
    if (i.value == null || i.value <= 0) continue;
    if (!best || durationInHours(i.value, i.unit) > durationInHours(best.value!, best.unit)) best = i;
  }
  return best;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** yyyy-mm-dd in local time, for <input type="date">. */
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Approximate onset date: today minus the duration (calendar months/years for those units). */
export function onsetDateFor(value: number, unit: string, today = new Date()): string {
  const d = new Date(today);
  if (unit === "months") d.setMonth(d.getMonth() - Math.round(value));
  else if (unit === "years") d.setFullYear(d.getFullYear() - Math.round(value));
  else d.setTime(d.getTime() - durationInHours(value, unit) * 3600_000);
  return toDateInput(d);
}

/** Duration back from a picked onset date — expressed in days (hours if under a day). */
export function durationFromDate(date: string, today = new Date()): { value: number; unit: string } | null {
  const picked = new Date(`${date}T00:00:00`);
  if (Number.isNaN(picked.getTime())) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((start.getTime() - picked.getTime()) / 86_400_000);
  if (days < 0) return null;
  return days === 0 ? { value: Math.max(1, today.getHours()), unit: "hours" } : { value: days, unit: "days" };
}

// Course of illness by duration, in classical Unani terms: acute illnesses
// (Amraz-e-Haadda) reach their crisis (Buhran) within about 14 days; those
// lasting beyond about 40 days are chronic (Amraz-e-Muzmina). A guide only.
export const COURSES = [
  { key: "acute", label: "Acute", unani: "Haad", range: "up to 14 days", maxDays: 14,
    hint: "Short illness — usually still moving towards its crisis (Buhran).",
    style: { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/5", border: "border-amber-500/30", bar: "bg-amber-500", dot: "#f59e0b" } },
  { key: "subacute", label: "Subacute", unani: "Mumtad", range: "15–40 days", maxDays: 40,
    hint: "Lasted past the usual crisis period — watch whether it is settling or becoming long-standing.",
    style: { text: "text-orange-700 dark:text-orange-400", bg: "bg-orange-500/5", border: "border-orange-500/30", bar: "bg-orange-500", dot: "#f97316" } },
  { key: "chronic", label: "Chronic", unani: "Muzmin", range: "over 40 days", maxDays: 365 * 3,
    hint: "Long-standing illness — the underlying temperament and humours usually need attention.",
    style: { text: "text-violet-700 dark:text-violet-400", bg: "bg-violet-500/5", border: "border-violet-500/30", bar: "bg-violet-500", dot: "#8b5cf6" } },
] as const;

export function courseFor(value: string, unit: string) {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const days = durationInHours(n, unit) / 24;
  const i = days <= 14 ? 0 : days <= 40 ? 1 : 2;
  const lo = i === 0 ? 0 : COURSES[i - 1].maxDays;
  const within = Math.min(1, (days - lo) / (COURSES[i].maxDays - lo));
  // Marker sits inside its own third of the bar, a little in from the edges.
  return { ...COURSES[i], pos: (i + 0.08 + within * 0.84) * (100 / 3) };
}
