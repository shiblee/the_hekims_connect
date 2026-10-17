"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// L1 Screening configuration now lives inside the Meta section (Chief
// Complaints / Modules & Questions / Allergies / Medications & Herbs tabs),
// so this standalone page just redirects there for anyone with the old link.
export default function ScreeningRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/meta");
  }, [router]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</div>
    </div>
  );
}
