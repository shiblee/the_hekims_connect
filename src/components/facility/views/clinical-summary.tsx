"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DURATION_UNITS } from "@/lib/chronology";
import { AKHLAT, pillarIcon } from "@/lib/asbab";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, BriefcaseMedical, Hourglass, Loader2, Milestone, NotebookPen,
  PersonStanding, ShieldAlert, Droplets, Wind,
} from "lucide-react";

interface Summary {
  triage: { painNotes: string | null; primaryFocusArea: string | null; triageRemarks: string | null } | null;
  complaints: {
    label: string; durationValue: number | null; durationUnit: string | null; severity: number | null; severityLabel: string | null;
    aggravating: string[]; relieving: string[]; notes: string | null;
  }[];
  regions: string[];
  chronology: {
    patterns: string[]; durationValue: number | null; durationUnit: string | null; onsetDate: string | null;
    source: string; sourceComplaint: string | null; note: string | null;
  } | null;
  redFlags: { outcome: string; checked: number; present: string[] } | null;
  acuteSymptoms: string[];
  humoral: { safraPercent: number; damPercent: number; saudaPercent: number; balghamPercent: number; dominant: string; dominantOverride: string | null; aiClue: string | null } | null;
  routing: { priorityLevel: string; triageStream: string; justification: string } | null;
  residentNotes: string[];
  asbab: {
    status: string; completedAt: string | null;
    drift: { percent?: Record<string, number>; dominant?: string | null } | null;
    pillars: { key: string; label: string; english: string; answers: { question: string; answer: string }[] }[];
  } | null;
}

const unitName = (u: string | null, n: number | null) => {
  const label = (DURATION_UNITS.find((x) => x.value === u)?.label.split(" (")[0] ?? u ?? "").toLowerCase();
  return n === 1 ? label.replace(/s$/, "") : label;
};
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null);

/** Compact card in the right-rail style (Clinical Routing / Humoral Clues). */
function Block({ icon: Icon, title, aside, children }: { icon: typeof Activity; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <Card className="p-4 border-border/50 bg-card/60 gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" /> {title}
        </p>
        {aside}
      </div>
      {children}
    </Card>
  );
}

/** Divider naming who recorded the cards below it. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary whitespace-nowrap">{title}</p>
        <span className="h-px flex-1 bg-border/60" />
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children = "Not recorded" }: { children?: ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

function Chips({ items, tone = "neutral" }: { items: string[]; tone?: "neutral" | "red" | "green" | "primary" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={`${t}-${i}`} className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs",
          tone === "red" ? "bg-destructive/10 text-destructive border-destructive/30"
            : tone === "green" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : tone === "primary" ? "bg-primary/10 text-primary border-primary/30"
            : "bg-background/40 border-border/60",
        )}>{t}</span>
      ))}
    </div>
  );
}

const HUMOURS = [
  { key: "damPercent", label: "Dam", color: "bg-red-500" },
  { key: "safraPercent", label: "Safra", color: "bg-amber-400" },
  { key: "balghamPercent", label: "Balgham", color: "bg-sky-400" },
  { key: "saudaPercent", label: "Sauda", color: "bg-violet-500" },
] as const;

const RED_FLAG_OUTCOME: Record<string, { label: string; className: string }> = {
  cleared: { label: "Cleared", className: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40" },
  referred: { label: "Referred", className: "text-destructive border-destructive/40" },
  continued_ama: { label: "Continued (declined referral)", className: "text-amber-600 dark:text-amber-400 border-amber-500/40" },
};

/**
 * Stage 4's right column: everything the clinical team recorded for this
 * visit so far — triage, Stage 2 and the senior doctor's Stage 3 — in one
 * read-only, scannable column. Gaps show as "Not recorded" so nothing missing
 * goes unnoticed.
 */
