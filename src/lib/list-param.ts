// Multi-select filters send their picked values comma-separated (?status=active,locked).

export function listParam(sp: URLSearchParams, key: string): string[] {
  return (sp.get(key) || "").split(",").map((v) => v.trim()).filter(Boolean);
}

/** A two-way filter (e.g. active/inactive): true or false when exactly one side is picked, otherwise no filter. */
export function eitherParam(values: string[], yes: string, no: string): boolean | undefined {
  const y = values.includes(yes), n = values.includes(no);
  return y === n ? undefined : y;
}
