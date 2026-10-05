import { ageInDays } from "@/lib/age";

export interface EligibilityQuestion {
  applicableGender: string | null;
  minAgeDays: number | null;
  maxAgeDays: number | null;
}

export interface EligibilityPatient {
  gender: string | null;
  dob: string | null;
}

/** Whether a question should be shown for this patient, given its gender/age gating. */
export function questionApplies(question: EligibilityQuestion, patient: EligibilityPatient): boolean {
  if (question.applicableGender) {
    if (!patient.gender) return false;
    if (patient.gender.toLowerCase() !== question.applicableGender.toLowerCase()) return false;
  }
  if (question.minAgeDays != null || question.maxAgeDays != null) {
    const days = ageInDays(patient.dob);
    if (days == null) return false;
    if (question.minAgeDays != null && days < question.minAgeDays) return false;
    if (question.maxAgeDays != null && days > question.maxAgeDays) return false;
  }
  return true;
}
