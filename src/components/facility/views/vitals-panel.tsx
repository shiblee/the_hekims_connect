"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { VITAL_RANGES, TEMP_RANGE_F, isOutOfRange } from "@/lib/vitals-ranges";
import { calculateEWS, type EwsBand } from "@/lib/ews";
import { type VisitWithVitals } from "@/lib/vitals-trend";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HeartPulse, Gauge, Droplets, Thermometer, Wind, Plus, Lightbulb,
  Sparkles, Loader2, ShieldAlert, Activity, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceArea, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

const EWS_BAND_STYLE: Record<EwsBand, string> = {
  low: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "low-medium": "bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30",
  medium: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

interface TrendPoint {
  date: string; fullDate: string; relativeDate: string; time: string;
  pulse: number | null; bpSystolic: number | null; bpDiastolic: number | null;
  spo2: number | null; temperatureF: number | null; respiratoryRate: number | null; weight: number | null;
}

interface MetricConfig {
  key: keyof TrendPoint;
  secondaryKey?: keyof TrendPoint;
  label: string;
  icon: typeof HeartPulse;
  unit: string;
  color: string;
  secondaryColor?: string;
  range?: [number, number];
}

function ColorDot(range: [number, number] | undefined, color: string) {
  return (props: any) => {
    const { cx, cy, value, key } = props;
    if (value == null) return <circle key={key} cx={cx} cy={cy} r={0} fill="none" />;
    const out = range ? value < range[0] || value > range[1] : false;
    return <circle key={key} cx={cx} cy={cy} r={3} fill={out ? "#ef4444" : color} stroke="white" strokeWidth={1} />;
  };
}

export function VitalsPanel({
  visits, patientId, apiClient = api, insightPath, showNewVisitButton = true,
}: {
  visits: VisitWithVitals[];
  patientId: string;
  /** Defaults to the facility `api` client; admin passes `adminApi` (same shape, different auth header). */
  apiClient?: { post: <T = any>(url: string, body?: any) => Promise<T> };
  /** Defaults to the facility-scoped vitals-insight route; admin passes its own cross-facility route. */
  insightPath?: string;
  /** Facility accounts can start a new visit/assessment from here; admin stays view-only. */
  showNewVisitButton?: boolean;
}) {
  const router = useRouter();
  const [insight, setInsight] = useState<string | null>(null);
  const [insightState, setInsightState] = useState<"idle" | "loading" | "not_configured" | "no_data">("idle");
  const [detailKey, setDetailKey] = useState<keyof TrendPoint | null>(null);
  const [startingVisit, setStartingVisit] = useState(false);

  const startNewVisit = async () => {
    setStartingVisit(true);
    try {
      const res = await apiClient.post<{ visit: { id: string } }>("/api/facility/visits", { patientId });
      router.push(`/facility/visits/${res.visit.id}/vitals`);
    } catch (e: any) {
      toast.error(e.message || "Could not start a new visit");
      setStartingVisit(false);
    }
  };

  const visitsWithVitals = useMemo(() => visits.filter((v) => v.vitalSigns), [visits]);
  const latest = visitsWithVitals[0]?.vitalSigns ?? null;

  const ews = latest
    ? calculateEWS({
        respiratoryRate: latest.respiratoryRate,
        spo2: latest.spo2,
        onOxygen: latest.oxygenLitres != null && latest.oxygenLitres > 0,
        bpSystolic: latest.bpSystolic,
        pulse: latest.pulse,
        consciousnessLevel: latest.consciousnessLevel,
        temperatureC: latest.temperatureC ?? (latest.temperatureF != null ? ((latest.temperatureF - 32) * 5) / 9 : null),
      })
    : null;

  const trend: TrendPoint[] = useMemo(() => {
    return [...visitsWithVitals]
      .reverse()
      .map((v) => ({
        date: `${new Date(v.visitDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${new Date(v.visitDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}`,
        fullDate: new Date(v.visitDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        relativeDate: daysAgo(v.visitDate),
        time: new Date(v.visitDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true }),
        pulse: v.vitalSigns?.pulse ?? null,
        bpSystolic: v.vitalSigns?.bpSystolic ?? null,
        bpDiastolic: v.vitalSigns?.bpDiastolic ?? null,
        spo2: v.vitalSigns?.spo2 ?? null,
        temperatureF: v.vitalSigns?.temperatureF ?? null,
        respiratoryRate: v.vitalSigns?.respiratoryRate ?? null,
        weight: v.vitalSigns?.weightKg ?? null,
      }));
  }, [visitsWithVitals]);

  const getInsight = async () => {
    setInsightState("loading");
    try {
      const path = insightPath || `/api/facility/patients/${patientId}/vitals-insight`;
      const res = await apiClient.post<{ insight: string | null; reason?: string }>(path, {});
      if (res.insight) {
        setInsight(res.insight);
        setInsightState("idle");
      } else {
        setInsightState(res.reason === "not_configured" ? "not_configured" : "no_data");
      }
    } catch (e: any) {
      toast.error(e.message || "Could not generate an insight");
      setInsightState("idle");
    }
  };

  if (!latest) {
    return (
      <Card className="p-5 border-border/50 bg-card/60 text-center">
        <Activity className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground mb-3">No vitals recorded yet{showNewVisitButton ? "." : " at any facility."}</p>
        {showNewVisitButton && (
          <Button size="sm" onClick={startNewVisit} disabled={startingVisit}>
            {startingVisit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} New Visit — Assess Today
          </Button>
        )}
      </Card>
    );
  }

  const METRICS: MetricConfig[] = [
    { key: "pulse", label: "Pulse (Nabz)", icon: HeartPulse, unit: "bpm", color: "#ef4444", range: VITAL_RANGES.pulse },
    { key: "bpSystolic", secondaryKey: "bpDiastolic", label: "Blood Pressure (Dabao-e-Khoon)", icon: Gauge, unit: "mmHg", color: "#f97316", secondaryColor: "#fb923c", range: VITAL_RANGES.bpSystolic },
    { key: "spo2", label: "SpO₂ (Oxygen)", icon: Droplets, unit: "%", color: "#3b82f6", range: VITAL_RANGES.spo2 },
    { key: "temperatureF", label: "Temperature (Hararat)", icon: Thermometer, unit: "°F", color: "#f59e0b", range: TEMP_RANGE_F },
    { key: "respiratoryRate", label: "Respiratory Rate (Tanaffus)", icon: Wind, unit: "/min", color: "#8b5cf6", range: VITAL_RANGES.respiratoryRate },
  ];

  const statCards = METRICS.map((m) => {
    let value: string = "—";
    let sub = m.unit;
    let out = false;
    if (m.key === "bpSystolic") {
      value = latest.bpSystolic != null || latest.bpDiastolic != null ? `${latest.bpSystolic ?? "—"}/${latest.bpDiastolic ?? "—"}` : "—";
      out = isOutOfRange("bpSystolic", latest.bpSystolic) || isOutOfRange("bpDiastolic", latest.bpDiastolic);
    } else if (m.key === "spo2") {
      value = latest.spo2 != null ? `${latest.spo2}%` : "—";
      sub = latest.oxygenLitres ? `${latest.oxygenLitres} L/min O₂` : "Room air";
      out = isOutOfRange("spo2", latest.spo2);
    } else if (m.key === "temperatureF") {
      value = latest.temperatureF != null ? `${latest.temperatureF}°F` : "—";
      sub = latest.temperatureC != null ? `${latest.temperatureC}°C` : "";
      out = latest.temperatureF != null && (latest.temperatureF < TEMP_RANGE_F[0] || latest.temperatureF > TEMP_RANGE_F[1]);
    } else {
      const raw = latest[m.key as "pulse" | "respiratoryRate"];
      value = raw != null ? String(raw) : "—";
      out = isOutOfRange(m.key, raw);
    }
    const points = trend.filter((t) => t[m.key] != null).length;
    return { ...m, value, sub, out, points };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
          <Activity className="h-4 w-4 text-primary" /> Vitals recorded
          <span className="font-normal text-muted-foreground">
            {new Date(visitsWithVitals[0].visitDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            {" at "}
            {new Date(visitsWithVitals[0].visitDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}
          </span>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[11px] font-medium">
            {daysAgo(visitsWithVitals[0].visitDate)}
          </Badge>
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {ews && (
            <Badge variant="outline" className={cn("border flex items-center gap-1", EWS_BAND_STYLE[ews.band])}>
              <ShieldAlert className="h-3 w-3" /> Clinical Alert Score {ews.total} · {ews.label}
            </Badge>
          )}
          {showNewVisitButton && (
            <Button size="sm" className="h-7 text-xs" onClick={startNewVisit} disabled={startingVisit}>
              {startingVisit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} New Visit — Assess Today
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {statCards.map((c) => (
          <Card
            key={c.label}
            onClick={() => setDetailKey(c.key)}
            className={cn(
              "p-3 border-border/50 bg-card/60 cursor-pointer hover:border-primary/40 transition-colors flex flex-row items-center justify-between gap-1.5",
              c.out && "border-destructive/40 bg-destructive/5"
            )}
          >
            <div className="min-w-0">
              <p className={cn("text-sm font-semibold flex items-center gap-1.5", c.out ? "text-destructive" : "text-foreground")}><c.icon className="h-4 w-4" />{c.label}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className={cn("text-2xl font-bold leading-none", c.out && "text-destructive")}>{c.value}</span>
                <span className={cn("text-sm", c.out ? "text-destructive font-medium" : "text-muted-foreground")}>{c.sub}</span>
              </p>
            </div>
            <div className="flex flex-col items-end justify-center gap-1.5 shrink-0 self-stretch">
              <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">{daysAgo(visitsWithVitals[0].visitDate)}</span>
              {c.points >= 2 && (
                <div className="w-16 h-16 mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <Line type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={1.5} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {ews && (
        <p className="text-sm text-muted-foreground italic">{ews.advice} Based on {ews.parametersScored} recorded parameter{ews.parametersScored === 1 ? "" : "s"} — a modern clinical safety reference (NEWS2) alongside your Unani assessment, not a diagnosis.</p>
      )}

      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Insight
          </p>
          <Button size="sm" variant="outline" onClick={getInsight} disabled={insightState === "loading"}>
            {insightState === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Get AI Insight
          </Button>
        </div>
        {insight && <p className="text-sm mt-2 leading-relaxed">{insight}</p>}
        {insightState === "not_configured" && <p className="text-xs text-muted-foreground mt-2">AI insights aren&apos;t configured for this portal yet.</p>}
        {insightState === "no_data" && <p className="text-xs text-muted-foreground mt-2">Not enough recorded vitals to generate an insight.</p>}
        {insight && <p className="text-[10px] text-muted-foreground mt-2 italic">AI-generated from recorded vitals — decision support only, not a diagnosis.</p>}
      </Card>

      {detailKey && (() => {
        const metric = METRICS.find((m) => m.key === detailKey);
        if (!metric) return null;
        const readings = [...trend].reverse().filter((t) => t[metric.key] != null);
        const values = readings.map((r) => r[metric.key] as number);
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
        const min = values.length ? Math.min(...values) : null;
        const max = values.length ? Math.max(...values) : null;
        const latestVal = readings[0] ? (readings[0][metric.key] as number) : null;
        const previousVal = readings[1] ? (readings[1][metric.key] as number) : null;
        const delta = latestVal != null && previousVal != null ? latestVal - previousVal : null;
        const latestOut = latestVal != null && metric.range ? latestVal < metric.range[0] || latestVal > metric.range[1] : false;

        const insightParts: string[] = [];
        if (latestVal != null && metric.range) {
          if (latestVal < metric.range[0]) insightParts.push(`Below the normal range (${metric.range[0]}–${metric.range[1]} ${metric.unit})`);
          else if (latestVal > metric.range[1]) insightParts.push(`Above the normal range (${metric.range[0]}–${metric.range[1]} ${metric.unit})`);
          else insightParts.push(`Within the normal range (${metric.range[0]}–${metric.range[1]} ${metric.unit})`);
        }
        if (delta != null) {
          insightParts.push(delta === 0 ? "unchanged since the last reading" : `${delta > 0 ? "increased" : "decreased"} by ${Math.abs(delta).toFixed(1)} ${metric.unit} since the last reading`);
        }
        const insightText = insightParts.length ? insightParts.join(", ") + "." : null;

        return (
          <Dialog open onOpenChange={(o) => !o && setDetailKey(null)}>
            <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <metric.icon className="h-5 w-5 text-primary" />{metric.label}
                  {latestOut && (
                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Out of range</Badge>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                {/* Summary — single line */}
                <Card className={cn("p-3 flex flex-row items-center flex-wrap gap-x-5 gap-y-2", latestOut ? "border-destructive/40 bg-destructive/5" : "border-primary/30 bg-primary/5")}>
                  <span className="flex items-baseline gap-1.5">
                    <span className={cn("text-2xl font-bold leading-none", latestOut && "text-destructive")}>
                      {latestVal ?? "—"}{metric.secondaryKey && readings[0] ? `/${readings[0][metric.secondaryKey] ?? "—"}` : ""}
                    </span>
                    <span className="text-sm text-muted-foreground">{metric.unit}</span>
                  </span>
                  <span className={cn("text-xs flex items-center gap-0.5", delta == null ? "text-muted-foreground/60" : delta > 0 ? "text-amber-600 dark:text-amber-400" : delta < 0 ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")}>
                    {delta == null ? "First reading" : delta === 0 ? <><Minus className="h-3 w-3 shrink-0" /> No change</> : (
                      <>{delta > 0 ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />}{Math.abs(delta).toFixed(1)} vs last</>
                    )}
                  </span>
                  <span className="text-border">·</span>
                  <span className="text-xs text-muted-foreground">Avg {avg != null ? avg.toFixed(1) : "—"}</span>
                  <span className="text-border">·</span>
                  <span className="text-xs text-muted-foreground">Range {min ?? "—"}–{max ?? "—"}</span>
                  <span className="text-border">·</span>
                  <span className="text-xs text-muted-foreground">{readings.length} {readings.length === 1 ? "reading" : "readings"}</span>
                </Card>

                {insightText && (
                  <p className="text-sm text-muted-foreground flex items-start gap-1.5 px-1">
                    <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    {insightText}
                  </p>
                )}

                {/* Big chart */}
                <Card className="p-4 border-border/50 bg-card/60">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id={`fill-${String(metric.key)}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={metric.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      {metric.range && <ReferenceArea y1={metric.range[0]} y2={metric.range[1]} fill="#10b981" fillOpacity={0.08} />}
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={36} domain={["dataMin - 5", "dataMax + 5"]} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                      {metric.secondaryKey && <Legend wrapperStyle={{ fontSize: 12 }} />}
                      <Area type="monotone" dataKey={metric.key} stroke={metric.color} strokeWidth={2.5} fill={`url(#fill-${String(metric.key)})`} dot={ColorDot(metric.range, metric.color)} connectNulls name={metric.label} />
                      {metric.secondaryKey && (
                        <Area type="monotone" dataKey={metric.secondaryKey} stroke={metric.secondaryColor} strokeWidth={2.5} fill="transparent" dot={ColorDot(undefined, metric.secondaryColor || metric.color)} connectNulls name="Diastolic" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  {metric.range && (
                    <p className="text-[11px] text-muted-foreground flex items-center flex-wrap gap-1 mt-2">
                      Normal range: {metric.range[0]}–{metric.range[1]} {metric.unit}
                      <span className="inline-flex items-center gap-1 ml-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> in range</span>
                      <span className="inline-flex items-center gap-1 ml-2"><span className="h-2 w-2 rounded-full bg-destructive" /> out of range</span>
                    </p>
                  )}
                </Card>

              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
