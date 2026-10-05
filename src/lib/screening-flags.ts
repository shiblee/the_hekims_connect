export type FlagSeverity = "red" | "yellow" | "green";

const SEVERITY_RANK: Record<FlagSeverity, number> = { green: 1, yellow: 2, red: 3 };

export function maxSeverity(a: FlagSeverity | null | undefined, b: FlagSeverity | null | undefined): FlagSeverity | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

export interface FlagQuestion {
  id: string;
  type: string;
  // Matched against the submitted answer by label (not id) — the stored answer
  // value IS the human-readable label text, so history stays self-describing
  // without a join, and flag computation only ever runs once, at submit time,
  // against the then-current config, so label-matching is safe.
  options: { label: string; flagSeverity: string | null }[];
  numericOperator: string | null;
  numericThreshold: number | null;
  numericFlagSeverity: string | null;
  numericOperator2: string | null;
  numericThreshold2: number | null;
  numericFlagSeverity2: string | null;
}

function compare(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case ">": return value > threshold;
    case "<": return value < threshold;
    case ">=": return value >= threshold;
    case "<=": return value <= threshold;
    default: return false;
  }
}

/** Flag triggered by a single answer, given its question's configured rules. */
export function flagForAnswer(question: FlagQuestion, value: string | string[] | number): FlagSeverity | null {
  if (question.type === "single_select" && typeof value === "string") {
    const opt = question.options.find((o) => o.label === value);
    return (opt?.flagSeverity as FlagSeverity | undefined) ?? null;
  }
  if (question.type === "multi_select" && Array.isArray(value)) {
    let flag: FlagSeverity | null = null;
    for (const optLabel of value) {
      const opt = question.options.find((o) => o.label === optLabel);
      flag = maxSeverity(flag, (opt?.flagSeverity as FlagSeverity | undefined) ?? null);
    }
    return flag;
  }
  if (question.type === "numeric" && typeof value === "number") {
    let flag: FlagSeverity | null = null;
    if (question.numericOperator && question.numericThreshold != null && compare(value, question.numericOperator, question.numericThreshold)) {
      flag = maxSeverity(flag, (question.numericFlagSeverity as FlagSeverity | undefined) ?? null);
    }
    if (question.numericOperator2 && question.numericThreshold2 != null && compare(value, question.numericOperator2, question.numericThreshold2)) {
      flag = maxSeverity(flag, (question.numericFlagSeverity2 as FlagSeverity | undefined) ?? null);
    }
    return flag;
  }
  return null;
}

/** Overall screening flag = the highest severity across every answered question. */
export function computeOverallFlag(flags: (FlagSeverity | null)[]): FlagSeverity | null {
  return flags.reduce<FlagSeverity | null>((acc, f) => maxSeverity(acc, f), null);
}
