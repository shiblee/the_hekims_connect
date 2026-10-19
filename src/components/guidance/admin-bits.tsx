"use client";

import { cn } from "@/lib/utils";
import { GUIDE_LANGS, LANG_LABEL, STATE_LABEL, type GuideLang, type TranslationState } from "@/lib/guidance/content";

export const STATE_DOT: Record<TranslationState, string> = { complete: "bg-emerald-500", review: "bg-sky-500", partial: "bg-amber-500", missing: "bg-muted-foreground/30" };

export function LangDots({ languages }: { languages: Record<GuideLang, TranslationState> }) {
  return (
    <span className="inline-flex items-center gap-1">
      {GUIDE_LANGS.map((l) => (
        <span key={l} title={`${LANG_LABEL[l]}: ${STATE_LABEL[languages[l]]}`} className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
          <span className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[languages[l]])} />{l}
        </span>
      ))}
    </span>
  );
}

export function StatusPill({ status, dirty, version }: { status: string; dirty: boolean; version: number }) {
  const tone = status === "published" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : status === "archived" ? "border-border bg-muted text-muted-foreground" : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}>
      {status === "published" ? `Published · v${version}` : status === "archived" ? "Archived" : version ? `Unpublished · v${version}` : "Draft"}
      {status === "published" && dirty && <span title="The draft has changes that aren't published yet">· draft changes</span>}
    </span>
  );
}

