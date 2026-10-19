"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRequireFacility } from "@/lib/use-require-session";
import { FacilityShell } from "@/components/facility/facility-shell";
import { BrandLogo } from "@/components/brand/brand-logo";
import { GuidanceProvider } from "@/components/guidance/guidance-provider";
import { HelpButton, HelpPanel } from "@/components/guidance/help-panel";
import { api } from "@/lib/api";

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

export function FacilityLayoutClient({ children }: { children: React.ReactNode }) {
  const { ready, facility } = useRequireFacility();
  const router = useRouter();
  const pathname = usePathname();
  const isSetupPage = pathname === "/facility/profile-setup";

  useEffect(() => {
    if (!ready || !facility) return;
    if (!facility.profileCompleted && !isSetupPage) router.replace("/facility/profile-setup");
    else if (facility.profileCompleted && isSetupPage) router.replace("/facility/dashboard");
  }, [ready, facility, isSetupPage, router]);

  if (!ready || !facility) return <LoadingScreen />;
  if (!facility.profileCompleted && !isSetupPage) return <LoadingScreen />;
  if (facility.profileCompleted && isSetupPage) return <LoadingScreen />;

  if (isSetupPage) return <GuidanceProvider client={api} renderHelp={() => <HelpPanel />}>{children}<HelpButton floating /></GuidanceProvider>;

  return <GuidanceProvider client={api} renderHelp={() => <HelpPanel />}><FacilityShell>{children}</FacilityShell></GuidanceProvider>;
}
