"use client";

import { useMemo, useState } from "react";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { isOutOfRange } from "@/lib/vitals-ranges";
import { useVitalsRangeConfig } from "@/lib/use-vitals-ranges";
import { calculateBmi, bmiBand } from "@/lib/bmi";
import { type VisitWithVitals, type VisitVitals, findLatestVitalSignsFor, findLatestVisitFor } from "@/lib/vitals-trend";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FloatingField } from "@/components/shared/floating-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip as UiTooltip, TooltipTrigger as UiTooltipTrigger, TooltipContent as UiTooltipContent } from "@/components/ui/tooltip";
import {
  HeartPulse, Gauge, Droplets, Thermometer, Plus, Lightbulb,
  Loader2, Activity, ArrowUp, ArrowDown, Minus, X, AlertTriangle,
  Ruler, Pencil, Scale, HelpCircle,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceArea, CartesianGrid, Legend,
  LineChart, Line,
} from "recharts";

interface TrendPoint {
  date: string; fullDate: string; relativeDate: string; time: string;
  heartRate: number | null; pulse: number | null; bpSystolic: number | null; bpDiastolic: number | null;
  spo2: number | null; temperatureF: number | null; weightKg: number | null;
  heightCm: number | null;
  /** Derived from heightCm + weightKg on the same visit — not a recorded field itself. */
  bmi: number | null;
}

// Gradient-track + marker bars (vs. the plain single-color fill used by
// Temperature/Glucose) for metrics with a wide reference window rather than
// a tight pass/fail range — the gradient makes "roughly where am I on the
// whole scale" readable at a glance, with a marker pinned to the exact spot.
const GRADIENT_BAR_KEYS: Partial<Record<keyof TrendPoint, string>> = {
  // 15–40 kg/m² window; bands at the WHO thresholds 18.5 / 25 / 30.
  bmi: "linear-gradient(to right, #f59e0b 0%, #f59e0b 14%, #10b981 14%, #10b981 40%, #f59e0b 40%, #f59e0b 60%, #ef4444 60%, #ef4444 100%)",
};

interface MetricConfig {
  key: keyof TrendPoint;
  secondaryKey?: keyof TrendPoint;
  label: string;
  icon: typeof HeartPulse;
  unit: string;
  color: string;
  secondaryColor?: string;
  secondaryLabel?: string;
  range?: [number, number];
  /** A derived value (e.g. BMI) with no field of its own to record — hides the Add/Edit Reading controls. */
  isComputed?: boolean;
  /** Overrides which VitalSigns field "latest" is looked up by, for a metric whose own key isn't a recorded field. */
  lookupKey?: keyof VisitVitals;
  /** Shown as a (?) tooltip on the tile and as a caption in the detail pop-up, for a value that isn't directly recorded. */
  formula?: string;
}

interface QuickField { key: string; label: string; unit: string; bound?: [number, number] }

// The one or two fields each KPI's "Add Reading" quick-save needs — kept
// separate from the full vitals form so recording just this one metric
// never requires touching (or even seeing) every other field. A function of
// the (admin-configurable) entry bounds rather than a static table.
function buildQuickFields(entryBounds: Record<string, [number, number]>): Record<string, QuickField[]> {
  return {
    pulse: [{ key: "pulse", label: "Pulse", unit: "bpm", bound: entryBounds.pulse }],
    bpSystolic: [
      { key: "bpSystolic", label: "Systolic", unit: "mmHg", bound: entryBounds.bpSystolic },
      { key: "bpDiastolic", label: "Diastolic", unit: "mmHg", bound: entryBounds.bpDiastolic },
    ],
    spo2: [{ key: "spo2", label: "SpO₂", unit: "%", bound: entryBounds.spo2 }],
    temperatureF: [{ key: "temperatureF", label: "Temperature", unit: "°F", bound: entryBounds.temperatureF }],
    heightCm: [
      { key: "heightCm", label: "Height", unit: "cm" },
      { key: "weightKg", label: "Weight", unit: "kg" },
    ],
  };
}

