// Shared, single source of truth for the vitals soft-validation ranges — used by
// both the capture form (vital-signs-form.tsx) and the profile dashboard
// (vitals-panel.tsx). A plain constant for now; see Patient Module plan notes
// on a future Clinical Configuration layer — not built in this phase.
export const VITAL_RANGES: Record<string, [number, number]> = {
  pulse: [60, 100],
  bpSystolic: [100, 130],
  bpDiastolic: [60, 80],
  spo2: [96, 100],
  respiratoryRate: [12, 20],
};

export const TEMP_RANGE_F: [number, number] = [97, 98.6];
export const TEMP_RANGE_C: [number, number] = [36, 37];

export function isOutOfRange(field: string, value: number | null): boolean {
  if (value == null || Number.isNaN(value)) return false;
  const range = VITAL_RANGES[field];
  if (!range) return false;
  return value < range[0] || value > range[1];
}
