"use client";

import { useMemo, useState } from "react";
import { NoticeSlot, useNotice } from "@/components/shared/inline-notice";
import { SectionHeading } from "@/components/shared/section-heading";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { daysAgo } from "@/lib/age";
import { useVitalsRangeConfig } from "@/lib/use-vitals-ranges";
import { calculateBmi } from "@/lib/bmi";
import { bpStatus, pulseStatus, spo2Status, temperatureStatus, bmiStatus, referenceBands, TONE_STYLES, GAUGE_SCALE, type VitalTone } from "@/lib/vital-status";
import { type VisitWithVitals, type VisitVitals, findLatestVitalSignsFor, findLatestVisitFor } from "@/lib/vitals-trend";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FloatingField } from "@/components/shared/floating-field";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  HeartPulse, Gauge, Droplets, Thermometer, Plus, Lightbulb,
  Loader2, Activity, ArrowUp, ArrowDown, Minus, X, AlertTriangle,
  Ruler, Pencil, Scale, HelpCircle, ChevronRight, ChevronsLeft, ChevronsRight,
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

interface MetricConfig {
  key: keyof TrendPoint;
  secondaryKey?: keyof TrendPoint;
  label: string;
  icon: typeof HeartPulse;
  unit: string;
  color: string;
  secondaryColor?: string;
  secondaryLabel?: string;
  /** Unani term shown under the plain name. */
  unani: string;
  /** Chart legend name for the primary series when there are two (e.g. "Systolic"). */
  primaryLabel?: string;
  range?: [number, number];
  secondaryRange?: [number, number];
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
  return <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground pointer-events-none">{unit}</span>;
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
    // The lower number can never be above the upper one — almost always a swapped entry.
    if (metric.key === "bpSystolic" && !errors.bpSystolic && !errors.bpDiastolic && parseFloat(body.bpDiastolic) >= parseFloat(body.bpSystolic)) {
      errors.bpDiastolic = "Must be lower than systolic — check the two numbers aren't swapped";
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
    { key: "bpSystolic", secondaryKey: "bpDiastolic", label: "Blood Pressure", unani: "Dabao-e-Khoon", primaryLabel: "Systolic", secondaryLabel: "Diastolic", icon: Gauge, unit: "mmHg", color: "#f97316", secondaryColor: "#8b5cf6", range: normalRanges.bpSystolic, secondaryRange: normalRanges.bpDiastolic },
    { key: "pulse", label: "Pulse", unani: "Nabz", icon: HeartPulse, unit: "bpm", color: "#ef4444", range: normalRanges.pulse },
    { key: "spo2", label: "Oxygen", unani: "SpO₂ saturation", icon: Droplets, unit: "%", color: "#3b82f6", range: normalRanges.spo2 },
    { key: "temperatureF", label: "Temperature", unani: "Hararat", icon: Thermometer, unit: "°F", color: "#f59e0b", range: normalRanges.temperatureF },
    { key: "heightCm", secondaryKey: "weightKg", label: "Height & Weight", unani: "Qad / Wazan", primaryLabel: "Height (cm)", secondaryLabel: "Weight (kg)", icon: Ruler, unit: "", color: "#0ea5e9", secondaryColor: "#14b8a6" },
    { key: "bmi", lookupKey: "heightCm", label: "BMI", unani: "Body mass index", icon: Scale, unit: "kg/m²", color: "#14b8a6", isComputed: true, formula: "Weight (kg) ÷ height (m)², from the latest height and weight." },
  ];

  const statusFor = (key: keyof TrendPoint, p: { bpSystolic?: number | null; bpDiastolic?: number | null; pulse?: number | null; spo2?: number | null; temperatureF?: number | null; bmi?: number | null }) =>
    key === "bpSystolic" ? bpStatus(p.bpSystolic ?? null, p.bpDiastolic ?? null, normalRanges)
      : key === "pulse" ? pulseStatus(p.pulse ?? null, normalRanges)
        : key === "spo2" ? spo2Status(p.spo2 ?? null, normalRanges)
          : key === "temperatureF" ? temperatureStatus(p.temperatureF ?? null, normalRanges)
            : key === "bmi" || key === "heightCm" ? bmiStatus(p.bmi ?? null)
              : null;

