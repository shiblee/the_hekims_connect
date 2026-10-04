"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, type FacilityUser, type PatientUser, type StaffUser } from "@/lib/store";
import { useSessionReady } from "@/components/providers/session-boundary";

/** Redirects to the right login screen once the session is known and the account is missing. */
function useGuard<T>(account: T | null, loginPath: string): { ready: boolean; account: T | null } {
  const ready = useSessionReady();
  const router = useRouter();

  useEffect(() => {
    if (ready && !account) router.replace(loginPath);
  }, [ready, account, loginPath, router]);

  return { ready, account };
}

export function useRequireFacility(): { ready: boolean; facility: FacilityUser | null } {
  const facility = useAppStore((s) => s.facility);
  const { ready } = useGuard(facility, "/login/facility");
  return { ready, facility };
}

export function useRequirePatient(): { ready: boolean; patient: PatientUser | null } {
  const patient = useAppStore((s) => s.patient);
  const { ready } = useGuard(patient, "/login/patient");
  return { ready, patient };
}

export function useRequireStaff(): { ready: boolean; staff: StaffUser | null } {
  const staff = useAppStore((s) => s.staff);
  const { ready } = useGuard(staff, "/login/staff");
  return { ready, staff };
}
