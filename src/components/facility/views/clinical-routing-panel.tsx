"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Milestone, Sparkles, Loader2 } from "lucide-react";

interface Routing { priorityLevel: string; triageStream: string; justification: string }

export function ClinicalRoutingPanel({ visitId }: { visitId: string }) {
  const [routing, setRouting] = useState<Routing | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "unavailable">("idle");

  // The last "Generate" is persisted server-side — load it so a reload
  // shows what was actually generated for this visit instead of going
  // blank until someone clicks Generate again.
  useEffect(() => {
    api.get<{ routing: Routing | null }>(`/api/facility/visits/${visitId}/clinical-routing-insight`)
      .then((res) => { if (res.routing) setRouting(res.routing); })
      .catch(() => {});
  }, [visitId]);

  const generate = async () => {
    setState("loading");
    try {
      const res = await api.post<{ routing: Routing | null; unavailable?: boolean }>(`/api/facility/visits/${visitId}/clinical-routing-insight`, {});
      if (res.routing) {
        setRouting(res.routing);
        setState("idle");
      } else {
        setState("unavailable");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not generate a routing suggestion");
      setState("idle");
    }
  };

  return (
    <Card className="p-4 border-border/50 bg-card/60 gap-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Milestone className="h-3.5 w-3.5 text-primary" /> Clinical Routing
        </p>
        <Button size="sm" variant="outline" onClick={generate} disabled={state === "loading"}>
          {state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate
        </Button>
      </div>

      {routing && (
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-foreground">{routing.priorityLevel}</p>
          <p className="text-xs text-muted-foreground">
            Assigned to <span className="font-medium text-foreground">{routing.triageStream}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">{routing.justification}</p>
          <p className="text-[10px] text-muted-foreground italic mt-1">Suggested by Hakeem Insight from this visit's recorded data — decision support only, not a diagnosis. Confirm before acting.</p>
        </div>
      )}
      {state === "unavailable" && <p className="text-xs text-muted-foreground">Hakeem Insight isn&apos;t available right now.</p>}
      {!routing && state === "idle" && <p className="text-xs text-muted-foreground">Generate a suggested priority level and triage stream from this visit's recorded data.</p>}
    </Card>
  );
}
