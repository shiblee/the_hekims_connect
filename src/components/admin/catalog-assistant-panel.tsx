"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Everything that differs between catalog assistants (complaints, allergies, ...). */
export interface CatalogAssistantConfig {
  label: string;
  description: string;
  /** e.g. "/api/admin/allergy-assistant" — must expose run, runs, suggestions. */
  apiBase: string;
  /** Plain-language noun for one generated entry, e.g. "allergy". */
  itemNoun: { singular: string; plural: string };
  intervalDescription: string;
  logTitle: string;
  logDescription: string;
  /** Field on each log entry holding its group badge, e.g. "category" or "allergenType". */
  groupKey?: "category" | "allergenType" | "herbType" | "drugClass";
  /** Supports approve/reject for any legacy "pending" entries. */
  reviewable?: boolean;
  reviewApprovedToast?: string;
}

interface LogEntry {
  id: string; label: string; status: string; createdAt: string; rationale: string | null;
  labelLocal?: string | null; category?: string | null; allergenType?: string | null; herbType?: string | null; drugClass?: string | null;
}
interface Run { id: string; trigger: string; status: string; suggestionsCount: number; errorMessage: string | null; startedAt: string }

const INTERVAL_OPTIONS = [
  { value: "15", label: "15 minutes" }, { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" }, { value: "120", label: "2 hours" },
  { value: "360", label: "6 hours" }, { value: "720", label: "12 hours" },
  { value: "1440", label: "24 hours" }, { value: "2880", label: "48 hours" },
];

const RUN_STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  no_candidates: "bg-muted text-muted-foreground border-border/50",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  running: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
};
const RUN_STATUS_LABEL: Record<string, string> = {
  success: "Success", no_candidates: "No new candidates", failed: "Failed", running: "Running",
};
const ENTRY_STATUS_STYLE: Record<string, string> = {
  auto_approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};
const ENTRY_STATUS_LABEL: Record<string, string> = {
  auto_approved: "Published automatically", approved: "Approved", pending: "Pending review", rejected: "Rejected",
};

/** Enable toggle + interval picker, bound to the Settings page's own draft/save flow. */
export function CatalogAssistantControls({
  config, enabled, interval, onEnabledChange, onIntervalChange,
}: {
  config: CatalogAssistantConfig;
  enabled: boolean;
  interval: string;
  onEnabledChange: (v: boolean) => void;
  onIntervalChange: (v: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3.5">
        <div>
          <p className="text-sm font-medium">Enable scheduled runs</p>
          <p className="text-xs text-muted-foreground mt-0.5">When off, this only runs when you click &quot;Run Now&quot; below.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/60 px-4 py-3.5">
        <div>
          <p className="text-sm font-medium">Scheduler interval</p>
          <p className="text-xs text-muted-foreground mt-0.5">{config.intervalDescription}</p>
        </div>
        <Select value={interval} onValueChange={onIntervalChange}>
          <SelectTrigger className="bg-background/60 w-44 shrink-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTERVAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

/** Run Now, the full generated-entries log, and recent run history. Loads its own data. */
export function CatalogAssistantLog({ config }: { config: CatalogAssistantConfig }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      adminApi.get<{ suggestions: LogEntry[] }>(`${config.apiBase}/suggestions`),
      adminApi.get<{ runs: Run[] }>(`${config.apiBase}/runs`),
    ])
      .then(([e, r]) => { setEntries(e.suggestions); setRuns(r.runs); })
      .catch(() => toast.error(`Could not load the ${config.label}'s data`))
      .finally(() => setLoading(false));
  };

  useEffect(load, [config.apiBase]);

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await adminApi.post<{ run: Run }>(`${config.apiBase}/run`, {});
      const n = res.run.suggestionsCount;
      if (res.run.status === "success") toast.success(`${n} new ${n === 1 ? config.itemNoun.singular : config.itemNoun.plural} added`);
      else if (res.run.status === "no_candidates") toast.info("No new candidates this run");
      else toast.error(res.run.errorMessage || "The run failed");
      load();
    } catch (err: any) {
      toast.error(err.message || "Could not start the run");
    } finally {
      setRunning(false);
    }
  };

  const review = async (id: string, action: "approve" | "reject") => {
    setReviewingId(id);
    try {
      await adminApi.post(`${config.apiBase}/suggestions/${id}/${action}`, {});
      toast.success(action === "approve" ? (config.reviewApprovedToast || "Approved") : "Rejected");
      load();
    } catch (err: any) {
      toast.error(err.message || `Could not ${action} this entry`);
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="mt-8 space-y-6 pt-6 border-t border-border/50">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-serif text-base font-semibold">{config.logTitle}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{config.logDescription}</p>
        </div>
        <Button size="sm" variant="outline" onClick={runNow} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Run Now
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <div className="space-y-2.5">
            {entries.length === 0 && <p className="text-sm text-muted-foreground">Nothing generated yet.</p>}
            {entries.map((s) => {
              const group = config.groupKey ? s[config.groupKey] : null;
              return (
                <div key={s.id} className="rounded-xl border border-border/60 bg-background/60 p-4 flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{s.label}</p>
                      {s.labelLocal && <span className="text-xs text-muted-foreground">{s.labelLocal}</span>}
                      {group && <Badge variant="outline" className="text-[10px]">{group}</Badge>}
                      <Badge variant="outline" className={cn("text-[10px]", ENTRY_STATUS_STYLE[s.status])}>{ENTRY_STATUS_LABEL[s.status] || s.status}</Badge>
                    </div>
                    {s.rationale && <p className="text-xs text-muted-foreground mt-1.5">{s.rationale}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1.5">{new Date(s.createdAt).toLocaleString()}</p>
                  </div>
                  {config.reviewable && s.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm" variant="outline"
                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                        disabled={reviewingId === s.id}
                        onClick={() => review(s.id, "reject")}
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" disabled={reviewingId === s.id} onClick={() => review(s.id, "approve")}>
                        {reviewingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div>
            <h3 className="font-serif text-base font-semibold mb-3">Recent Runs</h3>
            <div className="space-y-1.5">
              {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
              {runs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3.5 py-2.5 text-sm flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">{new Date(r.startedAt).toLocaleString()}</span>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{r.trigger}</Badge>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", RUN_STATUS_STYLE[r.status])}>{RUN_STATUS_LABEL[r.status] || r.status}</Badge>
                    {r.errorMessage && <span className="text-xs text-destructive truncate">{r.errorMessage}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {r.suggestionsCount} new {r.suggestionsCount === 1 ? config.itemNoun.singular : config.itemNoun.plural}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
