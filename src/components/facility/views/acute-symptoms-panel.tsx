"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { SectionHeading } from "@/components/shared/section-heading";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Circle, Loader2, ListChecks } from "lucide-react";

interface SymptomTag { id: string; label: string; description: string | null }

export interface AcuteSymptomsPanelHandle {
  save: () => Promise<void>;
}

export const AcuteSymptomsPanel = forwardRef<AcuteSymptomsPanelHandle, { visitId: string }>(function AcuteSymptomsPanel({ visitId }, ref) {
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<SymptomTag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const msg = useNotice();

  useEffect(() => {
    Promise.all([
      api.get<{ symptoms: SymptomTag[] }>("/api/facility/acute-symptoms"),
      api.get<{ assessment: { symptoms: string } | null }>(`/api/facility/visits/${visitId}/acute-symptoms`),
    ])
      .then(([tagsRes, assessmentRes]) => {
        setLoadError(null);
        setTags(tagsRes.symptoms || []);
        try {
          setSelected(JSON.parse(assessmentRes.assessment?.symptoms || "[]"));
        } catch {
          setSelected([]);
        }
      })
      .catch((e) => setLoadError(e.message || "Network error"))
      .finally(() => setLoading(false));
  }, [visitId, reloadTick]);

  const toggle = (label: string) => {
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  };

  const save = async () => {
    // Guard against the unified Save Draft/Proceed button firing before this
    // panel's own initial fetch has resolved — `selected` would still be the
    // empty initial state, and posting it would wipe out whatever was
    // already saved for this visit.
    // Same for a checklist that failed to load.
    if (loading || loadError) return;
    try {
      await api.post(`/api/facility/visits/${visitId}/acute-symptoms`, { symptoms: selected });
      msg.clear();
    } catch (e: any) {
      msg.error("The other symptoms weren't saved", `${e.message || "Network error"}. Your selection is still shown above.`, { retry: () => { save().catch(() => {}); } });
      throw e;
    }
  };

  useImperativeHandle(ref, () => ({ save }), [selected, loading, loadError, msg]);

  if (loadError) return <LoadFailed what="the other symptoms checklist" detail={loadError} onRetry={() => { setLoading(true); setReloadTick((t) => t + 1); }} />;

  if (loading) {
    return (
      <Card className="p-5 border-border/50 bg-card/60">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading accompanying acute symptoms…
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 gap-3 border-border/50 bg-card">
      <SectionHeading
        icon={ListChecks}
        title="Other Symptoms"
        right={
          <span className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-semibold",
            selected.length ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground",
          )}>
            {selected.length ? `${selected.length} noted` : "None noted"}
          </span>
        }
      />

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No symptoms configured yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const checked = selected.includes(t.label);
            const chip = (
              <button
                type="button"
                aria-pressed={checked}
                onClick={() => toggle(t.label)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border pl-1.5 pr-3 py-1 text-sm transition-all",
                  checked
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : "border-border/60 bg-background/60 text-foreground hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                {checked ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Circle className="h-4.5 w-4.5 text-muted-foreground/50" />}
                {t.label}
              </button>
            );
            return t.description ? (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>{chip}</TooltipTrigger>
                <TooltipContent side="top" className="max-w-60 text-xs">{t.description}</TooltipContent>
              </Tooltip>
            ) : <span key={t.id}>{chip}</span>;
          })}
        </div>
      )}
      <NoticeSlot state={msg} />
    </Card>
  );
});
