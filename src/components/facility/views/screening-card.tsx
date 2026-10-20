"use client";

import { useState } from "react";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { InsightBody } from "@/components/shared/screening-insight-body";
import {
  ClipboardList, ShieldCheck, Loader2, Plus, RotateCcw, History,
} from "lucide-react";

interface ScreeningVisit {
  id: string; visitDate: string;
  l1Screening: {
    id: string; chiefComplaints: string; aiSummary: string | null; updatedAt: string;
  } | null;
}

/** One past screening's row inside the History dialog — collapsed summary, expands to the full insight. */
function HistoryEntry({ visit, isCurrent }: { visit: ScreeningVisit; isCurrent: boolean }) {
  const screening = visit.l1Screening!;
  const tv = useTranslations("clinic.visit");
  const dl = useDateLocale();
  const chiefComplaints: string[] = (() => { try { return JSON.parse(screening.chiefComplaints); } catch { return []; } })();

  return (
    <AccordionItem value={visit.id} className="border border-border/40 rounded-lg px-3 mb-2 last:mb-0">
      <AccordionTrigger className="hover:no-underline py-2.5">
        <div className="flex items-center gap-2 flex-wrap text-start pe-2">
          <span className="text-xs font-medium text-foreground">{new Date(visit.visitDate).toLocaleDateString(dl, { day: "numeric", month: "short", year: "numeric" })}</span>
          {isCurrent && <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">{tv("current")}</Badge>}
          <span className="text-[11px] text-muted-foreground truncate">{chiefComplaints.join(", ") || tv("no_complaints")}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3 space-y-2.5">
        {chiefComplaints.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chiefComplaints.map((c) => (
              <Badge key={c} variant="outline" className="text-[11px] bg-background/60 border-border/50 font-normal">{c}</Badge>
            ))}
          </div>
        )}
        {screening.aiSummary && <InsightBody aiSummary={screening.aiSummary} flag={null} />}
      </AccordionContent>
    </AccordionItem>
  );
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const msg = useNotice();
  const tv = useTranslations("clinic.visit");
  const tc = useTranslations("common");

  const pastVisits = [...visits]
    .filter((v) => v.l1Screening)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
  const latest = pastVisits[0];

  const startScreening = async () => {
    setStarting(true);
    try {
      const res = await apiClient.post<{ visit: { id: string } }>("/api/facility/visits", { patientId });
      router.push(`/facility/visits/${res.visit.id}/screening`);
    } catch (e: any) {
      msg.error(tv("start_failed"), tv("start_failed_hint", { error: e.message || tc("network_error") }), { retry: startScreening, retryLabel: tc("retry") });
      setStarting(false);
    }
  };

  if (!latest || !latest.l1Screening) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 text-center">
        <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">{showStartButton ? tv("no_screening") : tv("no_screening_any")}</p>
        {showStartButton && (
          <Button size="sm" onClick={startScreening} disabled={starting}>
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {tv("start_screening")}
          </Button>
        )}
        <NoticeSlot state={msg} className="mt-3 text-start" />
      </Card>
    );
  }

  const screening = latest.l1Screening;
  const chiefComplaints: string[] = (() => { try { return JSON.parse(screening.chiefComplaints); } catch { return []; } })();

  return (
    <Card className="relative overflow-hidden p-4 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl gap-2">
      <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

      {/* Header — icon, title and a compact New Screening action on one row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border bg-primary/10 border-primary/20 text-primary">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{tv("l1")}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{daysAgo(latest.visitDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showStartButton && (
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={startScreening} disabled={starting}>
              {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} {tv("new_screening")}
            </Button>
          )}
        </div>
      </div>

      {/* Complaints, on one compact line */}
      {chiefComplaints.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5">
          {chiefComplaints.map((c) => (
            <Badge key={c} variant="outline" className="text-[11px] bg-background/60 border-border/50 font-normal">{c}</Badge>
          ))}
        </div>
      )}

      {/* Hakeem Insight — folded into the same card, right after the result summary. */}
      {screening.aiSummary && <InsightBody aiSummary={screening.aiSummary} flag={null} />}

      {pastVisits.length > 1 && (
        <Button
          size="sm" variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground self-start -mt-1"
          onClick={() => setHistoryOpen(true)}
        >
          <History className="h-3 w-3" /> {tv("view_earlier", { count: pastVisits.length - 1 })}
        </Button>
      )}

      <NoticeSlot state={msg} />
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5"><History className="h-4 w-4" /> {tv("history")}</DialogTitle>
          </DialogHeader>
          <Accordion type="single" collapsible defaultValue={pastVisits[0]?.id}>
            {pastVisits.map((v, i) => (
              <HistoryEntry key={v.id} visit={v} isCurrent={i === 0} />
            ))}
          </Accordion>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
