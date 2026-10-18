"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { SectionHeading } from "@/components/shared/section-heading";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { FloatingMultiSelect } from "@/components/shared/floating-field";
import { Loader2, ListChecks } from "lucide-react";

interface SymptomTag { id: string; label: string; description: string | null }

export interface AcuteSymptomsPanelHandle {
  save: () => Promise<void>;
}

export const AcuteSymptomsPanel = forwardRef<AcuteSymptomsPanelHandle, { visitId: string }>(function AcuteSymptomsPanel({ visitId }, ref) {
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<SymptomTag[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
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

  const q = query.trim().toLowerCase();
  // Search the admin list by name or description; with nothing typed, offer the first few.
  const suggestions = tags
    .filter((t) => !selected.includes(t.label) && (!q || t.label.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)))
    .slice(0, q ? 12 : 6)
    .map((t) => ({ id: t.label, label: t.label, description: t.description }));
  const addOther = (text: string) => {
    const match = tags.find((t) => t.label.toLowerCase() === text.toLowerCase());
    const label = match ? match.label : text;
    setSelected((cur) => (cur.some((x) => x.toLowerCase() === label.toLowerCase()) ? cur : [...cur, label]));
  };

  return (
    <Card className="p-4 gap-3 border-border/50 bg-card">
      <SectionHeading
        icon={ListChecks}
        title="Other Symptoms"
        right={
          <span className={cn(
            "rounded-full border px-2.5 py-1 text-[13px] font-semibold",
            selected.length ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground",
          )}>
            {selected.length ? `${selected.length} noted` : "None noted"}
          </span>
        }
      />

      <FloatingMultiSelect
        id="otherSymptomSearch"
        label="Search other symptoms"
        placeholder="Type a symptom — e.g. thirst, nausea, insomnia…"
        openOnFocus
        emptyHint={tags.length > 6 ? `Common symptoms · type to search all ${tags.length}` : "Symptoms"}
        selected={selected.map((label) => {
          const t = tags.find((x) => x.label === label);
          return { id: label, label, description: t ? t.description : "Added by staff" };
        })}
        onRemove={(label) => setSelected((cur) => cur.filter((x) => x !== label))}
        query={query}
        onQueryChange={setQuery}
        results={suggestions}
        describe={(t) => t.description}
        onPick={(label) => toggle(label)}
        onCreate={addOther}
        createLabel={(q) => `Add "${q}" as another symptom`}
      />
      <NoticeSlot state={msg} />
    </Card>
  );
});
