"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useSessionReady } from "@/components/providers/session-boundary";
import { LandingPage } from "@/components/landing/landing-page";
import { BrandLogo } from "@/components/brand/brand-logo";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse">
        <BrandLogo size={56} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Restoring your session…
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const ready = useSessionReady();
  const facility = useAppStore((s) => s.facility);
  const patient = useAppStore((s) => s.patient);
  const staff = useAppStore((s) => s.staff);

  useEffect(() => {
    if (!ready) return;
    if (facility) router.replace(facility.profileCompleted ? "/facility/dashboard" : "/facility/profile-setup");
    else if (staff) router.replace("/staff");
    else if (patient) router.replace("/patient/dashboard");
  }, [ready, facility, patient, staff, router]);

  if (!ready) return <LoadingScreen />;
  if (facility || patient || staff) return <LoadingScreen />;

  return <LandingPage />;
}
