export interface VisitVitals {
  pulse: number | null; bpSystolic: number | null; bpDiastolic: number | null; spo2: number | null;
  oxygenLitres: number | null; temperatureF: number | null; temperatureC: number | null;
  respiratoryRate: number | null; consciousnessLevel: string | null;
  heightCm: number | null; weightKg: number | null; updatedAt: string;
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
