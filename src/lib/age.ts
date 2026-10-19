export type AgeUnit = "years" | "months" | "days";

/** The page's language (from <html lang>) when it isn't English — other languages use the browser's own wording. */
function pageLang(): string | null {
  const lang = typeof document !== "undefined" ? document.documentElement.lang : "";
  return lang && lang !== "en" ? `${lang}-u-nu-latn` : null;
}
const unitText = (lang: string, n: number, unit: "year" | "month" | "day") =>
  new Intl.NumberFormat(lang, { style: "unit", unit, unitDisplay: "short" }).format(n);

/** Estimated "YYYY-MM-DD" DOB, counting back from today by the given age value + unit (newborns included). */
export function estimateDobFromAgeValue(value: number, unit: AgeUnit): string {
  const dob = new Date();
  if (unit === "years") {
    const whole = Math.floor(value);
    const fraction = value - whole;
    dob.setFullYear(dob.getFullYear() - whole);
    if (fraction > 0) dob.setDate(dob.getDate() - Math.round(fraction * 365.25));
  } else if (unit === "months") {
    dob.setMonth(dob.getMonth() - value);
  } else {
    dob.setDate(dob.getDate() - value);
  }
  return dob.toISOString().slice(0, 10);
}

/** Human-readable age from a "YYYY-MM-DD" DOB, in the smallest sensible unit — days for a newborn, months for an infant, years otherwise. */
export function formatAge(dob: string | null): string {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return "—";
  const today = new Date();
  if (birth > today) return "—";

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const lang = pageLang();
  if (lang) {
    if (years >= 1) return [unitText(lang, years, "year"), months > 0 && unitText(lang, months, "month")].filter(Boolean).join(" ");
    if (months >= 1) return [unitText(lang, months, "month"), days > 0 && unitText(lang, days, "day")].filter(Boolean).join(" ");
    return unitText(lang, days, "day");
  }
  if (years >= 1) return `${years} yr${years === 1 ? "" : "s"}${months > 0 ? ` ${months} mo` : ""}`;
  if (months >= 1) return `${months} mo${months === 1 ? "" : "s"}${days > 0 ? ` ${days}d` : ""}`;
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** The same age-from-DOB calculation as formatAge, but as a raw {value, unit} pair for pre-filling an editable Age field. */
export function ageFromDob(dob: string | null): { value: number; unit: AgeUnit } | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  if (birth > today) return null;

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years >= 1) return { value: years, unit: "years" };
  if (months >= 1) return { value: months, unit: "months" };
  return { value: days, unit: "days" };
}

/** Age in whole days from a "YYYY-MM-DD" DOB — used for day-granularity eligibility checks (e.g. neonatal-only questions). */
export function ageInDays(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  if (birth > today) return null;
  return Math.floor((today.getTime() - birth.getTime()) / 86400000);
}

/** A date/timestamp as relative days ("Today", "Yesterday", "5 days ago", "3 months ago", "2 years ago"). */
export function daysAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  const lang = pageLang();
  if (lang) {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    if (days < 30) return rtf.format(-Math.max(0, days), "day");
    const m = Math.floor(days / 30);
    return m < 12 ? rtf.format(-m, "month") : rtf.format(-Math.floor(m / 12), "year");
  }
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

/** A date/timestamp as an easy-to-scan absolute date + time, e.g. "13 Oct 2026, 2:30 PM". */
export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  const lang = pageLang();
  const datePart = date.toLocaleDateString(lang ?? "en-GB", { day: "numeric", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString(lang ?? "en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart}, ${timePart}`;
}
