"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, ShieldAlert, ShieldCheck, Sparkles, Loader2, Plus, RotateCcw, ListChecks, Flag,
  FileSearch, TriangleAlert, Leaf, Target,
} from "lucide-react";

interface ScreeningVisit {
  id: string; visitDate: string;
  l1Screening: {
    id: string; chiefComplaints: string; overallFlag: string | null; aiSummary: string | null; updatedAt: string;
    answers?: { flagTriggered: string | null }[];
  } | null;
}

const FLAG_STYLE: Record<string, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};
const FLAG_LABEL: Record<string, string> = { red: "High Risk", yellow: "Needs Review", green: "Low Risk" };
const FLAG_BAR: Record<string, string> = { red: "from-destructive via-destructive/60 to-destructive", yellow: "from-amber-400 via-amber-400/60 to-amber-400", green: "from-emerald-500 via-emerald-500/60 to-emerald-500" };
const FLAG_TEXT: Record<string, string> = { red: "text-destructive", yellow: "text-amber-600 dark:text-amber-400", green: "text-emerald-600 dark:text-emerald-400" };
const FINDING_STYLE: Record<string, string> = { ...FLAG_STYLE, neutral: "bg-muted/60 text-muted-foreground border-border/40" };
const FINDING_DOT: Record<string, string> = { red: "bg-destructive", yellow: "bg-amber-400", green: "bg-emerald-500", neutral: "bg-muted-foreground/50" };

interface ScreeningInsightData {
  headline: string;
  findings: { text: string; severity: "red" | "yellow" | "green" | "neutral" }[];
  unani: string;
  priority: string;
}

export function latestScreeningOf(visits: ScreeningVisit[]) {
  return [...visits]
    .filter((v) => v.l1Screening)
    .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime())[0];
}

// The AI prompt asks for labeled paragraphs ("Presenting Picture: ...",
// "Danger Signs: ...", etc). Parse those out so they can be rendered as
// distinct, scannable sections instead of one wall of text — falls back to a
// single unlabeled paragraph for older summaries saved before this format.
const INSIGHT_LABELS = ["Presenting Picture", "Danger Signs", "Unani Perspective", "Priority for the Doctor"];

function parseInsightSections(text: string): { label: string | null; body: string }[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p) => {
    const label = INSIGHT_LABELS.find((l) => p.startsWith(`${l}:`));
    return label ? { label, body: p.slice(label.length + 1).trim() } : { label: null, body: p };
  });
}

// Per-section visual identity so a physician can scan by icon/color instead
// of reading every label — Danger Signs is handled separately below since its
// color should reflect the actual computed flag, not a fixed one.
const SECTION_META: Record<string, { icon: typeof FileSearch; className: string }> = {
  "Presenting Picture": { icon: FileSearch, className: "bg-muted/50 text-foreground/70 border-border/40" },
  "Unani Perspective": { icon: Leaf, className: "bg-primary/10 text-primary border-primary/20" },
  "Priority for the Doctor": { icon: Target, className: "bg-accent/10 text-accent border-accent/30" },
};

type ParsedInsight =
  | { kind: "json"; data: ScreeningInsightData }
  | { kind: "sections"; sections: { label: string | null; body: string }[] }
  | { kind: "plain"; text: string };

/**
 * The AI now returns a JSON-encoded ScreeningInsight (headline + short
 * severity-tagged findings + Unani note + priority) so the UI can show a
 * scannable chip-based summary instead of prose. Older records predate this:
 * some are labeled-paragraph prose, some are a single plain paragraph. Try
 * each format in turn so every vintage of stored summary still renders well.
 */
