"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, Loader2 } from "lucide-react";

interface HumoralAssessmentData {
  safraPercent: number; damPercent: number; saudaPercent: number; balghamPercent: number;
  dominant: string; dominantOverride: string | null;
  aiClue: string | null; aiClueGeneratedAt: string | null;
}
interface HumorDisplayRow { humor: string; axisLabel: string; unaniLabel: string; description: string | null }

const HUMOR_KEYS = ["dam", "safra", "balgham", "sauda"] as const; // Air, Fire, Water, Earth display order
const HUMOR_TO_DOMINANT: Record<string, string> = { safra: "Safra", dam: "Dam", sauda: "Sauda", balgham: "Balgham" };
const PERCENT_FIELD: Record<string, keyof HumoralAssessmentData> = {
  safra: "safraPercent", dam: "damPercent", sauda: "saudaPercent", balgham: "balghamPercent",
};

export interface HumoralCluesPanelHandle {
  /** Re-fetches the computed tile percentages — the Chief Complaint Matrix
   * recomputes HumoralAssessment server-side on its own save, which this
   * panel has no other way of finding out about (it fetches once on mount),
   * so the bottom Save Draft/Proceed bar calls this after a successful save
   * to keep the tiles from showing stale, pre-save percentages. */
  refresh: () => void;
}

interface HumoralCluesPanelProps {
  visitId: string;
  // Runs right before Generate computes anything — lets the parent persist
  // the Chief Complaint Matrix's current (possibly still-unsaved) draft
  // first, since the tile percentages are computed server-side from saved
  // ComplaintAssessment rows. This is what makes Generate self-sufficient:
  // the doctor never has to click the bottom Save Draft bar first.
  onBeforeGenerate?: () => Promise<void>;
}

export const HumoralCluesPanel = forwardRef<HumoralCluesPanelHandle, HumoralCluesPanelProps>(function HumoralCluesPanel({ visitId, onBeforeGenerate }, ref) {
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<HumoralAssessmentData | null>(null);
  const [displayConfig, setDisplayConfig] = useState<HumorDisplayRow[]>([]);
  const [overriding, setOverriding] = useState(false);
  const [clue, setClue] = useState<string | null>(null);
  const [clueState, setClueState] = useState<"idle" | "loading" | "unavailable">("idle");
  const msg = useNotice();

  const load = () => {
    Promise.all([
      api.get<{ humoralAssessment: HumoralAssessmentData | null }>(`/api/facility/visits/${visitId}/complaint-assessments`),
      api.get<{ displayConfig: HumorDisplayRow[] }>("/api/facility/humor/config"),
    ])
      .then(([ca, cfg]) => {
        setAssessment(ca.humoralAssessment);
        setDisplayConfig(cfg.displayConfig || []);
        // Persisted server-side — reflects this visit's last-generated clue
        // (or none, if a recompute since then cleared it server-side
        // because it no longer matched the new percentages).
        setClue(ca.humoralAssessment?.aiClue ?? null);
        setClueState("idle");
      })
      .catch((e) => msg.error("Couldn't load the humoral assessment", `${e.message || "Network error"}. The figures below may be out of date.`, { retry: load }))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [visitId]);

  useImperativeHandle(ref, () => ({ refresh: load }));

  const effectiveDominant = assessment ? (assessment.dominantOverride ?? assessment.dominant) : null;

  const pickTile = async (humorKey: string) => {
    const dominantOverride = HUMOR_TO_DOMINANT[humorKey];
    if (!assessment || dominantOverride === effectiveDominant) return;
    setOverriding(true);
    try {
      await api.patch(`/api/facility/visits/${visitId}/humoral-assessment`, { dominantOverride });
      setAssessment((prev) => (prev ? { ...prev, dominantOverride } : prev));
    } catch (e: any) {
      msg.error("The constitutional tendency wasn't changed", `${e.message || "Network error"}. Pick the tile again to retry.`);
    } finally {
      setOverriding(false);
    }
  };

  const generateClue = async () => {
    setClueState("loading");
    if (onBeforeGenerate) {
      try {
        await onBeforeGenerate();
      } catch {
        // The Chief Complaint Matrix shows the specific failure in place.
        msg.warning("Clues need the Chief Complaint Matrix saved first", "It couldn't be saved — see the message in the matrix, then press Generate again.");
        setClueState("idle");
        return;
      }
    }
    try {
      // Pick up the percentages onBeforeGenerate just (re)computed server-side
      // — without this the tiles would keep showing whatever was fetched on
      // mount, possibly stale or still empty.
      const ca = await api.get<{ humoralAssessment: HumoralAssessmentData | null }>(`/api/facility/visits/${visitId}/complaint-assessments`);
      setAssessment(ca.humoralAssessment);

      const res = await api.post<{ clue: string | null; unavailable?: boolean }>(`/api/facility/visits/${visitId}/humoral-clues-insight`, {});
      if (res.clue) {
        setClue(res.clue);
        setClueState("idle");
      } else {
        setClue(null);
        setClueState("unavailable");
      }
    } catch (e: any) {
      msg.error("Hakeem Insight couldn't explain the clues just now", `${e.message || "Network error"}.`, { retry: generateClue, retryLabel: "Generate again" });
      setClueState("idle");
    }
  };

  const configFor = (humor: string) => displayConfig.find((d) => d.humor === humor);

  if (loading) {
    return (
      <Card className="p-4 border-border/50 bg-card/60 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <Card className="p-4 border-border/50 bg-card/60 gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> Quick Humoral Clues
        </p>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-[10px]">Preliminary</Badge>
          <Button size="sm" variant="outline" onClick={generateClue} disabled={clueState === "loading"}>
            {clueState === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Generate
          </Button>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Probable Primary Constitutional Tendency</p>
        {!assessment ? (
          <p className="text-xs text-muted-foreground">Not enough data yet — click Generate, or fill in the Chief Complaint Matrix, to compute this.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {HUMOR_KEYS.map((key) => {
              const cfg = configFor(key);
              const selected = HUMOR_TO_DOMINANT[key] === effectiveDominant;
              const pct = assessment[PERCENT_FIELD[key]] as number;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickTile(key)}
                  disabled={overriding}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-left transition-colors",
                    selected ? "border-primary bg-primary/10" : "border-border/50 bg-background/40 hover:border-primary/30"
                  )}
                >
                  <p className={cn("text-xs font-semibold", selected && "text-primary")}>{cfg?.axisLabel || key}</p>
                  <p className="text-[10px] text-muted-foreground">{cfg?.unaniLabel || ""}{cfg?.description ? ` · ${cfg.description}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{pct}%</p>
                </button>
              );
            })}
          </div>
        )}
        {assessment?.dominantOverride && (
          <p className="text-[10px] text-muted-foreground mt-1.5 italic">Doctor-overridden — computed engine pick was {assessment.dominant}.</p>
        )}
      </div>

      {clue ? (
        <p className="text-sm leading-relaxed border-l-2 border-primary/30 pl-3">{clue}</p>
      ) : clueState === "unavailable" ? (
        <p className="text-xs text-muted-foreground">Hakeem Insight isn&apos;t available right now.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Generate a plain-language explanation of the computed tendency above, from this visit&apos;s current findings.</p>
      )}
      <NoticeSlot state={msg} />
    </Card>
  );
});