function unitAdornment(unit: string) {
  return <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{unit}</span>;
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
  visits, patientId, apiClient = api, showNewVisitButton = true, onSaved, patientDob, patientGender, currentVisitId,
}: {
  visits: VisitWithVitals[];
  patientId: string;
  /** Defaults to the facility `api` client; admin passes `adminApi` (same shape, different auth header). */
  apiClient?: { get: <T = any>(url: string) => Promise<T>; post: <T = any>(url: string, body?: any) => Promise<T> };
  /** Facility accounts can start a new visit/assessment from here; admin stays view-only. */
  showNewVisitButton?: boolean;
  /** Called after a quick single-metric reading is saved, so the caller can refetch its visits list. */
  onSaved?: () => void | Promise<void>;
  patientDob?: string | null;
  patientGender?: string | null;
  /** The visit this page is actively working with (e.g. the record page's
   * latestVisit) — "Add Reading" attaches a brand-new metric here instead of
   * always forking a new Visit, so it doesn't silently orphan whatever else
   * (Chief Complaint Matrix, Red Flag, Acute Symptoms) was already filled in
   * against this same visit. Omitted entirely, the old "always create a new
   * visit" behavior is unchanged — used by the admin's read-only view. */
  currentVisitId?: string | null;
}) {
  const { normalRanges, entryBounds } = useVitalsRangeConfig(apiClient);
  const QUICK_FIELDS = useMemo(() => buildQuickFields(entryBounds), [entryBounds]);
  const [detailKey, setDetailKey] = useState<keyof TrendPoint | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickValues, setQuickValues] = useState<Record<string, string>>({});
  const [quickErrors, setQuickErrors] = useState<Record<string, string>>({});
  const [addingReading, setAddingReading] = useState(false);
  // When the most recent reading for this metric is still inside the admin's
  // edit window, quick-add switches from "create a new visit" to "correct
  // this one in place" — these track which visit that is and its full
  // current vitals, so saving can merge the correction in without wiping
  // any other field already recorded on that same visit.
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editingVitals, setEditingVitals] = useState<VisitVitals | null>(null);
  const [checkingEditable, setCheckingEditable] = useState(false);
  // Shown inside the metric dialog, under the Add / Edit Last controls.
  const msg = useNotice();

  const openDetail = (key: keyof TrendPoint) => {
    setDetailKey(key);
    setShowQuickAdd(false);
    setQuickValues({});
    setQuickErrors({});
    setEditingVisitId(null);
    setEditingVitals(null);
  };

  const setQuickValue = (key: string, value: string) => {
    setQuickValues((v) => ({ ...v, [key]: value }));
    setQuickErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  // Plain "Add Reading" — always opens blank and always creates a new
  // visit on save, exactly as before. Editing an existing value is a
  // separate, explicit action (openEditLastReading below), never implied
  // by Add.
  const openQuickAdd = () => {
    msg.clear();
    setShowQuickAdd(true);
    setQuickValues({});
    setQuickErrors({});
    setEditingVisitId(null);
    setEditingVitals(null);
  };

  // "Edit Last Reading" — looks up the most recent reading for this metric
  // and, if it's still inside the admin's edit window, opens the same
  // pop-up pre-filled with it so a typo can be fixed in place instead of
  // adding a second, redundant reading on top of the wrong one.
  const openEditLastReading = async (metric: MetricConfig) => {
    const visit = findLatestVisitFor(visitsWithVitals, metric.key as keyof VisitVitals);
    msg.clear();
    if (!visit) {
      msg.info(`No ${metric.label} reading recorded yet`, "Use Add Reading to record the first one.");
      return;
    }
    setShowQuickAdd(true);
    setQuickValues({});
    setQuickErrors({});
    setEditingVisitId(null);
    setEditingVitals(null);
    setCheckingEditable(true);
    try {
      const res = await apiClient.get<{ vitals: VisitVitals | null; locked: boolean }>(`/api/facility/visits/${visit.id}/vitals`);
      if (!res.vitals || res.locked) {
        msg.warning("This reading can no longer be edited", "It's outside the edit window set by the admin. Add a new reading instead — the earlier one stays in the history.");
        setShowQuickAdd(false);
        return;
      }
      setEditingVisitId(visit.id);
      setEditingVitals(res.vitals);
      const prefill: Record<string, string> = {};
      for (const f of QUICK_FIELDS[metric.key]) {
        const v = res.vitals[f.key as keyof VisitVitals];
        if (v != null) prefill[f.key] = String(v);
      }
      setQuickValues(prefill);
    } catch (e: any) {
      msg.error("The last reading couldn't be loaded", `${e.message || "Network error"}.`, { retry: () => openEditLastReading(metric), retryLabel: "Try again" });
      setShowQuickAdd(false);
    } finally {
      setCheckingEditable(false);
    }
  };

  const saveQuickReading = async (metric: MetricConfig) => {
    const fields = QUICK_FIELDS[metric.key];
    const body: Record<string, any> = {};
    const errors: Record<string, string> = {};
    for (const f of fields) {
      const raw = quickValues[f.key] ?? "";
      if (raw === "") {
        errors[f.key] = "Required";
        continue;
      }
      const num = parseFloat(raw);
      if (Number.isNaN(num)) {
        errors[f.key] = "Must be a number";
        continue;
      }
      if (f.bound && (num < f.bound[0] || num > f.bound[1])) {
        errors[f.key] = `Must be between ${f.bound[0]} and ${f.bound[1]}`;
        continue;
      }
      body[f.key] = raw;
    }
    if (Object.keys(errors).length > 0) {
      setQuickErrors(errors);
      return;
    }
    if (metric.key === "temperatureF") {
      body.temperatureC = (((parseFloat(body.temperatureF) - 32) * 5) / 9).toFixed(1);
    }

    setAddingReading(true);
    try {
      let visitId = editingVisitId || currentVisitId;
      // Sending just this metric's field(s) would otherwise null out every
      // other field already recorded on that same visit — merge in whatever
      // the target visit already has, whether that's the reading being
      // corrected in place (editingVitals) or other metrics already added
      // to the current in-progress visit this one is now attaching to.
      const baseVitals = editingVisitId
        ? editingVitals
        : visitId === currentVisitId
          ? visits.find((v) => v.id === currentVisitId)?.vitalSigns ?? null
          : null;
      const postBody = baseVitals ? { ...baseVitals, ...body } : body;
      if (!visitId) {
        const res = await apiClient.post<{ visit: { id: string } }>("/api/facility/visits", { patientId });
        visitId = res.visit.id;
      }
      await apiClient.post<{ vitals: VisitVitals }>(`/api/facility/visits/${visitId}/vitals`, postBody);
      msg.success(`${metric.label} reading ${editingVisitId ? "updated" : "saved"}`, "The chart and latest value above now include it.");
      // Saving (Enter or the Save/Update button) closes the quick-add card
      // back down — the chart/latest value refreshes via onSaved to show
      // what was just recorded.
      setShowQuickAdd(false);
      setQuickValues({});
      setQuickErrors({});
      setEditingVisitId(null);
      setEditingVitals(null);
      await onSaved?.();
    } catch (e: any) {
      msg.error("This reading wasn't saved", `${e.message || "Network error"}. The values are still in the form — try again.`, { retry: () => saveQuickReading(metric), retryLabel: "Save again" });
    } finally {
      setAddingReading(false);
    }
  };

  const visitsWithVitals = useMemo(() => visits.filter((v) => v.vitalSigns), [visits]);

  const trend: TrendPoint[] = useMemo(() => {
    return [...visitsWithVitals]
      .reverse()
      .map((v) => ({
        date: `${new Date(v.visitDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${new Date(v.visitDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}`,
        fullDate: new Date(v.visitDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        relativeDate: daysAgo(v.visitDate),
        time: new Date(v.visitDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true }),
        heartRate: v.vitalSigns?.heartRate ?? null,
        pulse: v.vitalSigns?.pulse ?? null,
        bpSystolic: v.vitalSigns?.bpSystolic ?? null,
        bpDiastolic: v.vitalSigns?.bpDiastolic ?? null,
        spo2: v.vitalSigns?.spo2 ?? null,
        temperatureF: v.vitalSigns?.temperatureF ?? null,
        weightKg: v.vitalSigns?.weightKg ?? null,
        heightCm: v.vitalSigns?.heightCm ?? null,
        bmi: calculateBmi(v.vitalSigns?.heightCm ?? null, v.vitalSigns?.weightKg ?? null),
      }));
  }, [visitsWithVitals]);

  const METRICS: MetricConfig[] = [
    { key: "bpSystolic", secondaryKey: "bpDiastolic", secondaryLabel: "Diastolic", label: "Blood Pressure (Dabao-e-Khoon)", icon: Gauge, unit: "mmHg", color: "#f97316", secondaryColor: "#fb923c", range: normalRanges.bpSystolic },
    { key: "pulse", label: "Pulse (Nabz)", icon: HeartPulse, unit: "bpm", color: "#ef4444", range: normalRanges.pulse },
    { key: "spo2", label: "SpO₂ (Oxygen)", icon: Droplets, unit: "%", color: "#3b82f6", range: normalRanges.spo2 },
    { key: "temperatureF", label: "Temperature (Hararat)", icon: Thermometer, unit: "°F", color: "#f59e0b", range: normalRanges.temperatureF },
    { key: "heightCm", secondaryKey: "weightKg", secondaryLabel: "Weight", label: "Height / Weight (Qad/Wazan)", icon: Ruler, unit: "cm/kg", color: "#0ea5e9", secondaryColor: "#14b8a6" },
    { key: "bmi", lookupKey: "heightCm", label: "BMI", icon: Scale, unit: "kg/m²", color: "#14b8a6", isComputed: true },
  ];

  const statCards = METRICS.map((m) => {
    let value: string = "—";
    let sub = m.unit;
    let out = false;
    let badge: string | null = null;
    let subStats: [string] | null = null;
    let progress: { value: number; min: number; max: number } | null = null;

    // Scoped to this metric's own history, so a quick reading recorded for a
    // different metric (which leaves every other field null on that visit)
    // can't make this tile look blank — see findLatestVitalSignsFor.
    const latest = findLatestVitalSignsFor(visitsWithVitals, (m.lookupKey ?? m.key) as keyof VisitVitals);

    if (latest) {
      if (m.key === "bpSystolic") {
        value = latest.bpSystolic != null || latest.bpDiastolic != null ? `${latest.bpSystolic ?? "—"}/${latest.bpDiastolic ?? "—"}` : "—";
        const sysOut = isOutOfRange(normalRanges, "bpSystolic", latest.bpSystolic);
        const diaOut = isOutOfRange(normalRanges, "bpDiastolic", latest.bpDiastolic);
        out = sysOut || diaOut;
        badge = out ? "Review" : "Optimal";
        if (latest.bpSystolic != null && latest.bpDiastolic != null) {
          subStats = [`Sys ${sysOut ? "Review" : "Normal"} · Dia ${diaOut ? "Review" : "Steady"}`];
        }
      } else if (m.key === "heightCm") {
        value = latest.heightCm != null || latest.weightKg != null ? `${latest.heightCm ?? "—"}/${latest.weightKg ?? "—"}` : "—";
      } else if (m.key === "bmi") {
        // BMI = weight(kg) / height(m)² — reuses the same calculateBmi used
        // elsewhere in the app (e.g. the patient profile's Biometrics card),
        // computed from the same visit findLatestVitalSignsFor("heightCm")
        // already resolved, so it stays in sync with the Height/Weight tile.
        const bmi = calculateBmi(latest.heightCm, latest.weightKg);
        value = bmi != null ? bmi.toFixed(1) : "—";
        const band = bmiBand(bmi);
        if (band) {
          badge = band.label;
          out = band.label !== "Normal";
        }
        if (bmi != null) {
          // 15–40 window matches the patient profile's own BMI bar, so the
          // same value reads at the same relative position in both places.
          progress = { value: bmi, min: 15, max: 40 };
        }
      } else if (m.key === "spo2") {
        value = latest.spo2 != null ? `${latest.spo2}%` : "—";
        out = isOutOfRange(normalRanges, "spo2", latest.spo2);
        badge = latest.spo2 != null ? (out ? "Review" : "Normal") : null;
      } else if (m.key === "temperatureF") {
        value = latest.temperatureF != null ? `${latest.temperatureF}°F` : "—";
        sub = latest.temperatureC != null ? `${latest.temperatureC}°C` : "";
        out = isOutOfRange(normalRanges, "temperatureF", latest.temperatureF);
        if (latest.temperatureF != null) {
          badge = out ? "Febrile" : "Normothermic";
          subStats = [out ? "Review" : "Euthermic"];
          progress = { value: latest.temperatureF, min: normalRanges.temperatureF[0] - 2, max: normalRanges.temperatureF[1] + 3 };
        }
      } else {
        const raw = latest[m.key as keyof VisitVitals] as number | null;
        value = raw != null ? String(raw) : "—";
        if (m.range) {
          out = isOutOfRange(normalRanges, m.key, raw);
        }
        if (raw != null) {
          if (m.range) badge = out ? "Review" : "Normal";
          subStats = m.key === "pulse"
            ? [out ? "Needs Review" : "Regular Nabz"]
            : null;
        }
      }
    }
    // Scoped to this metric alone — a quick reading recorded for a different
    // metric must never show up as a gap or phantom point on this one's
    // sparkline/chart, matching how its "latest" value is already scoped.
    const cardTrend = trend.filter((t) => t[m.key] != null);
    return { ...m, value, sub, out, badge, subStats, progress, points: cardTrend.length, cardTrend };
  });

  const renderStatCard = (c: (typeof statCards)[number]) => (
    <Card
      key={c.label}
      onClick={() => openDetail(c.key)}
      className={cn(
        "relative overflow-hidden p-3.5 border-border/50 bg-card cursor-pointer hover:border-primary/40 transition-colors gap-2.5",
        c.out && "border-destructive/40 bg-destructive/5"
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          {c.label}
          {c.formula && (
            <UiTooltip>
              <UiTooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/50 hover:text-foreground shrink-0"
                >
                  <HelpCircle className="h-3 w-3" />
                </button>
              </UiTooltipTrigger>
              <UiTooltipContent side="top" className="max-w-[200px] whitespace-pre-line text-center text-[11px] normal-case font-normal">
                {c.formula}
              </UiTooltipContent>
            </UiTooltip>
          )}
        </p>
        <c.icon className={cn("h-3.5 w-3.5 shrink-0", c.out ? "text-destructive" : "text-muted-foreground/70")} />
      </div>

      <div className="flex items-end justify-between gap-1.5">
        <p className="flex items-baseline gap-1.5 min-w-0">
          <span className={cn(c.key === "bmi" ? "text-2xl" : "text-3xl", "font-bold leading-none tracking-tight", c.out && "text-destructive")}>{c.value}</span>
          <span className={cn("text-xs truncate", c.out ? "text-destructive font-medium" : "text-muted-foreground")}>{c.sub}</span>
        </p>
        {c.points >= 2 && (
          <div className="w-14 h-9 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={c.cardTrend}>
                <Line type="monotone" dataKey={c.key} stroke={c.color} strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {c.progress && (GRADIENT_BAR_KEYS[c.key] ? (
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: GRADIENT_BAR_KEYS[c.key] }}>
          <div
            className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-foreground ring-2 ring-background"
            style={{ left: `${Math.min(100, Math.max(0, ((c.progress.value - c.progress.min) / (c.progress.max - c.progress.min)) * 100))}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full rounded-full", c.out ? "bg-destructive" : "bg-emerald-500")}
            style={{ width: `${Math.min(100, Math.max(0, ((c.progress.value - c.progress.min) / (c.progress.max - c.progress.min)) * 100))}%` }}
          />
        </div>
      ))}

      {(c.badge || c.subStats) && (
        <div className="flex items-center justify-between gap-1.5">
          {c.badge ? (
            <Badge
              variant="outline"
              className={cn(
                "rounded-full border text-[10px] px-2.5 py-0.5 font-semibold",
                c.out ? "bg-destructive/15 text-destructive border-destructive/30" : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              )}
            >
              {c.badge}
            </Badge>
          ) : <span />}
          {c.subStats && <span className="text-[11px] text-muted-foreground truncate">{c.subStats[0]}</span>}
        </div>
      )}
    </Card>
  );

  return (
    <>
    <Card className="p-5 border-border/50 bg-card/60">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Vitals &amp; Nabz Parameters
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map(renderStatCard)}
      </div>
    </Card>

      {detailKey && (() => {
        const metric = METRICS.find((m) => m.key === detailKey);
        if (!metric) return null;
        // Chronological (oldest first) and newest-first views of this
        // metric's own readings only — a visit where only a different
        // metric was quick-added has no entry here at all, so it can't
        // show up as a gap or phantom tick on this metric's chart.
        const chartData = trend.filter((t) => t[metric.key] != null);
        const readings = [...chartData].reverse();
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
          <Dialog open onOpenChange={(o) => { if (!o) { setDetailKey(null); msg.clear(); } }}>
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

                {showNewVisitButton && !metric.isComputed && (showQuickAdd ? (
                  <Card className="relative px-3.5 pb-2.5 pt-6 border-primary/30 bg-primary/5 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => { setShowQuickAdd(false); setQuickValues({}); setQuickErrors({}); setEditingVisitId(null); setEditingVitals(null); }}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {(() => {
                      const fields = QUICK_FIELDS[metric.key].map((f) => {
                        const raw = quickValues[f.key] ?? "";
                        const num = parseFloat(raw);
                        const outOfBounds = f.bound != null && raw !== "" && !Number.isNaN(num) && (num < f.bound[0] || num > f.bound[1]);
                        return { ...f, raw, outOfBounds };
                      });
                      return (
                        <div className="flex items-start gap-2">
                          <div className={cn("grid gap-2 flex-1", fields.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                            {fields.map((f) => {
                              const fieldError = quickErrors[f.key];
                              return (
                                <div key={f.key}>
                                  <FloatingField
                                    id={`quick-${f.key}`}
                                    label={f.bound ? `${f.label} (${f.bound[0]}–${f.bound[1]})` : f.label}
                                    type="number"
                                    inputMode="decimal"
                                    value={f.raw}
                                    onChange={(e) => setQuickValue(f.key, e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        saveQuickReading(metric);
                                      }
                                    }}
                                    endAdornment={unitAdornment(f.unit)}
                                    error={f.outOfBounds || !!fieldError}
                                    className="h-10"
                                  />
                                  {fieldError && (
                                    <div className="flex items-center gap-0.5 mt-1 px-0.5 text-[11px] text-destructive font-medium">
                                      <AlertTriangle className="h-3 w-3" /> {fieldError}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <Button size="sm" className="h-10 shrink-0" onClick={() => saveQuickReading(metric)} disabled={addingReading || checkingEditable}>
                            {addingReading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : editingVisitId ? (
                              <Pencil className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )} {editingVisitId ? "Update" : "Save"}
                          </Button>
                        </div>
                      );
                    })()}
                  </Card>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={openQuickAdd}>
                      <Plus className="h-3.5 w-3.5" /> Add {metric.label} Reading
                    </Button>
                    {findLatestVisitFor(visitsWithVitals, metric.key as keyof VisitVitals) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => openEditLastReading(metric)}
                        disabled={checkingEditable}
                      >
                        {checkingEditable ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />} Edit Last
                      </Button>
                    )}
                  </div>
                ))}
                <NoticeSlot state={msg} />

                {insightText && (
                  <p className="text-sm text-muted-foreground flex items-start gap-1.5 px-1">
                    <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    {insightText}
                  </p>
                )}

                {/* Big chart */}
                <Card className="p-4 border-border/50 bg-card/60">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
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
                        <Area type="monotone" dataKey={metric.secondaryKey} stroke={metric.secondaryColor} strokeWidth={2.5} fill="transparent" dot={ColorDot(undefined, metric.secondaryColor || metric.color)} connectNulls name={metric.secondaryLabel || "Secondary"} />
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
                  {metric.formula && (
                    <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 mt-2">
                      <Lightbulb className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                      <span className="whitespace-pre-line">{metric.formula}</span>
                    </p>
                  )}
                </Card>

              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </>
  );
}
