"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function NotificationsIndexPage() {
  const router = useRouter();

  useEffect(() => { router.replace("/admin/settings/email-config"); }, [router]);

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
    </div>
  );
}
