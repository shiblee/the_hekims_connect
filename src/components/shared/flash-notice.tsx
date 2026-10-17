"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { takeFlash, type Flash } from "@/lib/flash";
import { InlineNotice } from "@/components/shared/inline-notice";

/** Shows a message carried over from the previous page (see setFlash), inline at the top of the page. */
export function FlashNotice() {
  const pathname = usePathname();
  const [flash, setFlash] = useState<Flash | null>(null);
  useEffect(() => {
    const f = takeFlash();
    queueMicrotask(() => setFlash(f));
  }, [pathname]);
  if (!flash) return null;
  return <InlineNotice {...flash} onDismiss={() => setFlash(null)} className="mb-5" />;
}
