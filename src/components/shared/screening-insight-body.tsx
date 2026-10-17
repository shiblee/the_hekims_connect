"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileSearch, TriangleAlert, Leaf, Target } from "lucide-react";

const FLAG_STYLE: Record<string, string> = {
  red: "bg-destructive/15 text-destructive border-destructive/30",
  yellow: "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};
const FINDING_STYLE: Record<string, string> = { ...FLAG_STYLE, neutral: "bg-muted/60 text-muted-foreground border-border/40" };
const FINDING_DOT: Record<string, string> = { red: "bg-destructive", yellow: "bg-amber-400", green: "bg-emerald-500", neutral: "bg-muted-foreground/50" };
const SEVERITY_LABEL: Record<string, string> = { red: "Severe", yellow: "Moderate", green: "Stable" };

interface ScreeningInsightData {
  headline: string;
  findings: { text: string; severity: "red" | "yellow" | "green" | "neutral" }[];
  unani: string;
  priority: string;
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

/**
 * Renders one screening's AI insight — the headline + severity chips (JSON
 * format), or one of the two older prose fallbacks. Shared by every place an
 * L1 Screening's AI summary is shown (the patient profile's screening card,
 * its history dialog, and the screening form's own results step) so a given
 * summary reads identically wherever it appears, and a raw JSON string is
 * never dumped straight into the page.
 */
export function InsightBody({ aiSummary, flag }: { aiSummary: string; flag: string | null }) {
  const parsed = parseInsight(aiSummary);
  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent border border-primary/15 p-3 space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Hakeem Insight
      </p>

      {parsed.kind === "json" && (
        <div className="space-y-2.5">
          <p className="text-sm font-semibold text-foreground leading-snug">{parsed.data.headline}</p>
          <div className="divide-y divide-border/30">
            {parsed.data.findings.map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", FINDING_DOT[f.severity] || FINDING_DOT.neutral)} />
                  <span className="text-sm text-foreground/90 truncate">{f.text}</span>
                </span>
                {f.severity !== "neutral" && (
                  <Badge variant="outline" className={cn("border text-[9px] px-1.5 py-0 font-semibold uppercase tracking-wide shrink-0", FINDING_STYLE[f.severity])}>
                    {SEVERITY_LABEL[f.severity]}
                  </Badge>
                )}
              </div>
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
}
