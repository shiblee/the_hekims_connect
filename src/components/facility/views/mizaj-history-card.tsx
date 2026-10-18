"use client";

import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

// Colours for the Mizaj History balance bar.
const AKHLAT = [
  { key: "dam", color: "oklch(0.62 0.2 25)" },
  { key: "saffra", color: "oklch(0.78 0.14 80)" },
  { key: "balgham", color: "oklch(0.7 0.13 220)" },
  { key: "sauda", color: "oklch(0.5 0.15 300)" },
] as const;

interface Assessment {
  id: string; createdAt: string; result: string; pulse: string | null;
  dam: number; saffra: number; balgham: number; sauda: number;
}

/** The patient's earlier Mizaj assessments (right column of Stages 3–4); hidden when there are none. */
export function MizajHistoryCard({ patientId }: { patientId: string }) {
  const [history, setHistory] = useState<Assessment[]>([]);
  useEffect(() => {
    let cancelled = false;
    api.get<{ assessments: Assessment[] }>(`/api/mizaj?patientId=${patientId}`)
      .then((r) => { if (!cancelled) setHistory(r.assessments || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [patientId]);

  if (!history.length) return null;
  return (
    <Card className="p-5 border-border/50 bg-card/60">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-primary" />
        <h3 className="font-serif text-base font-semibold">Mizaj History</h3>
      </div>
      <div className="space-y-3">
        {history.map((a) => (
          <div key={a.id} className="rounded-lg bg-background/40 p-3 border border-border/30">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[13px] font-semibold text-primary">{a.result.split(" — ")[0]}</p>
              <span className="text-[11px] text-muted-foreground">{new Date(a.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex gap-1 h-1.5 rounded-full overflow-hidden mb-2">
              {AKHLAT.map((k) => (
                <div key={k.key} style={{ width: `${a[k.key]}%`, background: k.color }} />
              ))}
            </div>
            {a.pulse && <p className="text-xs text-muted-foreground">Pulse: {a.pulse}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
