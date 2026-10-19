"use client";

import Link from "next/link";
import { createElement, useEffect, useState } from "react";
import { Loader2, Pencil, Wind } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AKHLAT, pillarIcon } from "@/lib/asbab";
import { Card } from "@/components/ui/card";

interface AsbabSummary {
  status: string;
  drift: { percent?: Record<string, number>; dominant?: string | null } | null;
  pillars: { key: string; label: string; english: string; answers: { question: string; answer: string }[] }[];
}

/**
 * Right column of Stage 5: what was recorded at Stage 4 (Asbab-e-Sittah) —
 * the lifestyle humoral drift and each pillar's answers. Read-only; the edit
 * link goes back to Stage 4.
 */
export function Stage4AsbabCard({ visitId, patientId }: { visitId: string; patientId: string }) {
  const [data, setData] = useState<AsbabSummary | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api.get<{ summary: { asbab: AsbabSummary | null } }>(`/api/facility/visits/${visitId}/clinical-summary`)
      .then((r) => { if (!cancelled) setData(r.summary.asbab); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [visitId]);

  const pct = data?.drift?.percent;
  const lead = data?.drift?.dominant ? AKHLAT.find((h) => h.key === data.drift!.dominant) : null;

  return (
    <Card className="p-5 border-border/50 bg-card/60 gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary"><Wind className="h-4 w-4" /></div>
          <h3 className="font-serif text-base font-semibold leading-tight">Asbab-e-Sittah</h3>
          {data && (
            <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium",
              data.status === "completed" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-amber-500/40 text-amber-700 dark:text-amber-400")}>
              {data.status === "completed" ? "Completed" : "Draft"}
            </span>
          )}
        </div>
        <Link href={`/facility/asbab?patientId=${patientId}`} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" title="Edit in Asbab-e-Sittah Review (Stage 4)">
          <Pencil className="h-3 w-3" /> Stage 4
        </Link>
      </div>

      {data === undefined ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : !data || data.pillars.length === 0 ? (
        <p className="text-sm text-muted-foreground">Asbab-e-Sittah not recorded at Stage 4.</p>
      ) : (
        <>
          {pct && (
            <div className="rounded-xl border border-border/40 bg-background/40 p-3 space-y-1.5">
              {lead && <p className="text-[13px]">Lifestyle leans towards <span className={cn("font-semibold", lead.text)}>{lead.label}</span> <span className="text-muted-foreground">({lead.quality})</span></p>}
              {AKHLAT.map((h) => (
                <div key={h.key} className="grid grid-cols-[62px_1fr_36px] items-center gap-2 text-xs">
                  <span className={cn(data.drift?.dominant === h.key ? cn("font-semibold", h.text) : "text-muted-foreground")}>{h.label}</span>
                  <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full", h.bar)} style={{ width: `${pct[h.key] ?? 0}%` }} /></span>
                  <span className="text-end tabular-nums">{pct[h.key] ?? 0}%</span>
                </div>
              ))}
            </div>
          )}
          <ul className="space-y-2">
            {data.pillars.map((p) => (
              <li key={p.key} className="flex gap-2.5">
                <span className="mt-0.5 h-6 w-6 shrink-0 rounded-md flex items-center justify-center bg-muted text-muted-foreground">
                  {createElement(pillarIcon(p.key), { className: "h-3.5 w-3.5" })}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-tight">{p.label} <span className="font-normal text-muted-foreground">· {p.english}</span></p>
                  {p.answers.map((a, i) => (
                    <p key={i} className="text-xs leading-snug"><span className="text-muted-foreground">{a.question} </span><span className="font-medium">{a.answer}</span></p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
