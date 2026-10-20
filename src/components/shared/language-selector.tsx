"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Check, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Lang {
  code: string;
  name: string;
  direction: string;
  isDefault: boolean;
}

/**
 * Switches the whole app (texts and, for Urdu / Arabic / Farsi, the right-to-left layout).
 * The choice is kept in a cookie for a year. `compact` shows only the globe and the language code.
 */
export function LanguageSelector({ compact, className }: { compact?: boolean; className?: string }) {
  const tl = useTranslations("common.learning");
  const router = useRouter();
  const locale = useLocale();
  const [languages, setLanguages] = useState<Lang[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d) => setLanguages(d.languages ?? []))
      .catch(() => {});
  }, []);

  const select = async (code: string) => {
    if (code === locale) return;
    await fetch("/api/languages/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    startTransition(() => router.refresh());
  };

  if (languages.length <= 1) return null;
  const active = languages.find((l) => l.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tl("language")}
        data-tour="shell.language"
        className={cn("flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors outline-none", className)}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
        {compact ? <span className="uppercase">{locale}</span> : active?.name ?? "English"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => select(l.code)} dir={l.direction === "rtl" ? "rtl" : "ltr"} className="justify-between gap-6">
            <span>{l.name}</span>
            {l.code === locale && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
