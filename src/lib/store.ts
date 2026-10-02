"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppView = "landing" | "facility-dashboard" | "patient-dashboard";

export interface FacilityUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  experience: number;
  rating: number;
  license: string | null;
  avatarColor: string;
  bio: string | null;
}

export interface PatientUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string | null;
  gender: string | null;
  bloodGroup: string | null;
  address: string | null;
  emergencyContact: string | null;
  occupation: string | null;
  height: string | null;
  weight: string | null;
  familyHistory: string | null;
  medicalHistory: string | null;
  chronicConditions: string | null;
  allergies: string | null;
  currentMedications: string | null;
  surgicalHistory: string | null;
  lifestyle: string | null;
  mizaj: string | null;
  avatarColor: string;
}

interface OtpPending {
  contact: string; // email for facility, phone for patient
  role: "facility" | "patient";
  code: string; // dev-mode visible code
  name?: string;
}

interface AppState {
  view: AppView;
  facility: FacilityUser | null;
  patient: PatientUser | null;
  otpPending: OtpPending | null;

  setView: (v: AppView) => void;
  setFacility: (h: FacilityUser | null) => void;
  setPatient: (p: PatientUser | null) => void;
  setOtpPending: (o: OtpPending | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      view: "landing",
      facility: null,
      patient: null,
      otpPending: null,
      setView: (view) => set({ view }),
      setFacility: (facility) => set({ facility }),
      setPatient: (patient) => set({ patient }),
      setOtpPending: (otpPending) => set({ otpPending }),
      logout: () => {
        localStorage.removeItem("hekims-connect-token");
        set({ view: "landing", facility: null, patient: null, otpPending: null });
      },
    }),
    {
      name: "hekims-connect-store",
      partialize: (s) => ({
        view: s.view,
        facility: s.facility,
        patient: s.patient,
        otpPending: s.otpPending,
      }),
    }
  )
);