  const formatValue = (key: keyof TrendPoint, p: TrendPoint | VisitVitals) => {
    if (key === "bpSystolic") return p.bpSystolic != null || p.bpDiastolic != null ? `${p.bpSystolic ?? "—"}/${p.bpDiastolic ?? "—"}` : "—";
    if (key === "heightCm") return p.heightCm != null || p.weightKg != null ? `${p.heightCm ?? "—"} cm · ${p.weightKg ?? "—"} kg` : "—";
    if (key === "bmi") { const b = calculateBmi(p.heightCm, p.weightKg); return b != null ? b.toFixed(1) : "—"; }
    const v = p[key as keyof typeof p] as number | null;
    return v != null ? String(v) : "—";
  };

  const tiles = METRICS.map((m) => {
    // Scoped to this metric's own history, so a quick reading recorded for a
    // different metric can't make this tile look blank — see findLatestVitalSignsFor.
    const lookup = (m.lookupKey ?? m.key) as keyof VisitVitals;
    const latest = findLatestVitalSignsFor(visitsWithVitals, lookup);
    const latestVisit = findLatestVisitFor(visitsWithVitals, lookup);
    const cardTrend = trend.filter((t) => t[m.key] != null);
    const bmi = latest ? calculateBmi(latest.heightCm, latest.weightKg) : null;
    const status = latest ? statusFor(m.key, { ...latest, bmi }) : null;
    const last = cardTrend[cardTrend.length - 1];
    const prev = cardTrend[cardTrend.length - 2];
    const delta = last && prev ? (last[m.key] as number) - (prev[m.key] as number) : null;
    return { ...m, latest, latestVisit, cardTrend, status, delta, bmi };
  });
  const needAttention = tiles.filter((t) => t.status && t.status.tone !== "ok").length;
  const lastRecordedAt = visitsWithVitals[0]?.visitDate;