export function ClinicalSummaryColumn({ visitId, showAsbab = false }: {
  visitId: string;
  /** Include the Stage 4 Asbab-e-Sittah results (later stages; on Stage 4 itself they're live in the centre). */
  showAsbab?: boolean;
}) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get<{ summary: Summary }>(`/api/facility/visits/${visitId}/clinical-summary`)
      .then((r) => { if (!cancelled) setSummary(r.summary); })
      .catch((e) => { if (!cancelled) setError(e.message || "Could not load the clinical summary"); });
    return () => { cancelled = true; };
  }, [visitId]);

  if (error) return <Card className="p-4 border-border/50 bg-card/60 text-sm text-destructive">{error}</Card>;
  if (!summary) {
    return <Card className="p-4 border-border/50 bg-card/60"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading clinical summary…</div></Card>;
  }

  const s = summary;
  const dominant = s.humoral ? (s.humoral.dominantOverride || s.humoral.dominant) : null;

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="font-serif text-lg font-semibold">Assessment So Far</h2>
        <p className="text-xs text-muted-foreground">Everything recorded for this visit, grouped by who assessed it.</p>
      </div>

      {showAsbab && (
        <Group title="Asbab-e-Sittah · Stage 4">
          {!s.asbab || s.asbab.pillars.length === 0 ? (
            <Block icon={Wind} title="Six Essential Factors"><Empty /></Block>
          ) : (
            <>
              <Block icon={Activity} title="Lifestyle Humoral Drift"
                aside={<Badge variant="outline" className={cn("text-[10px]", s.asbab.status === "completed" ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/40" : "text-amber-600 dark:text-amber-400 border-amber-500/40")}>{s.asbab.status === "completed" ? "Completed" : "Draft"}</Badge>}>
                {s.asbab.drift?.percent ? (
                  <div className="space-y-2">
                    {s.asbab.drift.dominant && (() => {
                      const h = AKHLAT.find((x) => x.key === s.asbab!.drift!.dominant);
                      return h ? <p className="text-sm">Leaning towards <span className={cn("font-semibold", h.text)}>{h.label}</span> <span className="text-muted-foreground">({h.quality})</span></p> : null;
                    })()}
                    {AKHLAT.map((h) => (
                      <div key={h.key} className="grid grid-cols-[64px_1fr_36px] items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{h.label}</span>
                        <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full", h.bar)} style={{ width: `${s.asbab!.drift!.percent![h.key] ?? 0}%` }} /></span>
                        <span className="text-right tabular-nums">{s.asbab!.drift!.percent![h.key] ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty>Not computed</Empty>}
              </Block>
              {s.asbab.pillars.map((p) => (
                <Block key={p.key} icon={pillarIcon(p.key)} title={p.label}>
                  <p className="text-[11px] text-muted-foreground -mt-1">{p.english}</p>
                  <dl className="space-y-1.5">
                    {p.answers.map((a, i) => (
                      <div key={i} className="text-xs">
                        <dt className="text-muted-foreground">{a.question}</dt>
                        <dd className="font-medium">{a.answer}</dd>
                      </div>
                    ))}
                  </dl>
                </Block>
              ))}
            </>
          )}
        </Group>
      )}

      <Group title="Doctor's Assessment · Stage 3">
      {/* Chief complaints — the heart of the summary */}
      <Block icon={BriefcaseMedical} title="Chief Complaints" aside={s.complaints.length > 0 && <Badge variant="outline" className="text-[10px]">{s.complaints.length}</Badge>}>
        {s.complaints.length === 0 ? <Empty /> : (
          <div className="space-y-3">
            {s.complaints.map((c, i) => (
              <div key={c.label} className={cn("rounded-lg border px-3 py-2.5 space-y-2", i === 0 ? "border-primary/30 bg-primary/5" : "border-border/50 bg-background/40")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{c.label}</p>
                  {i === 0 && <Badge variant="outline" className="text-[10px] shrink-0 border-primary/40 text-primary">Primary</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Duration: <span className="text-foreground font-medium">{c.durationValue != null ? `${c.durationValue} ${unitName(c.durationUnit, c.durationValue)}` : "—"}</span></span>
                  <span>Severity: <span className={cn("font-medium", (c.severity ?? 0) >= 7 ? "text-destructive" : (c.severity ?? 0) >= 4 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                    {c.severity != null ? `${c.severity}/10${c.severityLabel ? ` · ${c.severityLabel}` : ""}` : "—"}
                  </span></span>
                </div>
                {c.aggravating.length > 0 && <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Aggravated by (Muharrikat)</p><Chips items={c.aggravating} tone="red" /></div>}
                {c.relieving.length > 0 && <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Relieved by (Musakkinat)</p><Chips items={c.relieving} tone="green" /></div>}
                {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block icon={PersonStanding} title="Anatomical Regions">
        {s.regions.length === 0 ? <Empty /> : (
          <div className="flex flex-wrap gap-1.5">
            {s.regions.map((r, i) => (
              <span key={r} className={cn("rounded-full border px-2.5 py-0.5 text-xs", i === 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-medium" : "bg-background/40 border-border/60")}>
                {r}{i === 0 && " · Primary"}
              </span>
            ))}
          </div>
        )}
      </Block>

      <Block icon={Hourglass} title="Onset & Chronology">
        {!s.chronology || (!s.chronology.patterns.length && s.chronology.durationValue == null && !s.chronology.note) ? <Empty /> : (
          <div className="space-y-2">
            {s.chronology.patterns.length > 0 && <Chips items={s.chronology.patterns} tone="primary" />}
            {s.chronology.durationValue != null && (
              <p className="text-sm">
                <span className="font-semibold">{s.chronology.durationValue} {unitName(s.chronology.durationUnit, s.chronology.durationValue)}</span>
                {s.chronology.onsetDate && <span className="text-muted-foreground"> · since {fmtDate(s.chronology.onsetDate)}</span>}
              </p>
            )}
            {s.chronology.source === "auto" && s.chronology.sourceComplaint && (
              <p className="text-[11px] text-muted-foreground">Longest chief-complaint duration — {s.chronology.sourceComplaint}</p>
            )}
            {s.chronology.note && <p className="text-xs text-muted-foreground italic">{s.chronology.note}</p>}
          </div>
        )}
      </Block>

      </Group>

      <Group title="Triage & Junior Doctor · Stage 2">
      <Block icon={ShieldAlert} title="Red Flag Screening"
        aside={s.redFlags && RED_FLAG_OUTCOME[s.redFlags.outcome] && <Badge variant="outline" className={cn("text-[10px]", RED_FLAG_OUTCOME[s.redFlags.outcome].className)}>{RED_FLAG_OUTCOME[s.redFlags.outcome].label}</Badge>}>
        {!s.redFlags ? <Empty>Not screened</Empty> : s.redFlags.present.length === 0
          ? <p className="text-sm text-muted-foreground">None of the {s.redFlags.checked} emergency criteria present.</p>
          : <Chips items={s.redFlags.present} tone="red" />}
      </Block>

      <Block icon={Activity} title="Other Symptoms">
        {s.acuteSymptoms.length === 0 ? <Empty>None selected</Empty> : <Chips items={s.acuteSymptoms} />}
      </Block>

      <Block icon={NotebookPen} title="Triage & Resident Notes">
        {!s.triage?.painNotes && !s.triage?.primaryFocusArea && !s.triage?.triageRemarks && s.residentNotes.length === 0 ? <Empty /> : (
          <div className="space-y-2 text-sm">
            {s.triage?.primaryFocusArea && <p><span className="text-xs text-muted-foreground">Primary focus area: </span>{s.triage.primaryFocusArea}</p>}
            {s.triage?.painNotes && <p><span className="text-xs text-muted-foreground">Pain notes: </span>{s.triage.painNotes}</p>}
            {s.triage?.triageRemarks && <p><span className="text-xs text-muted-foreground">Triage remarks: </span>{s.triage.triageRemarks}</p>}
            {s.residentNotes.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Resident clinical note</p>
                <ul className="list-disc pl-5 space-y-0.5">{s.residentNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Block>

      </Group>


      <Group title="Computed Insights">
      <Block icon={Droplets} title="Humoral Assessment" aside={dominant && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Dominant: {dominant}</Badge>}>
        {!s.humoral ? <Empty>Not computed yet</Empty> : (
          <div className="space-y-2">
            {HUMOURS.map((h) => {
              const pct = Math.round(s.humoral![h.key]);
              return (
                <div key={h.key} className="grid grid-cols-[64px_1fr_36px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{h.label}</span>
                  <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full", h.color)} style={{ width: `${pct}%` }} /></span>
                  <span className="text-right tabular-nums">{pct}%</span>
                </div>
              );
            })}
            {s.humoral.aiClue && <p className="text-xs text-muted-foreground pt-1">{s.humoral.aiClue}</p>}
          </div>
        )}
      </Block>

      <Block icon={Milestone} title="Clinical Routing">
        {!s.routing ? <Empty>Not generated</Empty> : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5"><Chips items={[s.routing.priorityLevel, s.routing.triageStream]} tone="primary" /></div>
            <p className="text-xs text-muted-foreground">{s.routing.justification}</p>
          </div>
        )}
      </Block>

      </Group>

    </div>
  );
}
