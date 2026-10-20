"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Q {
  dossiers: Record<string, number>; versions: Record<string, number>; returned: number;
  working: { total: number; fromCatalogue: number; bySource: { hakim: number; engine: number; ai: number } };
  topDiagnoses: { label: string; count: number }[];
  ai: { runs: number; failed: number; deep: number; avgLatencyMs: number | null; inputTokens: number; outputTokens: number; feedback: Record<string, number>; agreement: { judged: number; top3: number }; removed: { why: string; count: number }[] };
  engine: { runs: number; accepted: number }; safety: Record<string, number>; catalogue: Record<string, number>;
}
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card className="p-4 gap-1 border-border/50">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

/** Admin → Meta → Tashkhees & Ilaj → Quality: Stage 5 usage, agreement and safety, for supervised review. */
export function TashkheesQuality() {
  const [q, setQ] = useState<Q | null>(null);
  useEffect(() => { adminApi.get<Q>("/api/admin/tashkhees-quality").then(setQ).catch((e) => toast.error(e.message || "Couldn't load quality figures")); }, []);
  if (!q) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  const fb = q.ai.feedback;
  const fbTotal = Object.values(fb).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-5">
      <Card className="p-4 gap-1 border-border/50">
        <p className="text-sm font-semibold">Stage 5 quality</p>
        <p className="text-sm text-muted-foreground">How dossiers, the rule engines, the reasoning assistant and the safety review are being used, and how often the suggestions match what Hakims finally decide. For supervised review — nothing here changes the engines automatically.</p>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Finalised dossiers" value={q.dossiers.finalized ?? 0} sub={`${q.dossiers.draft ?? 0} draft · ${q.dossiers.submitted ?? 0} awaiting sign-off`} />
        <Stat label="Amendments" value={q.versions.amended ?? 0} sub={`${q.returned} sent back by seniors`} />
        <Stat label="Working diagnosis from catalogue" value={pct(q.working.fromCatalogue, q.working.total)} sub={`${q.working.total} finalised · ${q.working.bySource.engine} from differential · ${q.working.bySource.ai} from AI`} />
        <Stat label="Temperament suggestion accepted" value={pct(q.engine.accepted, q.engine.runs)} sub={`${q.engine.runs} engine runs`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="AI reasoning runs" value={q.ai.runs} sub={`${q.ai.failed} failed · ${q.ai.deep} deep`} />
        <Stat label="AI top-3 agreement" value={pct(q.ai.agreement.top3, q.ai.agreement.judged)} sub={`working diagnosis among the assistant's first 3, in ${q.ai.agreement.judged} finalised cases`} />
        <Stat label="Hakim feedback" value={fbTotal} sub={`useful ${fb.useful ?? 0} · incomplete ${fb.incomplete ?? 0} · wrong ${fb.wrong ?? 0} · unsafe ${fb.unsafe ?? 0}`} />
        <Stat label="AI usage" value={q.ai.avgLatencyMs != null ? `${(q.ai.avgLatencyMs / 1000).toFixed(1)} s` : "—"} sub={`average answer time · ${q.ai.inputTokens.toLocaleString()} in / ${q.ai.outputTokens.toLocaleString()} out tokens`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-3">
        <Card className="p-4 gap-2 border-border/50">
          <p className="text-sm font-semibold">Most common working diagnoses</p>
          {q.topDiagnoses.length ? <ul className="space-y-1 text-sm">{q.topDiagnoses.map((d) => <li key={d.label} className="flex justify-between gap-2"><span className="min-w-0 truncate">{d.label}</span><span className="tabular-nums text-muted-foreground">{d.count}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">None finalised yet.</p>}
        </Card>
        <Card className="p-4 gap-2 border-border/50">
          <p className="text-sm font-semibold">What the AI safety check removed</p>
          {q.ai.removed.length ? <ul className="space-y-1 text-sm">{q.ai.removed.map((r) => <li key={r.why} className="flex justify-between gap-2"><span className="min-w-0">{r.why}</span><span className="tabular-nums text-muted-foreground">{r.count}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Nothing removed yet.</p>}
        </Card>
        <Card className="p-4 gap-2 border-border/50">
          <p className="text-sm font-semibold">Safety review and catalogue</p>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between"><span>High-risk items acknowledged</span><span className="tabular-nums text-muted-foreground">{q.safety.high ?? 0}</span></li>
            <li className="flex justify-between"><span>Caution items acknowledged</span><span className="tabular-nums text-muted-foreground">{q.safety.caution ?? 0}</span></li>
            <li className="flex justify-between"><span>Amraz approved</span><span className="tabular-nums text-muted-foreground">{q.catalogue.approved ?? 0}</span></li>
            <li className="flex justify-between"><span>Amraz unverified</span><span className="tabular-nums text-muted-foreground">{q.catalogue.draft ?? 0}</span></li>
            <li className="flex justify-between"><span>Amraz rejected</span><span className="tabular-nums text-muted-foreground">{q.catalogue.rejected ?? 0}</span></li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
