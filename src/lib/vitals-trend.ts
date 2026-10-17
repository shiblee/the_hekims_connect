export interface VisitVitals {
  heartRate: number | null; pulse: number | null; bpSystolic: number | null; bpDiastolic: number | null; spo2: number | null;
  temperatureF: number | null; temperatureC: number | null;
  heightCm: number | null; weightKg: number | null; updatedAt: string;
  painNotes?: string | null; primaryFocusArea?: string | null; triageRemarks?: string | null;
}

export interface VisitWithVitals {
  id: string;
  visitDate: string;
  vitalSigns: VisitVitals | null;
}

// Height/weight don't change every visit — walk back through visit history
// (assumed sorted newest-first, matching the facility visits API) to find the
// most recently recorded value for a given field.
export function findLatestWithField<K extends keyof VisitVitals>(visits: VisitWithVitals[], field: K) {
  for (const v of visits) {
    if (v.vitalSigns && v.vitalSigns[field] != null) return v.vitalSigns[field];
  }
  return null;
}

// A quick single-metric reading (e.g. the KPI pop-up's "Add Reading") creates
// a new visit with only that one field filled in — every other field is
// null on that row. Reading "latest" off visits[0] directly would then make
// every OTHER metric's dashboard tile look blank, even though a real, more
// complete reading exists a few visits back. This walks back to the most
// recent visit where the given field specifically is non-null, so each
// metric's "latest" is scoped to its own history and unaffected by a quick
// reading recorded for a different metric.
export function findLatestVitalSignsFor<K extends keyof VisitVitals>(visits: VisitWithVitals[], field: K): VisitVitals | null {
  for (const v of visits) {
    if (v.vitalSigns && v.vitalSigns[field] != null) return v.vitalSigns;
  }
  return null;
}

// Same lookup as findLatestVitalSignsFor, but returns the visit wrapper
// (which carries the visit id) rather than just the vitalSigns row — used
// when the caller needs to act on that specific visit, e.g. to check
// whether it's still inside the edit window and correct it in place.
export function findLatestVisitFor<K extends keyof VisitVitals>(visits: VisitWithVitals[], field: K): VisitWithVitals | null {
  for (const v of visits) {
    if (v.vitalSigns && v.vitalSigns[field] != null) return v;
  }
  return null;
}
