// Validation for Amraz catalogue entries written from Admin.
const str = (v: unknown, max = 2000) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const strArr = (v: unknown, max = 40) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 300)))].slice(0, max) : []);
const jsonArr = (v: unknown) => (Array.isArray(v) ? v.slice(0, 40) : []);

export function marzData(b: any, creating: boolean): { data: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  if (creating || b.label !== undefined) { const l = str(b.label, 200); if (!l) return { data, error: "Name is required" }; data.label = l; }
  for (const k of ["localName", "category", "description", "icd"] as const) if (b[k] !== undefined) data[k] = str(b[k], k === "description" ? 2000 : 200);
  if (b.suMizajType !== undefined) data.suMizajType = b.suMizajType === "Sada" || b.suMizajType === "Maddi" ? b.suMizajType : null;
  for (const k of ["organs", "mizaj", "sabab", "investigations"] as const) if (b[k] !== undefined) data[k] = JSON.stringify(strArr(b[k]));
  for (const k of ["signs", "against", "dontMiss", "sources"] as const) if (b[k] !== undefined) data[k] = JSON.stringify(jsonArr(b[k]));
  if (b.appliesTo !== undefined) data.appliesTo = JSON.stringify(b.appliesTo && typeof b.appliesTo === "object" ? b.appliesTo : {});
  if (b.active !== undefined) data.active = !!b.active;
  return { data };
}
