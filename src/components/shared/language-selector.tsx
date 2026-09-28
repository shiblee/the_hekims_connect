"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
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

export function LanguageSelector() {
  const router = useRouter();
  const [languages, setLanguages] = useState<Lang[]>([]);
  const [current, setCurrent] = useState(() =>
    typeof document !== "undefined" ? document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] ?? "en" : "en"
  );

  useEffect(() => {
    fetch("/api/languages")
      .then((r) => r.json())
      .then((d) => setLanguages(d.languages ?? []))
      .catch(() => {});
  }, []);

  const select = async (code: string) => {
    if (code === current) return;
    await fetch("/api/languages/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setCurrent(code);
    router.refresh();
  };

  if (languages.length <= 1) return null;
  const active = languages.find((l) => l.code === current);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-colors outline-none">
        <Globe className="h-4 w-4" /> {active?.name ?? "English"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => select(l.code)}>
            {l.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
