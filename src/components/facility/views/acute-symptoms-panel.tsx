"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <Card className="p-5 border-border/50 bg-card/60">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
            <ListChecks className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-semibold">Other Symptoms</h2>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">{selected.length} selected</Badge>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">No acute symptoms configured yet.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            {tags.map((t) => {
              const checked = selected.includes(t.label);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.label)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    checked ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/40 hover:border-primary/30"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t.label}</span>
                    {t.description && <span className="block text-xs text-muted-foreground mt-0.5">{t.description}</span>}
                  </span>
                  {checked ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
      <NoticeSlot state={msg} className="mt-4" />
    </Card>
  );
});
