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

export type HealthBand = "thriving" | "steady" | "at_risk" | "dormant";

export interface FacilityInsights {
  metrics: {
    patients: number; newPatients30: number; visits: number; visits30: number; visitsPrev30: number; weekly: number[];
    revenue: number; revenue30: number; revenuePrev30: number; refunds: number; payments: number;
    byMode: { mode: string; amount: number }[];
    appointments: number; upcoming: number; prescriptions: number; assessments: number;
    firstVisitAt: string | null; lastActivityAt: string | null; daysSinceActivity: number | null;
  };
  score: number; health: HealthBand;
  reasons: { key: string; text: string; good: boolean; points: number; max: number }[];
  checklist: { key: string; label: string; done: boolean }[];
  locked: boolean; failedLoginAttempts: number;
  staff: { id: string; name: string; role: string | null; designation: string | null; employeeType: string; active: boolean; lastLoginAt: string | null; createdAt: string }[];
  events: { id: string; actorType: string; actorName: string; action: string; summary: string; outcome: string; createdAt: string }[];
  logins: { id: string; displayName: string; status: string; browser: string | null; os: string | null; device: string | null; ip: string | null; staffId: string | null; createdAt: string }[];
}

export const HEALTH_STYLE: Record<HealthBand, { label: string; text: string; ring: string; bg: string; dot: string }> = {
  thriving: { label: "Thriving", text: "text-emerald-600 dark:text-emerald-400", ring: "stroke-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  steady: { label: "Steady", text: "text-sky-600 dark:text-sky-400", ring: "stroke-sky-500", bg: "bg-sky-500/10", dot: "bg-sky-500" },
  at_risk: { label: "At risk", text: "text-amber-600 dark:text-amber-400", ring: "stroke-amber-500", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  dormant: { label: "Dormant", text: "text-rose-600 dark:text-rose-400", ring: "stroke-rose-500", bg: "bg-rose-500/10", dot: "bg-rose-500" },
};

export interface FacilityDetailContextValue {
  facility: FacilityDetail;
  setFacility: (f: FacilityDetail) => void;
  reload: () => void;
  insights: FacilityInsights | null;
  reloadInsights: () => void;
}

export const FacilityDetailContext = createContext<FacilityDetailContextValue | null>(null);

export function useFacilityDetail() {
  const ctx = useContext(FacilityDetailContext);
  if (!ctx) throw new Error("useFacilityDetail must be used within a Facility detail route");
  return ctx;
}
