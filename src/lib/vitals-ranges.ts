// Shared, single source of truth for the vitals validation ranges — used by
// both the capture form (vital-signs-form.tsx) and the profile dashboard
// (vitals-panel.tsx), client-side, and by the save API server-side. The
// actual numbers are admin-configurable (Admin → Settings → Vitals
// Validation); these are only the fallback defaults for any field the
// admin hasn't overridden yet. Kept free of any server-only import (no
// `db`) so it stays safe to import from client components.

export const VITALS_RANGE_FIELDS = [
  "pulse", "bpSystolic", "bpDiastolic", "spo2", "temperatureF",
] as const;
export type VitalsRangeField = (typeof VITALS_RANGE_FIELDS)[number];

// The clinically "normal" range — outside this, a reading is flagged for
// review but still accepted and saved.
export const DEFAULT_NORMAL_RANGES: Record<VitalsRangeField, [number, number]> = {
  pulse: [60, 100],
  bpSystolic: [100, 130],
  bpDiastolic: [60, 80],
  spo2: [96, 100],
  temperatureF: [97, 98.6],
};

// Hard sanity bounds on raw entry — catches an obvious typo (an extra
// digit, a decimal in the wrong place) before it reaches the database.
// Distinct from the normal range above, which flags a clinically abnormal
// but validly entered reading (e.g. a real tachycardia must still save).
export const DEFAULT_ENTRY_BOUNDS: Record<VitalsRangeField, [number, number]> = {
  pulse: [0, 300],
  bpSystolic: [0, 300],
  bpDiastolic: [0, 200],
  spo2: [0, 100],
  temperatureF: [92, 105],
};

export interface VitalsRangeConfig {
  normalRanges: Record<string, [number, number]>;
  entryBounds: Record<string, [number, number]>;
}

export const DEFAULT_VITALS_RANGE_CONFIG: VitalsRangeConfig = {
  normalRanges: DEFAULT_NORMAL_RANGES,
  entryBounds: DEFAULT_ENTRY_BOUNDS,
};

/** A Fahrenheit [min, max] range converted to its Celsius equivalent. */
export function toCelsiusRange([lo, hi]: [number, number]): [number, number] {
  return [((lo - 32) * 5) / 9, ((hi - 32) * 5) / 9];
}

export function isOutOfRange(ranges: Record<string, [number, number]>, field: string, value: number | null): boolean {
  if (value == null || Number.isNaN(value)) return false;
  const range = ranges[field];
  if (!range) return false;
  return value < range[0] || value > range[1];
}
