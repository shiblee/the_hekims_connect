"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { LoadFailed, NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NotebookPen, X, Loader2 } from "lucide-react";

export interface ResidentClinicalNoteHandle {
  save: () => Promise<void>;
}

export const ResidentClinicalNote = forwardRef<ResidentClinicalNoteHandle, { visitId: string }>(function ResidentClinicalNote({ visitId }, ref) {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const msg = useNotice();

  useEffect(() => {
    api.get<{ note: { points: string } | null }>(`/api/facility/visits/${visitId}/resident-notes`)
      .then((res) => {
        setLoadError(null);
        try { setPoints(JSON.parse(res.note?.points || "[]")); } catch { setPoints([]); }
      })
      .catch((e) => setLoadError(e.message || "Network error"))
      .finally(() => setLoading(false));
  }, [visitId, reloadTick]);

  const commit = () => {
    const text = draft.trim();
    if (!text) return;
    setPoints((prev) => [...prev, text]);
    setDraft("");
  };

  const removePoint = (idx: number) => setPoints((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    // Guard against the unified Save Draft/Proceed button firing before this
    // panel's own initial fetch has resolved — `points` would still be the
    // empty initial state, and posting it would wipe out whatever was
    // already saved for this visit.
    // Same for a note that failed to load.
    if (loading || loadError) return;
    try {
      await api.post(`/api/facility/visits/${visitId}/resident-notes`, { points });
      msg.clear();
    } catch (e: any) {
      msg.error("The clinical note wasn't saved", `${e.message || "Network error"}. Your points are still listed above.`, { retry: () => { save().catch(() => {}); } });
      throw e;
    }
  };

  useImperativeHandle(ref, () => ({ save }), [points, loading, loadError, msg]);

  if (loadError) return <LoadFailed what="the resident clinical note" detail={loadError} onRetry={() => { setLoading(true); setReloadTick((t) => t + 1); }} />;

  if (loading) {
    return (
      <Card className="p-4 border-border/50 bg-card/60 flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </Card>
    );
  }

  return (
    <Card className="p-4 border-border/50 bg-card/60 gap-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <NotebookPen className="h-3.5 w-3.5 text-primary" /> Resident Clinical Note
      </p>

      {points.length > 0 && (
        <ul className="space-y-1.5">
          {points.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-primary shrink-0 mt-0.5">•</span>
              <span className="flex-1 min-w-0">{p}</span>
              <button type="button" onClick={() => removePoint(i)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        placeholder="Type a point and press Enter…"
        className="bg-background/60"
      />
      <NoticeSlot state={msg} />
    </Card>
  );
});
