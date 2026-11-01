"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Notifications now live in the Settings left menu — old links redirect there.
const MOVED: Record<string, string> = { config: "email-config", templates: "email-templates", history: "notification-history" };

export default function NotificationSectionPage() {
  const router = useRouter();
  const { section } = useParams<{ section: string }>();

  useEffect(() => { router.replace(`/admin/settings/${MOVED[section] || "email-config"}`); }, [section, router]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
    </div>
  );
}
