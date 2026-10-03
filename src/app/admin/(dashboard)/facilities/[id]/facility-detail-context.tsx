"use client";

import { createContext, useContext } from "react";

export interface OperatingHourRow {
  dayOfWeek: number;
  isOpen: boolean;
  openingTime: string | null;
  closingTime: string | null;
  openingTime2: string | null;
  closingTime2: string | null;
}

export interface SubscriptionRow {
  id: string;
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
}

export interface FacilityDetail {
  id: string; facilityName: string; email: string; phone: string; license: string | null;
  specialization: string; experience: number; rating: number; bio: string | null;
  avatarColor: string; verified: boolean; active: boolean;
  lastLoginAt: string | null; createdAt: string; updatedAt: string;
  registeredFacilityName: string | null; facilityType: string | null; hfrNumber: string | null;
  establishmentDate: string | null; alternateContactNumber: string | null;
  addressLine1: string | null; addressLine2: string | null; locality: string | null;
  city: string | null; district: string | null; state: string | null; country: string | null;
  pincode: string | null; latitude: number | null; longitude: number | null;
  bedCapacity: number | null; dailyOpdCount: number | null; dailyAdmissions: number | null;
  is24x7: boolean; emergencyServices: boolean; ambulanceAvailable: boolean;
  specializations: string | null; services: string | null;
  profileCompleted: boolean; profileCompletedAt: string | null;
  operatingHours: OperatingHourRow[];
  subscriptions: SubscriptionRow[];
  _count: { appointments: number; prescriptions: number; mizajAssessments: number };
}

export const DAY_LABELS: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
};
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface FacilityDetailContextValue {
  facility: FacilityDetail;
  setFacility: (f: FacilityDetail) => void;
  reload: () => void;
}

export const FacilityDetailContext = createContext<FacilityDetailContextValue | null>(null);

export function useFacilityDetail() {
  const ctx = useContext(FacilityDetailContext);
  if (!ctx) throw new Error("useFacilityDetail must be used within a Facility detail route");
  return ctx;
}
