"use client";

import { useRequireStaff } from "@/lib/use-require-session";
import { StaffPortal } from "@/components/staff/staff-portal";
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

export default function StaffPage() {
  const { ready, staff } = useRequireStaff();

  if (!ready || !staff) return <LoadingScreen />;

  return <StaffPortal />;
}
