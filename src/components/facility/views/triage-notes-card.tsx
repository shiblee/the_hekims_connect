"use client";

import { Card } from "@/components/ui/card";
import { MessageSquareText, StickyNote, Target } from "lucide-react";

interface TriageVisit {
  id: string; visitDate: string;
  vitalSigns: {
    painNotes?: string | null;
    primaryFocusArea?: string | null; triageRemarks?: string | null;
  } | null;
}

/** Triage-stage notes (pain notes, focus area, nurse remarks) recorded alongside vitals — only renders when at least one is on file, never fabricated. */
export function TriageNotesCard({ visits }: { visits: TriageVisit[] }) {
  const latest = [...visits]
    .filter((v) => v.vitalSigns && (v.vitalSigns.painNotes || v.vitalSigns.primaryFocusArea || v.vitalSigns.triageRemarks))
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];

  if (!latest || !latest.vitalSigns) return null;
  const v = latest.vitalSigns;

  return (
    <Card className="p-4 border-border/40 bg-card gap-3">
      {v.painNotes && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <MessageSquareText className="h-3 w-3" /> Pain Notes
          </p>
          <div className="rounded-lg bg-muted/40 p-2.5 text-sm text-foreground/90 leading-relaxed">{v.painNotes}</div>
        </div>
      )}

      {v.triageRemarks && (
        <div className={v.painNotes ? "pt-3 border-t border-border/30" : undefined}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <StickyNote className="h-3 w-3" /> Triage Remarks
          </p>
          <div className="rounded-lg bg-muted/40 p-2.5 text-sm text-foreground/90 leading-relaxed">{v.triageRemarks}</div>
        </div>
      )}

      {v.primaryFocusArea && (
        <div className={(v.painNotes || v.triageRemarks) ? "flex items-center justify-between gap-2 text-sm pt-3 border-t border-border/30" : "flex items-center justify-between gap-2 text-sm"}>
          <span className="text-muted-foreground flex items-center gap-1.5"><Target className="h-3.5 w-3.5" /> Primary Focus Area</span>
          <span className="font-medium text-end">{v.primaryFocusArea}</span>
        </div>
      )}
    </Card>
  );
}
