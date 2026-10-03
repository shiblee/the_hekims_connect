"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/admin-api";
import { Loader2 } from "lucide-react";

export default function MetaIndexPage() {
  const router = useRouter();

  useEffect(() => {
    adminApi.get<{ sections: { key: string }[] }>("/api/admin/metadata/sections")
      .then((res) => {
        if (res.sections.length) router.replace(`/admin/meta/${res.sections[0].key}`);
      });
  }, [router]);

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
    </div>
  );
}