function parseInsight(text: string): ParsedInsight {
  try {
    const parsed = JSON.parse(text);
    if (
      parsed && typeof parsed.headline === "string" && Array.isArray(parsed.findings) &&
      typeof parsed.unani === "string" && typeof parsed.priority === "string"
    ) {
      return { kind: "json", data: parsed as ScreeningInsightData };
    }
  } catch {
    // not JSON — fall through to the prose formats
  }
  const sections = parseInsightSections(text);
  if (sections.filter((s) => s.label).length >= 2) return { kind: "sections", sections };
  return { kind: "plain", text };
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

  const latest = latestScreeningOf(visits);

  const startScreening = async () => {
    setStarting(true);
    try {
      const res = await apiClient.post<{ visit: { id: string } }>("/api/facility/visits", { patientId });
      router.push(`/facility/visits/${res.visit.id}/screening`);
    } catch (e: any) {
      toast.error(e.message || "Could not start a screening");
      setStarting(false);
    }
  };

  if (!latest || !latest.l1Screening) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 text-center">
        <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No L1 Screening recorded yet{showStartButton ? "." : " at any facility."}</p>
        {showStartButton && (
          <Button size="sm" onClick={startScreening} disabled={starting}>
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Start Screening
          </Button>
        )}
      </Card>
    );
  }

  const screening = latest.l1Screening;
  const chiefComplaints: string[] = (() => { try { return JSON.parse(screening.chiefComplaints); } catch { return []; } })();
  const answers = screening.answers || [];
  const flaggedCount = answers.filter((a) => a.flagTriggered).length;
  const flag = screening.overallFlag;

  return (
    <Card className="relative overflow-hidden p-4 border-border/40 bg-card/95 shadow-lg shadow-black/5 rounded-2xl gap-2">
      <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", flag ? FLAG_BAR[flag] : "from-primary via-accent to-primary")} />

      {/* Header — icon, title, overall flag, and a compact New Screening action all on one row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border",
            flag ? FLAG_STYLE[flag] : "bg-primary/10 border-primary/20 text-primary"
          )}>
            {flag ? <ShieldAlert className="h-4.5 w-4.5" /> : <ShieldCheck className="h-4.5 w-4.5" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">L1 Screening</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{daysAgo(latest.visitDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {flag && (
            <Badge variant="outline" className={cn("border text-xs font-medium", FLAG_STYLE[flag])}>
              {FLAG_LABEL[flag] || flag}
            </Badge>
          )}
          {showStartButton && (
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={startScreening} disabled={starting}>
              {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />} New Screening
            </Button>
          )}
        </div>
      </div>

      {/* Complaints + mini stats, on one compact line */}
      {(chiefComplaints.length > 0 || answers.length > 0) && (
        <div className="flex items-center flex-wrap gap-1.5">
          {chiefComplaints.map((c) => (
            <Badge key={c} variant="outline" className="text-[11px] bg-background/60 border-border/50 font-normal">{c}</Badge>
          ))}
          {answers.length > 0 && (
            <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
              <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" /> {answers.length} assessed</span>
              {flaggedCount > 0 && (
                <span className={cn("flex items-center gap-1 font-medium", flag ? FLAG_TEXT[flag] : "text-foreground")}>
                  <Flag className="h-3 w-3" /> {flaggedCount} flagged
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* AI Insight — folded into the same card, right after the result summary.
          Primary format: a one-line headline + short severity-colored finding
          chips a doctor can scan in a couple of seconds without reading prose.
          Two older formats are supported as fallbacks for summaries saved
          before this format existed: labeled-paragraph prose (rendered as an
          icon-coded grid) and plain single-paragraph prose. */}
      {screening.aiSummary && (() => {
        const parsed = parseInsight(screening.aiSummary);
        return (
          <div className="rounded-xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent border border-primary/15 p-3 space-y-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> AI Clinical Insight
            </p>

            {parsed.kind === "json" && (
              <div className="space-y-2.5">
                <p className="text-sm font-semibold text-foreground leading-snug">{parsed.data.headline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsed.data.findings.map((f, i) => (
                    <span key={i} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border", FINDING_STYLE[f.severity] || FINDING_STYLE.neutral)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", FINDING_DOT[f.severity] || FINDING_DOT.neutral)} /> {f.text}
                    </span>
                  ))}
                </div>
                {parsed.data.unani && (
                  <p className="text-xs text-primary flex items-start gap-1.5">
                    <Leaf className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {parsed.data.unani}
                  </p>
                )}
                {parsed.data.priority && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-accent/10 border border-accent/25 px-2.5 py-1.5">
                    <Target className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-accent">{parsed.data.priority}</p>
                  </div>
                )}
              </div>
            )}

            {parsed.kind === "sections" && (
              <div className="grid sm:grid-cols-2 gap-1.5">
                {parsed.sections.map((s, i) => {
                  const isDanger = s.label === "Danger Signs";
                  const meta = s.label ? SECTION_META[s.label] : null;
                  const Icon = isDanger ? TriangleAlert : meta?.icon;
                  const boxClass = isDanger
                    ? (flag ? FLAG_STYLE[flag] : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20")
                    : meta?.className || "bg-muted/40 text-foreground/70 border-border/40";
                  return (
                    <div key={i} className={cn("rounded-lg p-2.5 border", boxClass)}>
                      <p className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 mb-1">
                        {Icon && <Icon className="h-3 w-3 shrink-0" />} {s.label || "Note"}
                      </p>
                      <p className={cn("text-[13px] leading-snug", isDanger ? "font-medium" : "text-foreground/90")}>{s.body}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {parsed.kind === "plain" && (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{parsed.text}</p>
            )}

            <p className="text-[10px] text-muted-foreground italic">Decision support only — not a diagnosis. Always verify clinically.</p>
          </div>
        );
      })()}
    </Card>
  );
}
