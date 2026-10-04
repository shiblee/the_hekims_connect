"use client";

import { useRequirePatient } from "@/lib/use-require-session";
import { PatientShell } from "@/components/patient/patient-shell";
import { BrandLogo } from "@/components/brand/brand-logo";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse">
        <BrandLogo size={56} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        Loading…
      </div>
    </div>
  );
}

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const { ready, patient } = useRequirePatient();

  if (!ready || !patient) return <LoadingScreen />;

  return <PatientShell>{children}</PatientShell>;
}
