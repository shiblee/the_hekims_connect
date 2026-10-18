"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FacilityUser {
  id: string;
  facilityName: string;
  email: string;
  phone: string;
  specialization: string;
  experience: number;
  rating: number;
  license: string | null;
  avatarColor: string;
  bio: string | null;
  profileCompleted: boolean;
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

export interface StaffUser {
  id: string;
  staffCode: string;
  name: string;
  photo: string | null;
  email: string | null;
  phone: string | null;
  employeeType: string;
  specialization: string | null;
  qualification: string | null;
  designation: string | null;
  registrationNumber: string | null;
  experience: number | null;
  role: string | null;
  responsibilities: string | null;
  facility: { id: string; facilityName: string };
}

interface OtpPending {
  contact: string; // email for facility, phone for patient
  role: "facility" | "patient" | "staff";
  code: string; // dev-mode visible code
  name?: string;
}

interface AppState {
  facility: FacilityUser | null;
  patient: PatientUser | null;
  staff: StaffUser | null;
  /** A signed-in staff member's permissions in the clinic app; null for the clinic owner (everything). */
  permissions: string[] | null;
  /** The staff member's role name, for display. */
  staffRole: string | null;
  otpPending: OtpPending | null;

  setFacility: (h: FacilityUser | null) => void;
  setPatient: (p: PatientUser | null) => void;
  setStaff: (s: StaffUser | null) => void;
  setPermissions: (p: string[] | null, role?: string | null) => void;
  setOtpPending: (o: OtpPending | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      facility: null,
      patient: null,
      staff: null,
      permissions: null,
      staffRole: null,
      otpPending: null,
      setFacility: (facility) => set({ facility }),
      setPatient: (patient) => set({ patient }),
      setStaff: (staff) => set({ staff }),
      setPermissions: (permissions, staffRole = null) => set({ permissions, staffRole }),
      setOtpPending: (otpPending) => set({ otpPending }),
      logout: () => {
        const token = localStorage.getItem("hekims-connect-token");
        if (token) {
          fetch("/api/auth/logout", { method: "POST", headers: { "x-hekim-auth": token } }).catch(() => {});
        }
        localStorage.removeItem("hekims-connect-token");
        set({ facility: null, patient: null, staff: null, permissions: null, staffRole: null, otpPending: null });
      },
    }),
    {
      name: "hekims-connect-store",
      partialize: (s) => ({
        facility: s.facility,
        patient: s.patient,
        staff: s.staff,
        permissions: s.permissions,
        staffRole: s.staffRole,
        otpPending: s.otpPending,
      }),
    }
  )
);
