export type AgeUnit = "years" | "months" | "days";

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

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
