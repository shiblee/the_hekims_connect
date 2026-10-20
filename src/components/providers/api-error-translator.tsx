"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { setApiErrorTranslator } from "@/lib/api";
import { apiErrorKey } from "@/lib/i18n/api-error-key";
import { API_ERROR_PATTERNS } from "@/lib/i18n/app-strings/api-errors";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** "Wait {n}s" → a regex for the server's English sentence, plus the blank names in order. */
const COMPILED = API_ERROR_PATTERNS.map(([key, en]) => {
  const names: string[] = [];
  const source = en.split(/(\{\w+\})/).map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    if (!m) return escape(part);
    names.push(m[1]);
    return "(.+?)";
  }).join("");
  return { key, names, re: new RegExp(`^${source}$`) };
});

/**
 * Server errors arrive as English sentences; this shows them in the viewer's
 * language wherever the app displays an error (it hooks into lib/api.ts).
 * Anything not in the list stays English.
 */
export function ApiErrorTranslator() {
  const t = useTranslations("common.api");
  useEffect(() => {
    setApiErrorTranslator((msg) => {
      const key = apiErrorKey(msg);
      if (t.has(key)) return t(key);
      for (const p of COMPILED) {
        const m = p.re.exec(msg);
        if (m) return t(p.key, Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]])));
      }
      return msg;
    });
  }, [t]);
  return null;
}
