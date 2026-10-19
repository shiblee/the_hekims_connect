"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
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

function Empty({ children }: { children?: ReactNode }) {
  const t = useTranslations("clinic.stage5");
  return <p className="text-sm text-muted-foreground">{children ?? t("not_recorded")}</p>;
}

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
  cleared: { label: "cleared", className: "text-emerald-600 dark:text-emerald-400 border-emerald-500/40" },
  referred: { label: "referred", className: "text-destructive border-destructive/40" },
  continued_ama: { label: "continued_ama", className: "text-amber-600 dark:text-amber-400 border-amber-500/40" },
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
  const t = useTranslations("clinic.stage5");
  const ta = useTranslations("clinic.asbab");
  const t3 = useTranslations("clinic.stage3");
  const dl = useDateLocale();
  // "3 days" in the viewer's language; anything unexpected is shown as stored.
  const dur = (n: number, u: string | null) => (u && DURATION_UNITS.some((x) => x.value === u) ? t3(`n_${u}`, { count: n }) : `${n} ${u ?? ""}`);
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(dl, { day: "numeric", month: "short", year: "numeric" }) : null);

  useEffect(() => {
    let cancelled = false;
    api.get<{ summary: Summary }>(`/api/facility/visits/${visitId}/clinical-summary`)
      .then((r) => { if (!cancelled) setSummary(r.summary); })
      .catch((e) => { if (!cancelled) setError(e.message || t("load_failed")); });
    return () => { cancelled = true; };
  }, [visitId]);

  if (error) return <Card className="p-4 border-border/50 bg-card/60 text-sm text-destructive">{error}</Card>;
  if (!summary) {
    return <Card className="p-4 border-border/50 bg-card/60"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}</div></Card>;
  }

  const s = summary;
  const dominant = s.humoral ? (s.humoral.dominantOverride || s.humoral.dominant) : null;

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h2 className="font-serif text-lg font-semibold">{t("so_far")}</h2>
        <p className="text-xs text-muted-foreground">{t("so_far_hint")}</p>
      </div>

      {showAsbab && (
        <Group title={t("g_asbab")}>
          {!s.asbab || s.asbab.pillars.length === 0 ? (
            <Block icon={Wind} title={t("six_factors")}><Empty /></Block>
          ) : (
            <>
              <Block icon={Activity} title={t("lifestyle_drift")}
                aside={<Badge variant="outline" className={cn("text-[10px]", s.asbab.status === "completed" ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/40" : "text-amber-600 dark:text-amber-400 border-amber-500/40")}>{s.asbab.status === "completed" ? ta("completed") : ta("draft")}</Badge>}>
                {s.asbab.drift?.percent ? (
                  <div className="space-y-2">
                    {s.asbab.drift.dominant && (() => {
                      const h = AKHLAT.find((x) => x.key === s.asbab!.drift!.dominant);
                      return h ? <p className="text-sm">{ta.rich("leaning", { label: h.label, b: (c) => <span className={cn("font-semibold", h.text)}>{c}</span> })} <span className="text-muted-foreground">({ta(`h_${h.key}_q`)})</span></p> : null;
                    })()}
                    {AKHLAT.map((h) => (
                      <div key={h.key} className="grid grid-cols-[64px_1fr_36px] items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{h.label}</span>
                        <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full", h.bar)} style={{ width: `${s.asbab!.drift!.percent![h.key] ?? 0}%` }} /></span>
                        <span className="text-end tabular-nums">{s.asbab!.drift!.percent![h.key] ?? 0}%</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty>{t("not_computed")}</Empty>}
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

      <Group title={t("g_doctor")}>
      {/* Chief complaints — the heart of the summary */}
      <Block icon={BriefcaseMedical} title={t("chief")} aside={s.complaints.length > 0 && <Badge variant="outline" className="text-[10px]">{s.complaints.length}</Badge>}>
        {s.complaints.length === 0 ? <Empty /> : (
          <div className="space-y-3">
            {s.complaints.map((c, i) => (
              <div key={c.label} className={cn("rounded-lg border px-3 py-2.5 space-y-2", i === 0 ? "border-primary/30 bg-primary/5" : "border-border/50 bg-background/40")}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{c.label}</p>
                  {i === 0 && <Badge variant="outline" className="text-[10px] shrink-0 border-primary/40 text-primary">{t("primary")}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{t("duration")} <span className="text-foreground font-medium">{c.durationValue != null ? dur(c.durationValue, c.durationUnit) : "—"}</span></span>
                  <span>{t("severity")} <span className={cn("font-medium", (c.severity ?? 0) >= 7 ? "text-destructive" : (c.severity ?? 0) >= 4 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                    {c.severity != null ? `${c.severity}/10${c.severityLabel ? ` · ${c.severityLabel}` : ""}` : "—"}
                  </span></span>
                </div>
                {c.aggravating.length > 0 && <div className="space-y-1"><p className="text-[11px] text-muted-foreground">{t("aggravated")}</p><Chips items={c.aggravating} tone="red" /></div>}
                {c.relieving.length > 0 && <div className="space-y-1"><p className="text-[11px] text-muted-foreground">{t("relieved")}</p><Chips items={c.relieving} tone="green" /></div>}
                {c.notes && <p className="text-xs text-muted-foreground italic">{c.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Block>

      <Block icon={PersonStanding} title={t("regions")}>
        {s.regions.length === 0 ? <Empty /> : (
          <div className="flex flex-wrap gap-1.5">
            {s.regions.map((r, i) => (
              <span key={r} className={cn("rounded-full border px-2.5 py-0.5 text-xs", i === 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 font-medium" : "bg-background/40 border-border/60")}>
                {r}{i === 0 && ` · ${t("primary")}`}
              </span>
            ))}
          </div>
        )}
      </Block>

      <Block icon={Hourglass} title={t3("chrono_title")}>
        {!s.chronology || (!s.chronology.patterns.length && s.chronology.durationValue == null && !s.chronology.note) ? <Empty /> : (
          <div className="space-y-2">
            {s.chronology.patterns.length > 0 && <Chips items={s.chronology.patterns} tone="primary" />}
            {s.chronology.durationValue != null && (
              <p className="text-sm">
                <span className="font-semibold">{dur(s.chronology.durationValue, s.chronology.durationUnit)}</span>
                {s.chronology.onsetDate && <span className="text-muted-foreground"> · {t("since", { date: fmtDate(s.chronology.onsetDate) ?? "" })}</span>}
              </p>
            )}
            {s.chronology.source === "auto" && s.chronology.sourceComplaint && (
              <p className="text-[11px] text-muted-foreground">{t("longest", { label: s.chronology.sourceComplaint })}</p>
            )}
            {s.chronology.note && <p className="text-xs text-muted-foreground italic">{s.chronology.note}</p>}
          </div>
        )}
      </Block>

      </Group>

      <Group title={t("g_triage")}>
      <Block icon={ShieldAlert} title={t("red_flags")}
        aside={s.redFlags && RED_FLAG_OUTCOME[s.redFlags.outcome] && <Badge variant="outline" className={cn("text-[10px]", RED_FLAG_OUTCOME[s.redFlags.outcome].className)}>{t(RED_FLAG_OUTCOME[s.redFlags.outcome].label)}</Badge>}>
        {!s.redFlags ? <Empty>{t("not_screened")}</Empty> : s.redFlags.present.length === 0
          ? <p className="text-sm text-muted-foreground">{t("none_of", { count: s.redFlags.checked })}</p>
          : <Chips items={s.redFlags.present} tone="red" />}
      </Block>

      <Block icon={Activity} title={t("other_symptoms")}>
        {s.acuteSymptoms.length === 0 ? <Empty>{t("none_selected")}</Empty> : <Chips items={s.acuteSymptoms} />}
      </Block>

      <Block icon={NotebookPen} title={t("notes")}>
        {!s.triage?.painNotes && !s.triage?.primaryFocusArea && !s.triage?.triageRemarks && s.residentNotes.length === 0 ? <Empty /> : (
          <div className="space-y-2 text-sm">
            {s.triage?.primaryFocusArea && <p><span className="text-xs text-muted-foreground">{t("focus")} </span>{s.triage.primaryFocusArea}</p>}
            {s.triage?.painNotes && <p><span className="text-xs text-muted-foreground">{t("pain")} </span>{s.triage.painNotes}</p>}
            {s.triage?.triageRemarks && <p><span className="text-xs text-muted-foreground">{t("remarks")} </span>{s.triage.triageRemarks}</p>}
            {s.residentNotes.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">{t("resident")}</p>
                <ul className="list-disc ps-5 space-y-0.5">{s.residentNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Block>

      </Group>


      <Group title={t("g_computed")}>
      <Block icon={Droplets} title={t("humoral")} aside={dominant && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">{t("dominant", { name: dominant })}</Badge>}>
        {!s.humoral ? <Empty>{t("not_computed_yet")}</Empty> : (
          <div className="space-y-2">
            {HUMOURS.map((h) => {
              const pct = Math.round(s.humoral![h.key]);
              return (
                <div key={h.key} className="grid grid-cols-[64px_1fr_36px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{h.label}</span>
                  <span className="h-1.5 rounded-full bg-muted overflow-hidden"><span className={cn("block h-full rounded-full", h.color)} style={{ width: `${pct}%` }} /></span>
                  <span className="text-end tabular-nums">{pct}%</span>
                </div>
              );
            })}
            {s.humoral.aiClue && <p className="text-xs text-muted-foreground pt-1">{s.humoral.aiClue}</p>}
          </div>
        )}
      </Block>

      <Block icon={Milestone} title={t("routing")}>
        {!s.routing ? <Empty>{t("not_generated")}</Empty> : (
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
