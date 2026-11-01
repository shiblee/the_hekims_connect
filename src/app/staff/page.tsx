"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireStaff } from "@/lib/use-require-session";
import { useTranslations } from "next-intl";
import { BrandLogo } from "@/components/brand/brand-logo";

function LoadingScreen() {
  const tc = useTranslations("common");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="animate-pulse">
        <BrandLogo size={56} />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        {tc("loading")}
      </div>
    </div>
  );
}

// Staff profiles now live inside the clinic app (/facility/account); this old page forwards there.
export default function StaffPage() {
  const { ready, staff } = useRequireStaff();
  const router = useRouter();
  useEffect(() => { if (ready && staff) router.replace("/facility/account"); }, [ready, staff, router]);
  return <LoadingScreen />;
}