  // Tiles: just the time for today's readings, otherwise "Yesterday" / "3 days ago".
  const whenShort = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })
      : daysAgo(iso);
  };
  const when = (iso: string) => `${daysAgo(iso)}, ${new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true })}`;

  const renderTile = (t: (typeof tiles)[number]) => {
    const tone = t.status ? TONE_STYLES[t.status.tone] : null;
    const empty = !t.latest;
    return (
      <div
        key={t.key}
        role="button"
        tabIndex={0}
        onClick={() => openDetail(t.key)}
        onKeyDown={(e) => { if (e.key === "Enter") openDetail(t.key); }}
        className={cn(
          "group relative flex flex-col gap-2.5 rounded-xl border p-3.5 cursor-pointer outline-none transition-all",
          "hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40",
          tone && t.status!.tone !== "ok" ? cn(tone.border, tone.bg) : "border-border bg-card shadow-xs hover:border-primary/50",
        )}
      >
        {/* Name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${t.color}1f`, color: t.color }}>
              <t.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{t.label}</p>
              <p className="text-xs text-muted-foreground leading-tight">{t.unani}</p>
            </div>
          </div>
          {t.cardTrend.length >= 2 && (
            <div className="w-12 h-7 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" title="Trend">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={t.cardTrend}>
                  <Line type="monotone" dataKey={t.key} stroke={t.color} strokeWidth={1.75} dot={false} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {empty ? (
          <div className="flex-1 flex flex-col items-start justify-center gap-2 py-1">
            <p className="text-sm text-muted-foreground">{t.isComputed ? "Needs height and weight" : "Not recorded yet"}</p>
            {showNewVisitButton && !t.isComputed && (
              <Button size="sm" variant="outline" className="h-7 text-[13px]" onClick={(e) => { e.stopPropagation(); openDetail(t.key); openQuickAdd(); }}>
                <Plus className="h-3 w-3" /> Add reading
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Value + status */}
            <div className="flex items-end justify-between gap-2 flex-wrap">
              <p className="flex items-baseline gap-1 min-w-0">
                <span className={cn("font-bold leading-none tracking-tight", t.key === "heightCm" ? "text-xl" : "text-3xl", tone && t.status!.tone !== "ok" && tone.text)}>
                  {formatValue(t.key, t.latest!)}
                </span>
                {t.unit && <span className="text-[13px] text-muted-foreground">{t.unit}</span>}
                {t.key === "temperatureF" && t.latest!.temperatureC != null && <span className="text-[13px] text-muted-foreground">· {t.latest!.temperatureC}°C</span>}
              </p>
              {t.delta != null && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground whitespace-nowrap" title="Change since the previous reading">
                  {t.delta === 0 ? <><Minus className="h-3 w-3" /> same</> : <>{t.delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(t.delta).toFixed(t.key === "temperatureF" || t.key === "bmi" ? 1 : 0)}</>}
                </span>
              )}
            </div>

            {/* Where the reading sits against normal */}
            {t.key === "bpSystolic" ? (
              <div className="grid grid-cols-2 gap-3">
                <RangeBar label="S" value={t.latest!.bpSystolic} scale={GAUGE_SCALE.bpSystolic} normal={normalRanges.bpSystolic} tone={t.status?.tone} />
                <RangeBar label="D" value={t.latest!.bpDiastolic} scale={GAUGE_SCALE.bpDiastolic} normal={normalRanges.bpDiastolic} tone={t.status?.tone} />
              </div>
            ) : t.key === "heightCm" ? (
              <p className="text-[13px] text-muted-foreground">BMI {t.bmi != null ? t.bmi.toFixed(1) : "—"}</p>
            ) : GAUGE_SCALE[t.key] ? (
              <RangeBar value={t.key === "bmi" ? t.bmi : (t.latest![t.key as keyof VisitVitals] as number | null)} scale={GAUGE_SCALE[t.key]} normal={t.key === "bmi" ? [18.5, 24.9] : t.range!} tone={t.status?.tone} />
            ) : null}

            {/* Change + when */}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-auto pt-0.5">
              {t.status && tone ? (
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", tone.text, tone.bg, tone.border)}>
                  {t.status.tone === "urgent" ? <AlertTriangle className="h-3 w-3" /> : t.status.tone === "check" ? <HelpCircle className="h-3 w-3" /> : <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />}
                  {t.status.label}
                </span>
              ) : <span />}
              {t.latestVisit && <span className="truncate text-right group-hover:hidden" title={when(t.latestVisit.visitDate)}>{whenShort(t.latestVisit.visitDate)}</span>}
              <span className="hidden group-hover:flex items-center gap-0.5 text-primary font-medium whitespace-nowrap">View details <ChevronRight className="h-3 w-3" /></span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
    <Card className="p-5 border-border bg-card/60 gap-4">
      <SectionHeading
        icon={Activity}
        title="Vital Signs & Pulse (Nabz)"
        right={
        <div className="flex items-center gap-2 text-[13px]">
          {visitsWithVitals.length > 0 && (needAttention > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" /> {needAttention} {needAttention === 1 ? "reading needs" : "readings need"} attention
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> All readings normal
            </span>
          ))}
          {lastRecordedAt && <span className="text-muted-foreground">Last recorded {when(lastRecordedAt)}</span>}
        </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {tiles.map(renderTile)}
      </div>
    </Card>

      {detailKey && (() => {
        const metric = METRICS.find((m) => m.key === detailKey);
        const tile = tiles.find((t) => t.key === detailKey);
        if (!metric || !tile) return null;
        // This metric's own readings only — a visit where only a different
        // metric was quick-added has no entry here at all.
        const chartData = trend.filter((t) => t[metric.key] != null);
        const readings = [...chartData].reverse();
        const nums = (k: keyof TrendPoint) => readings.map((r) => r[k] as number | null).filter((v): v is number => v != null);
        const stat = (k: keyof TrendPoint) => {
          const v = nums(k);
          return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min(...v), max: Math.max(...v) } : null;
        };
        const p1 = stat(metric.key); const p2 = metric.secondaryKey ? stat(metric.secondaryKey) : null;
        const dp = (k: keyof TrendPoint) => (k === "temperatureF" || k === "bmi" || k === "weightKg" ? 1 : 0);
        const pair = (a: number | undefined, b: number | undefined, k1: keyof TrendPoint, k2?: keyof TrendPoint) =>
          a == null ? "—" : b != null && k2 ? `${a.toFixed(dp(k1))}/${b.toFixed(dp(k2))}` : a.toFixed(dp(k1));
        const status = tile.status; const tone = status ? TONE_STYLES[status.tone] : null;
        const bands = referenceBands(metric.key, normalRanges);
        const deltaText = tile.delta == null ? "First reading" : tile.delta === 0 ? "No change" : `${tile.delta > 0 ? "+" : "−"}${Math.abs(tile.delta).toFixed(dp(metric.key))}`;

        return (
          <Dialog open onOpenChange={(o) => { if (!o) { setDetailKey(null); msg.clear(); } }}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto gap-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${metric.color}1f`, color: metric.color }}>
                    <metric.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold leading-tight">{metric.label}</span>
                    <span className="block text-[13px] font-normal text-muted-foreground">{metric.unani}</span>
                  </span>
                  {status && tone && (
                    <span className={cn("ml-auto mr-6 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[13px] font-semibold", tone.text, tone.bg, tone.border)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} /> {status.label}
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              {/* Latest reading, explained */}
              {tile.latest ? (
                <div className={cn("rounded-xl border p-4 grid gap-4 md:grid-cols-[auto_1fr] md:items-center", tone && status!.tone !== "ok" ? cn(tone.border, tone.bg) : "border-border bg-muted/30")}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest reading</p>
                    <p className="flex items-baseline gap-1.5 mt-1">
                      <span className={cn("text-4xl font-bold leading-none tracking-tight", tone && status!.tone !== "ok" && tone.text)}>{formatValue(metric.key, tile.latest)}</span>
                      {metric.unit && <span className="text-sm text-muted-foreground">{metric.unit}</span>}
                    </p>
                    {tile.latestVisit && <p className="text-[13px] text-muted-foreground mt-1.5">{when(tile.latestVisit.visitDate)}</p>}
                  </div>
                  <div className="space-y-3 min-w-0">
                    {status && <p className="text-sm leading-relaxed">{status.detail}</p>}
                    {metric.key === "bpSystolic" ? (
                      <div className="space-y-1.5">
                        <RangeBar label="Systolic" value={tile.latest.bpSystolic} scale={GAUGE_SCALE.bpSystolic} normal={normalRanges.bpSystolic} tone={status?.tone} large />
                        <RangeBar label="Diastolic" value={tile.latest.bpDiastolic} scale={GAUGE_SCALE.bpDiastolic} normal={normalRanges.bpDiastolic} tone={status?.tone} large />
                      </div>
                    ) : GAUGE_SCALE[metric.key === "heightCm" ? "bmi" : metric.key] ? (
                      <RangeBar
                        label={metric.key === "heightCm" ? "BMI" : undefined}
                        value={metric.key === "bmi" || metric.key === "heightCm" ? tile.bmi : (tile.latest[metric.key as keyof VisitVitals] as number | null)}
                        scale={GAUGE_SCALE[metric.key === "heightCm" ? "bmi" : metric.key]}
                        normal={metric.key === "bmi" || metric.key === "heightCm" ? [18.5, 24.9] : metric.range!}
                        tone={status?.tone}
                        large
                      />
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 p-6 text-center">
                  <p className="text-sm font-medium">{metric.isComputed ? "BMI appears once height and weight are recorded" : `No ${metric.label.toLowerCase()} reading yet`}</p>
                  {!metric.isComputed && showNewVisitButton && <p className="text-[13px] text-muted-foreground mt-1">Add the first reading below.</p>}
                </div>
              )}

              {/* At a glance */}
              {readings.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Change vs last", value: deltaText },
                    { label: "Average", value: pair(p1?.avg, p2?.avg, metric.key, metric.secondaryKey) },
                    { label: "Lowest", value: pair(p1?.min, p2?.min, metric.key, metric.secondaryKey) },
                    { label: "Highest", value: pair(p1?.max, p2?.max, metric.key, metric.secondaryKey) },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-2">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-semibold">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add / correct */}
              {showNewVisitButton && !metric.isComputed && (showQuickAdd ? (
                <Card className="relative px-3.5 pb-2.5 pt-3 border-primary/30 bg-primary/5 gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold text-primary">{editingVisitId ? "Correct the last reading" : "New reading"}</p>
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => { setShowQuickAdd(false); setQuickValues({}); setQuickErrors({}); setEditingVisitId(null); setEditingVitals(null); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
                                  label={f.label}
                                  type="number"
                                  inputMode="decimal"
                                  value={f.raw}
                                  autoFocus={f === fields[0]}
                                  onChange={(e) => setQuickValue(f.key, e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveQuickReading(metric); } }}
                                  endAdornment={unitAdornment(f.unit)}
                                  error={f.outOfBounds || !!fieldError}
                                  className="h-11"
                                />
                                {fieldError ? (
                                  <div className="flex items-center gap-0.5 mt-1 px-0.5 text-xs text-destructive font-medium">
                                    <AlertTriangle className="h-3 w-3" /> {fieldError}
                                  </div>
                                ) : f.bound ? (
                                  <p className="mt-1 px-0.5 text-xs text-muted-foreground">Accepted {f.bound[0]}–{f.bound[1]} {f.unit}</p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                        <Button className="h-11 shrink-0" onClick={() => saveQuickReading(metric)} disabled={addingReading || checkingEditable}>
                          {addingReading ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVisitId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          {editingVisitId ? "Update" : "Save"}
                        </Button>
                      </div>
                    );
                  })()}
                </Card>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={openQuickAdd}>
                    <Plus className="h-3.5 w-3.5" /> Add new reading
                  </Button>
                  {findLatestVisitFor(visitsWithVitals, metric.key as keyof VisitVitals) && (
                    <Button size="sm" variant="outline" onClick={() => openEditLastReading(metric)} disabled={checkingEditable}>
                      {checkingEditable ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />} Correct last reading
                    </Button>
                  )}
                </div>
              ))}
              <NoticeSlot state={msg} />

              {/* Trend */}
              {chartData.length >= 2 ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm font-semibold mb-2">Trend</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`fill-${String(metric.key)}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={metric.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={metric.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      {metric.range && <ReferenceArea y1={metric.range[0]} y2={metric.range[1]} fill="#10b981" fillOpacity={0.1} ifOverflow="extendDomain" />}
                      {metric.secondaryRange && <ReferenceArea y1={metric.secondaryRange[0]} y2={metric.secondaryRange[1]} fill="#8b5cf6" fillOpacity={0.07} ifOverflow="extendDomain" />}
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} domain={["dataMin - 5", "dataMax + 5"]} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 10 }}
                        labelFormatter={(_, payload) => { const p = payload?.[0]?.payload as TrendPoint | undefined; return p ? `${p.fullDate}, ${p.time}` : ""; }}
                      />
                      {metric.secondaryKey && <Legend wrapperStyle={{ fontSize: 12 }} />}
                      <Area type="monotone" dataKey={metric.key} stroke={metric.color} strokeWidth={2.5} fill={`url(#fill-${String(metric.key)})`} dot={ColorDot(metric.range, metric.color)} connectNulls name={metric.primaryLabel || metric.label} />
                      {metric.secondaryKey && (
                        <Area type="monotone" dataKey={metric.secondaryKey} stroke={metric.secondaryColor} strokeWidth={2.5} fill="transparent" dot={ColorDot(metric.secondaryRange, metric.secondaryColor || metric.color)} connectNulls name={metric.secondaryLabel} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  {metric.range && (
                    <p className="text-xs text-muted-foreground flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
                      <span className="inline-flex items-center gap-1"><span className="h-2.5 w-4 rounded-sm bg-emerald-500/20" /> Normal zone</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> Outside normal</span>
                    </p>
                  )}
                </div>
              ) : readings.length === 1 ? (
                <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 px-1">
                  <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0" /> The trend chart appears once there are two or more readings.
                </p>
              ) : null}

              {/* Reading history */}
              {readings.length > 0 && (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <p className="text-sm font-semibold px-4 pt-3 pb-2">Reading history <span className="text-muted-foreground font-normal">· {readings.length}</span></p>
                  <div className="divide-y divide-border/50 max-h-56 overflow-y-auto">
                    {readings.slice(0, 20).map((r, i) => {
                      const st = statusFor(metric.key, { ...r, bmi: r.bmi });
                      const ts = st ? TONE_STYLES[st.tone] : null;
                      return (
                        <div key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                          <span className="w-32 shrink-0 text-[13px] text-muted-foreground">{r.fullDate}<span className="block">{r.time}</span></span>
                          <span className="font-semibold flex-1">{formatValue(metric.key, r)} <span className="text-[13px] font-normal text-muted-foreground">{metric.unit}</span></span>
                          {i === 0 && <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latest</span>}
                          {st && ts && <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", ts.text, ts.bg, ts.border)}>{st.label}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* What's normal */}
              {bands.length > 0 && (
                <details className="group/ref rounded-xl border border-border bg-card px-4 py-3">
                  <summary className="text-sm font-semibold cursor-pointer list-none flex items-center justify-between">
                    What&apos;s normal?
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open/ref:rotate-90" />
                  </summary>
                  <div className="mt-3 grid gap-y-1.5 max-w-md">
                    {bands.map((b) => (
                      <div key={b.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", TONE_STYLES[b.tone].dot)} />{b.label}</span>
                        <span className="text-muted-foreground tabular-nums">{b.range}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {metric.formula ?? "Normal ranges are set by your administrator. Guidance only — the doctor makes the clinical judgement."}
                  </p>
                </details>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
    </>
  );
}

/**
 * Horizontal scale with the normal zone shaded and a marker at the reading. A reading beyond the
 * visible window shows as an arrow at that edge; the large bar also labels its scale.
 */
function RangeBar({ value, scale, normal, tone, label, large }: {
  value: number | null | undefined; scale: [number, number]; normal: [number, number]; tone?: VitalTone; label?: string; large?: boolean;
}) {
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - scale[0]) / (scale[1] - scale[0])) * 100));
  const marker = value != null ? pct(value) : null;
  const off = value == null ? null : value < scale[0] ? "below" : value > scale[1] ? "above" : null;
  const color = TONE_STYLES[tone ?? "ok"].bar;
  const fmtN = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  // Scale ends in grey, normal bounds in green; a bound that coincides with (or crowds) an end replaces it.
  const ticks = large ? (() => {
    const t: { v: number; at: number; normal: boolean; text: string }[] = [];
    for (const v of normal) t.push({ v, at: pct(v), normal: true, text: fmtN(v) });
    for (const [i, v] of scale.entries()) {
      const edge = i === 0 ? "below" : "above";
      const text = off === edge ? `${edge} ${fmtN(v)}` : fmtN(v);
      const near = t.findIndex((x) => Math.abs(x.at - pct(v)) < 9);
      if (near >= 0) { if (off === edge) t[near] = { ...t[near], text: `${edge} ${fmtN(v)}`, normal: false }; continue; }
      t.push({ v, at: pct(v), normal: false, text });
    }
    return t;
  })() : [];
  const Arrow = off === "below" ? ChevronsLeft : ChevronsRight;
  return (
    <div className={cn("flex items-center gap-2", large && "pb-4")} title={`Normal ${normal[0]}–${normal[1]} · scale ${scale[0]}–${scale[1]}`}>
      {label && <span className={cn("shrink-0 text-muted-foreground", large ? "w-16 text-[13px]" : "w-3 text-[11px] font-semibold")}>{label}</span>}
      <div className={cn("relative flex-1 rounded-full bg-muted", large ? "h-2.5" : "h-1.5")}>
        <div className="absolute inset-y-0 rounded-full bg-emerald-500/30" style={{ left: `${pct(normal[0])}%`, width: `${pct(normal[1]) - pct(normal[0])}%` }} />
        {marker != null && (off ? (
          <span
            className={cn("absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full ring-2 ring-background text-white", large ? "h-5 w-5" : "h-3.5 w-3.5", off === "below" ? "left-0 -translate-x-1/4" : "right-0 translate-x-1/4")}
            style={{ background: color }} aria-label={`Reading ${off} the scale`}>
            <Arrow className={large ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} />
          </span>
        ) : (
          <div
            className={cn("absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background", large ? "h-4 w-4" : "h-3 w-3")}
            style={{ left: `${marker}%`, background: color }}
          />
        ))}
        {ticks.map((t) => (
          <span key={`${t.v}-${t.text}`}
            className={cn("absolute top-full mt-1.5 whitespace-nowrap text-[11px] tabular-nums leading-none",
              t.at <= 2 ? "" : t.at >= 98 ? "-translate-x-full" : "-translate-x-1/2",
              t.normal ? "text-emerald-700 dark:text-emerald-400 font-medium" : off && t.text.startsWith(off) ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}
            style={{ left: `${t.at}%` }}>{t.text}</span>
        ))}
      </div>
      {large && value != null && <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums">{value}</span>}
    </div>
  );
}
