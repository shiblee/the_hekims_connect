"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Hourglass, Loader2, Pencil, PersonStanding } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { COURSES, courseFor, DURATION_UNITS } from "@/lib/chronology";
import { regionIcon } from "@/lib/anatomical-region-icons";
import { patternIcon } from "@/lib/onset-icons";
import { BodyFigure } from "@/components/facility/views/body-map";
import { Card } from "@/components/ui/card";

interface RegionTag { label: string; localTerms: string | null; icon: string; bodyZone: string | null }
interface Chronology {
  onsetPatterns: string; durationValue: number | null; durationUnit: string | null; onsetDate: string | null;
  durationSource: string; sourceComplaint: string | null;
}
interface Findings {
  regions: { label: string; localTerms: string | null; icon: string; zone: string | null; primary: boolean }[];
  chronology: { patterns: string[]; value: number | null; unit: string; date: string | null; source: string; sourceComplaint: string | null } | null;
}

const unitWord = (v: number, u: string) => {
  const w = DURATION_UNITS.find((x) => x.value === u)?.label.split(" (")[0].toLowerCase() ?? u;
  return v === 1 ? w.replace(/s$/, "") : w;
};
const longDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Card frame shared by the two Stage 3 cards: heading, a "Stage 3" tag and an edit link back to Stage 3. */
function StageCard({ icon: Icon, title, editHref, children }: { icon: typeof Hourglass; title: string; editHref: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 border-border/50 bg-card/60 gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
          <h3 className="font-serif text-base font-semibold leading-tight">{title}</h3>
        </div>
        <Link href={editHref} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" title="Edit in Mizaj & Morphometry (Stage 3)">
          <Pencil className="h-3 w-3" /> Stage 3
        </Link>
      </div>
      {children}
    </Card>
  );
}

/**
 * Right column of Stage 4 onwards: what the senior doctor recorded at Stage 3
 * — the body regions on a body figure, and onset & chronology with the
 * course of illness. Read-only; the edit link goes back to Stage 3.
 */
export function Stage3FindingsCards({ visitId, patientId }: { visitId: string; patientId: string }) {
  const [data, setData] = useState<Findings | null>(null);
  const [failed, setFailed] = useState(false);
  const editHref = `/facility/mizaj?patientId=${patientId}`;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ regions: RegionTag[] }>("/api/facility/anatomical-regions"),
      api.get<{ selection: { regions: string } | null }>(`/api/facility/visits/${visitId}/anatomical-regions`),
      api.get<{ chronology: Chronology | null }>(`/api/facility/visits/${visitId}/chronology`),
    ])
      .then(([tags, sel, chron]) => {
        if (cancelled) return;
        let picked: string[] = [];
        try { picked = JSON.parse(sel.selection?.regions || "[]"); } catch { picked = []; }
        const c = chron.chronology;
        let patterns: string[] = [];
        try { patterns = JSON.parse(c?.onsetPatterns || "[]"); } catch { patterns = []; }
        setData({
          regions: picked.map((label, i) => {
            const t = tags.regions.find((r) => r.label === label);
            return { label, localTerms: t?.localTerms ?? null, icon: t?.icon ?? "activity", zone: t?.bodyZone ?? null, primary: i === 0 };
          }),
          chronology: c ? { patterns, value: c.durationValue, unit: c.durationUnit || "days", date: c.onsetDate, source: c.durationSource, sourceComplaint: c.sourceComplaint } : null,
        });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [visitId]);

  if (failed) return null; // the rest of the column still works; Stage 3 itself shows its own errors
  if (!data) {
    return <Card className="p-5 border-border/50 bg-card/60"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Stage 3 findings…</div></Card>;
  }

  const ch = data.chronology;
  const course = ch?.value != null ? courseFor(String(ch.value), ch.unit) : null;

  return (
    <>
      <StageCard icon={PersonStanding} title="Anatomical Region & Organ System" editHref={editHref}>
        {data.regions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No body regions selected at Stage 3.</p>
        ) : (
          <>
            <div className="flex justify-center gap-4 rounded-xl border border-border/40 bg-background/40 py-3">
              <BodyFigure screen view="front" items={data.regions} width={92} />
              <BodyFigure screen view="back" items={data.regions} width={92} />
            </div>
            <ul className="space-y-1.5">
              {data.regions.map((r) => {
                const Icon = regionIcon(r.icon);
                return (
                  <li key={r.label} className={cn("flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5", r.primary ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/50 bg-background/40")}>
                    <span className={cn("h-7 w-7 shrink-0 rounded-md flex items-center justify-center", r.primary ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground")}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold" title={r.label}>{r.label}</span>
                      {r.localTerms && <span className="block truncate text-xs text-muted-foreground" title={r.localTerms}>{r.localTerms}</span>}
                    </span>
                    {r.primary && <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Primary</span>}
                  </li>
                );
              })}
            </ul>
            {data.regions.every((r) => !r.zone) && (
              <p className="text-xs text-muted-foreground">These regions aren&apos;t placed on the body map.</p>
            )}
          </>
        )}
      </StageCard>

      <StageCard icon={Hourglass} title="Onset & Chronology" editHref={editHref}>
        {!ch || (ch.value == null && ch.patterns.length === 0) ? (
          <p className="text-sm text-muted-foreground">Onset &amp; chronology not recorded at Stage 3.</p>
        ) : (
          <>
            {ch.value != null && (
              <div className={cn("rounded-xl border px-3.5 py-3", course ? cn(course.style.border, course.style.bg) : "border-border/50 bg-background/40")}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <p className="text-xl font-bold leading-none tabular-nums">{ch.value} <span className="text-sm font-medium">{unitWord(ch.value, ch.unit)}</span></p>
                  {course && <span className={cn("text-sm font-semibold", course.style.text)}>{course.label} <span className="font-normal opacity-80">({course.unani})</span></span>}
                </div>
                {course && (
                  <>
                    <div className="mt-2.5 relative">
                      <div className="flex h-1.5 overflow-hidden rounded-full">
                        {COURSES.map((c) => <div key={c.key} className={cn("flex-1", c.style.bar, c.key === course.key ? "opacity-100" : "opacity-30")} />)}
                      </div>
                      <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow" style={{ left: `${course.pos}%`, background: course.style.dot }} aria-hidden />
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 text-[11px] text-muted-foreground">
                      {COURSES.map((c, i) => <span key={c.key} className={cn(i === 1 && "text-center", i === 2 && "text-end", c.key === course.key && "font-semibold text-foreground")}>{c.range}</span>)}
                    </div>
                  </>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {ch.date && <>Started around <span className="font-medium text-foreground">{longDate(ch.date)}</span></>}
                  {ch.source === "auto" && ch.sourceComplaint && <>{ch.date ? " · " : ""}from the longest complaint, {ch.sourceComplaint}</>}
                </p>
              </div>
            )}
            {ch.patterns.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">How it started &amp; when it&apos;s worse</p>
                <div className="flex flex-wrap gap-1.5">
                  {ch.patterns.map((pt) => {
                    const Icon = patternIcon(pt);
                    return (
                      <span key={pt} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[13px] text-foreground">
                        <Icon className="h-3.5 w-3.5 text-primary" /> {pt}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </StageCard>
    </>
  );
}
