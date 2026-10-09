"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stethoscope, ShieldAlert, ClipboardList, ArrowRight } from "lucide-react";

interface ConsultationVisit {
  id: string; visitDate: string;
  clinicalAssessment: { id: string; workingDiagnosis: string | null; requiresUrgentReferral: boolean; updatedAt: string } | null;
  treatmentPlan: { id: string; careClassification: string; referralRequired: boolean; updatedAt: string } | null;
}

export function ConsultationCard({ visits, showStartButton = true }: { visits: ConsultationVisit[]; showStartButton?: boolean }) {
  const router = useRouter();

  const latest = [...visits]
    .filter((v) => v.clinicalAssessment || v.treatmentPlan)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];

  // The consultation continues whichever visit most recently had a screening
  // or vitals recorded — same "latest clinical activity" visit the doctor
  // would naturally want to review next.
  const latestActiveVisit = [...visits].sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];

  const goToConsultation = () => {
    const visitId = latest?.id || latestActiveVisit?.id;
    if (visitId) router.push(`/facility/visits/${visitId}/consultation`);
  };

  if (!latest) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 text-center">
        <Stethoscope className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No doctor review recorded yet.</p>
        {showStartButton && latestActiveVisit && (
          <Button size="sm" onClick={goToConsultation}>
            <Stethoscope className="h-3.5 w-3.5" /> Start Doctor Review
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-4 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl gap-2">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border bg-primary/10 border-primary/20 text-primary">
            <Stethoscope className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Doctor Review</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{daysAgo(latest.visitDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {latest.clinicalAssessment?.requiresUrgentReferral && (
            <Badge variant="outline" className="border text-xs font-medium bg-destructive/15 text-destructive border-destructive/30">
              <ShieldAlert className="h-3 w-3" /> Urgent Referral
            </Badge>
          )}
          {showStartButton && (
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={goToConsultation}>
              <ArrowRight className="h-3 w-3" /> Continue
            </Button>
          )}
        </div>
      </div>

      {latest.clinicalAssessment?.workingDiagnosis && (
        <p className="text-sm text-foreground/90">{latest.clinicalAssessment.workingDiagnosis}</p>
      )}
      {latest.treatmentPlan && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[11px] bg-background/60 border-border/50 font-normal flex items-center gap-1">
            <ClipboardList className="h-3 w-3" /> {latest.treatmentPlan.careClassification}
          </Badge>
          {latest.treatmentPlan.referralRequired && (
            <Badge variant="outline" className="text-[11px] font-normal">Referral noted</Badge>
          )}
        </div>
      )}
    </Card>
  );
}
