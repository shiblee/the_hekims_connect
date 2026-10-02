"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { restoreSession } from "@/lib/api";
import { LandingPage } from "@/components/landing/landing-page";
import { FacilityDashboard } from "@/components/facility/facility-dashboard";
import { PatientDashboard } from "@/components/patient/patient-dashboard";
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
  const view = useAppStore((s) => s.view);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setHydrated(true));
  }, []);

  if (!hydrated) return <LoadingScreen />;

  // Dashboard views
  if (view === "facility-dashboard") return <FacilityDashboard />;
  if (view === "patient-dashboard") return <PatientDashboard />;

  // Default landing
  return <LandingPage />;
}
