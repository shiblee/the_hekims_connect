"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, ShieldAlert, ShieldCheck, Sparkles, Loader2, Plus, RotateCcw, ListChecks, Flag } from "lucide-react";

interface ScreeningVisit {
  id: string; visitDate: string;
  l1Screening: {
    id: string; chiefComplaints: string; overallFlag: string | null; aiSummary: string | null; updatedAt: string;
    answers?: { flagTriggered: string | null }[];
  } | null;
}

const FLAG_STYLE: Record<string, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};
const FLAG_LABEL: Record<string, string> = { red: "High Risk", yellow: "Needs Review", green: "Low Risk" };
const FLAG_BAR: Record<string, string> = { red: "from-destructive via-destructive/60 to-destructive", yellow: "from-amber-400 via-amber-400/60 to-amber-400", green: "from-emerald-500 via-emerald-500/60 to-emerald-500" };
const FLAG_TEXT: Record<string, string> = { red: "text-destructive", yellow: "text-amber-600 dark:text-amber-400", green: "text-emerald-600 dark:text-emerald-400" };

export function latestScreeningOf(visits: ScreeningVisit[]) {
  return [...visits]
    .filter((v) => v.l1Screening)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
}

export function ScreeningCard({
  visits, patientId, apiClient = api, showStartButton = true,
}: {
  visits: ScreeningVisit[];
  patientId: string;
  apiClient?: { post: <T = any>(url: string, body?: any) => Promise<T> };
  showStartButton?: boolean;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const latest = latestScreeningOf(visits);

  const startScreening = async () => {
    setStarting(true);
    try {
      const res = await apiClient.post<{ visit: { id: string } }>("/api/facility/visits", { patientId });
      router.push(`/facility/visits/${res.visit.id}/screening`);
    } catch (e: any) {
      toast.error(e.message || "Could not start a screening");
      setStarting(false);
    }
  };

  if (!latest || !latest.l1Screening) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 text-center">
        <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No L1 Screening recorded yet{showStartButton ? "." : " at any facility."}</p>
        {showStartButton && (
          <Button size="sm" onClick={startScreening} disabled={starting}>
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Start Screening
          </Button>
        )}
      </Card>
    );
  }

  const screening = latest.l1Screening;
  const chiefComplaints: string[] = (() => { try { return JSON.parse(screening.chiefComplaints); } catch { return []; } })();
  const answers = screening.answers || [];
  const flaggedCount = answers.filter((a) => a.flagTriggered).length;
  const flag = screening.overallFlag;

  return (
    <Card className="relative overflow-hidden p-4 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl space-y-3">
      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", flag ? FLAG_BAR[flag] : "from-primary via-accent to-primary")} />

      {/* Header — icon, title, overall flag */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border",
            flag ? FLAG_STYLE[flag] : "bg-primary/10 border-primary/20 text-primary"
          )}>
            {flag ? <ShieldAlert className="h-4.5 w-4.5" /> : <ShieldCheck className="h-4.5 w-4.5" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">L1 Screening</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{daysAgo(latest.visitDate)}</p>
          </div>
        </div>
        {flag && (
          <Badge variant="outline" className={cn("border text-xs font-medium", FLAG_STYLE[flag])}>
            {FLAG_LABEL[flag] || flag}
          </Badge>
        )}
      </div>

      {/* Complaints + mini stats, on one compact line */}
      {(chiefComplaints.length > 0 || answers.length > 0) && (
        <div className="flex items-center flex-wrap gap-1.5">
          {chiefComplaints.map((c) => (
            <Badge key={c} variant="outline" className="text-[11px] bg-background/60 border-border/50 font-normal">{c}</Badge>
          ))}
          {answers.length > 0 && (
            <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
              <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {answers.length} assessed</span>
              {flaggedCount > 0 && (
                <span className={cn("flex items-center gap-1 font-medium", flag ? FLAG_TEXT[flag] : "text-foreground")}>
                  <Flag className="h-3 w-3" /> {flaggedCount} flagged
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* AI Insight — folded into the same card, right after the result summary */}
      {screening.aiSummary && (
        <div className="rounded-lg bg-primary/[0.06] border border-primary/15 p-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Unani Clinical Insight
          </p>
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{screening.aiSummary}</p>
          <p className="text-[10px] text-muted-foreground italic">Decision support only — not a diagnosis. Always verify clinically.</p>
        </div>
      )}

      {showStartButton && (
        <Button size="sm" variant="outline" onClick={startScreening} disabled={starting}>
          {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} New Screening
        </Button>
      )}
    </Card>
  );
}
