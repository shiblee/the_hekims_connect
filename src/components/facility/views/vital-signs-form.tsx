"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { formatAge, daysAgo } from "@/lib/age";
import { isOutOfRange, toCelsiusRange } from "@/lib/vitals-ranges";
import { useVitalsRangeConfig } from "@/lib/use-vitals-ranges";
import { calculateBmi, bmiBand } from "@/lib/bmi";
import { cmToFeetInches } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FloatingField, FloatingSplitField } from "@/components/shared/floating-field";
import { ChevronLeft, Loader2, Save, AlertTriangle, History, IdCard } from "lucide-react";
import { PatientStageTracker, PATIENT_JOURNEY_STEPS } from "@/components/facility/views/patient-stage-tracker";

interface MetaSections {
  [key: string]: { label: string; options: string[] };
}

interface Patient {
  id: string; patientCode: string | null; name: string; gender: string | null;
  dob: string | null; dobApprox: boolean; bloodGroup: string | null; phone: string | null; avatarColor: string;
}

interface VisitInfo { id: string; visitCode: string; visitDate: string; patient: Patient }

interface Vitals {
  pulse: number | null; bpSystolic: number | null; bpDiastolic: number | null;
  spo2: number | null; spo2Context: string | null;
  temperatureF: number | null; temperatureC: number | null;
  heightCm: number | null; weightKg: number | null;
  updatedAt?: string;
  painNotes: string | null; primaryFocusArea: string | null; triageRemarks: string | null;
}

interface Previous extends Vitals { visitCode: string; visitDate: string }

function RangeHint({
  field, value, normalRanges, entryBounds,
}: {
  field: string; value: string;
  normalRanges: Record<string, [number, number]>; entryBounds: Record<string, [number, number]>;
}) {
  const range = normalRanges[field];
  const entryBound = entryBounds[field];
  if (!range && !entryBound) return null;

  const num = parseFloat(value);
  const hasNum = value !== "" && !Number.isNaN(num);
  const outOfEntryBound = hasNum && !!entryBound && (num < entryBound[0] || num > entryBound[1]);
  const outOfNormal = hasNum && !!range && (num < range[0] || num > range[1]);

  return (
    <div className="flex items-center justify-between mt-1 px-0.5">
      <span className="text-[11px] text-muted-foreground">
        {range ? `Range: ${range[0]}–${range[1]}` : `Accepted range: ${entryBound![0]}–${entryBound![1]}`}
      </span>
      {outOfEntryBound ? (
        <span className="text-[11px] text-destructive font-medium flex items-center gap-0.5">
          <AlertTriangle className="h-3 w-3" /> Out of range
        </span>
      ) : outOfNormal ? (
        <span className="text-[11px] text-destructive font-medium flex items-center gap-0.5">
          <AlertTriangle className="h-3 w-3" /> Please verify
        </span>
      ) : null}
    </div>
  );
}

function unitAdornment(unit: string) {
  return <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{unit}</span>;
}


export function VitalSignsForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const { normalRanges, entryBounds } = useVitalsRangeConfig();
  const [meta, setMeta] = useState<MetaSections>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [locked, setLocked] = useState(false);
  const [hasVitals, setHasVitals] = useState(false);
  const [editWindowMinutes, setEditWindowMinutes] = useState(60);
  const [previous, setPrevious] = useState<Previous | null>(null);

  const [pulse, setPulse] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [spo2, setSpo2] = useState("");
  const [temperatureValue, setTemperatureValue] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState("°F");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [painNotes, setPainNotes] = useState("");
  const [primaryFocusArea, setPrimaryFocusArea] = useState("");
  const [triageRemarks, setTriageRemarks] = useState("");

  useEffect(() => {
    api.get<{ sections: MetaSections }>("/api/facility/metadata")
      .then((res) => setMeta(res.sections || {}))
      .catch(() => {});

    api.get<{ visit: VisitInfo; vitals: Vitals | null; previous: Previous | null; locked?: boolean; editWindowMinutes?: number }>(`/api/facility/visits/${visitId}/vitals`)
      .then((res) => {
        setVisit(res.visit);
        setPrevious(res.previous);
        setLocked(!!res.locked);
        setHasVitals(!!res.vitals);
        setEditWindowMinutes(res.editWindowMinutes ?? 60);
        if (res.vitals) {
          setPulse(res.vitals.pulse?.toString() ?? "");
          setBpSystolic(res.vitals.bpSystolic?.toString() ?? "");
          setBpDiastolic(res.vitals.bpDiastolic?.toString() ?? "");
          setSpo2(res.vitals.spo2?.toString() ?? "");
          if (res.vitals.temperatureF != null) {
            setTemperatureValue(res.vitals.temperatureF.toString());
            setTemperatureUnit("°F");
          } else if (res.vitals.temperatureC != null) {
            setTemperatureValue(res.vitals.temperatureC.toString());
            setTemperatureUnit("°C");
          }
          setPainNotes(res.vitals.painNotes ?? "");
          setPrimaryFocusArea(res.vitals.primaryFocusArea ?? "");
          setTriageRemarks(res.vitals.triageRemarks ?? "");
        }
        // Height/weight don't change often — prefill from this visit's own saved
        // reading if it has one, otherwise fall back to the most recent prior
        // visit's reading, so the nurse only has to re-enter it when it's actually
        // changed. Every other field always starts blank for a fresh assessment.
        const lastHeight = res.vitals?.heightCm ?? res.previous?.heightCm;
        const lastWeight = res.vitals?.weightKg ?? res.previous?.weightKg;
        setHeightCm(lastHeight?.toString() ?? "");
        setWeightKg(lastWeight?.toString() ?? "");
      })
      .catch(() => toast.error("Could not load this visit"))
      .finally(() => setLoading(false));
  }, [visitId]);

  // Switching the unit converts the displayed number in place, so the same
  // physical reading stays correct whichever unit the thermometer gave.
  const onTempUnitChange = (unit: string) => {
    if (temperatureValue !== "") {
      const num = parseFloat(temperatureValue);
      if (!Number.isNaN(num)) {
        const converted = unit === "°C" ? ((num - 32) * 5) / 9 : (num * 9) / 5 + 32;
        setTemperatureValue(converted.toFixed(1));
      }
    }
    setTemperatureUnit(unit);
  };

  const touch = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); };

  const save = async () => {
    if (locked) return;
    const temp = temperatureValue === "" ? null : parseFloat(temperatureValue);
    const temperatureF = temp === null ? "" : (temperatureUnit === "°F" ? temp : (temp * 9) / 5 + 32).toFixed(1);
    const temperatureC = temp === null ? "" : (temperatureUnit === "°C" ? temp : ((temp - 32) * 5) / 9).toFixed(1);

    // Sanity bounds — catch an obvious typo (an extra digit, a decimal in the
    // wrong place) before it ever reaches the database, not a clinical
    // "normal" range (that's what RangeHint/the out-of-range badges are for).
    const FIELD_LABELS: Record<string, string> = {
      bpSystolic: "BP Systolic", bpDiastolic: "BP Diastolic", temperatureF: "Temperature",
      pulse: "Pulse", spo2: "SpO₂",
    };
    const entryValues: Record<string, number | null> = {
      bpSystolic: bpSystolic === "" ? null : parseFloat(bpSystolic),
      bpDiastolic: bpDiastolic === "" ? null : parseFloat(bpDiastolic),
      temperatureF: temperatureF === "" ? null : parseFloat(temperatureF),
      pulse: pulse === "" ? null : parseFloat(pulse),
      spo2: spo2 === "" ? null : parseFloat(spo2),
    };
    for (const [field, [min, max]] of Object.entries(entryBounds)) {
      const value = entryValues[field];
      if (value != null && (value < min || value > max)) {
        toast.error(`${FIELD_LABELS[field]} must be between ${min} and ${max}${field === "temperatureF" ? "°F" : ""} — please check the value`);
        return;
      }
    }

    setSaving(true);
    try {
      await api.post(`/api/facility/visits/${visitId}/vitals`, {
        pulse, bpSystolic, bpDiastolic, spo2,
        temperatureF, temperatureC,
        heightCm, weightKg,
        painNotes, primaryFocusArea, triageRemarks,
      });
      toast.success("Vitals saved");
      if (visit) router.push(`/facility/patients/${visit.patient.id}/record`);
    } catch (e: any) {
      toast.error(e.message || "Could not save vitals");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-12">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (!visit) {
    return <p className="text-muted-foreground text-sm">Visit not found.</p>;
  }

  const { patient } = visit;

  return (
    <div className="w-full">
      <button onClick={() => router.push("/facility/patients")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to Patients
      </button>

      <div className="mb-4">
        <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">Basic Assessment</h1>
      </div>

      <PatientStageTracker
        steps={PATIENT_JOURNEY_STEPS.map((s) => (s.key === "registration" ? { ...s, href: `/facility/patients/${patient.id}` } : s))}
        activeKey="vitals"
        completedKeys={hasVitals ? ["registration", "vitals"] : ["registration"]}
      />

      {/* Patient header — always visible, single line */}
      <Card className="p-3 mb-5 border-primary/30 bg-primary/5 flex flex-row items-center gap-3 overflow-x-auto">
        <div className={cn("h-9 w-9 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-semibold text-white shrink-0", avatarGradient(patient.avatarColor))}>
          {initials(patient.name)}
        </div>
        <p className="text-sm font-semibold whitespace-nowrap shrink-0">{patient.name}</p>
        {patient.patientCode && (
          <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-[10px] flex items-center gap-1 shrink-0">
            <IdCard className="h-3 w-3" /> {patient.patientCode}
          </Badge>
        )}
        <div className="h-5 w-px bg-border shrink-0" />
        <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {patient.gender || "—"} · {formatAge(patient.dob)} · {patient.bloodGroup || "Blood group —"} · {patient.phone || "—"}
        </p>
        <div className="flex-1 min-w-4" />
        <div className="h-5 w-px bg-border shrink-0" />
        <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{new Date(visit.visitDate).toLocaleDateString()}</p>
      </Card>

      {previous && (() => {
        const bpOut = isOutOfRange(normalRanges, "bpSystolic", previous.bpSystolic) || isOutOfRange(normalRanges, "bpDiastolic", previous.bpDiastolic);
        const tempOut = isOutOfRange(normalRanges, "temperatureF", previous.temperatureF);
        return (
          <Card className="p-3 mb-5 border-border/50 bg-card/60 flex flex-row items-center flex-wrap gap-x-5 gap-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 shrink-0">
              <History className="h-3 w-3" /> Previous Visit — {daysAgo(previous.visitDate)}
            </p>
            <p className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              {(previous.bpSystolic != null || previous.bpDiastolic != null) && <span className={cn(bpOut && "text-destructive font-semibold")}>BP: {previous.bpSystolic ?? "—"}/{previous.bpDiastolic ?? "—"} mmHg</span>}
              {previous.pulse != null && <span className={cn(isOutOfRange(normalRanges, "pulse", previous.pulse) && "text-destructive font-semibold")}>Pulse: {previous.pulse} bpm</span>}
              {previous.spo2 != null && <span className={cn(isOutOfRange(normalRanges, "spo2", previous.spo2) && "text-destructive font-semibold")}>SpO₂: {previous.spo2}%</span>}
              {previous.temperatureF != null && <span className={cn(tempOut && "text-destructive font-semibold")}>Temp: {previous.temperatureF}°F</span>}
            </p>
          </Card>
        );
      })()}

      {locked && (
        <Card className="p-4 mb-5 border-amber-400/30 bg-amber-400/5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">This assessment is locked</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              It was recorded more than {editWindowMinutes} minute{editWindowMinutes === 1 ? "" : "s"} ago and can no longer be edited (set by your clinic&apos;s admin). Start a new visit to record fresh vitals.
            </p>
          </div>
        </Card>
      )}

      <Card className="relative overflow-hidden p-6 sm:p-8 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl gap-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

        <fieldset disabled={locked} className="contents">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <FloatingField id="bpSystolic" label="BP Systolic (Dabao-e-Khoon)" type="number" inputMode="decimal" min={0} max={300} value={bpSystolic} onChange={(e) => touch(setBpSystolic)(e.target.value)} endAdornment={unitAdornment("mmHg")} />
            <RangeHint field="bpSystolic" value={bpSystolic} normalRanges={normalRanges} entryBounds={entryBounds} />
          </div>
          <div>
            <FloatingField id="bpDiastolic" label="BP Diastolic (Dabao-e-Khoon)" type="number" inputMode="decimal" min={0} max={200} value={bpDiastolic} onChange={(e) => touch(setBpDiastolic)(e.target.value)} endAdornment={unitAdornment("mmHg")} />
            <RangeHint field="bpDiastolic" value={bpDiastolic} normalRanges={normalRanges} entryBounds={entryBounds} />
          </div>
          <div>
            <FloatingField id="pulse" label="Pulse (Nabz)" type="number" inputMode="decimal" value={pulse} onChange={(e) => touch(setPulse)(e.target.value)} endAdornment={unitAdornment("bpm")} />
            <RangeHint field="pulse" value={pulse} normalRanges={normalRanges} entryBounds={entryBounds} />
          </div>

          <div>
            <FloatingField id="spo2" label="SpO₂ (Oxygen)" type="number" inputMode="decimal" value={spo2} onChange={(e) => touch(setSpo2)(e.target.value)} endAdornment={unitAdornment("%")} />
            <RangeHint field="spo2" value={spo2} normalRanges={normalRanges} entryBounds={entryBounds} />
          </div>
          <div>
            <FloatingSplitField
              label="Temperature (Hararat)"
              inputId="temperature"
              type="number"
              step="any"
              value={temperatureValue}
              onChange={(e) => touch(setTemperatureValue)(e.target.value)}
              selectPosition="right"
              selectWidthClassName="w-16"
              selectValue={temperatureUnit}
              onSelectChange={onTempUnitChange}
              selectOptions={["°F", "°C"]}
            />
            {(() => {
              const [lo, hi] = temperatureUnit === "°F"
                ? entryBounds.temperatureF
                : toCelsiusRange(entryBounds.temperatureF);
              const label = temperatureUnit === "°F" ? `${lo}–${hi}` : `${lo.toFixed(1)}–${hi.toFixed(1)}`;
              const num = parseFloat(temperatureValue);
              const outOfBounds = temperatureValue !== "" && !Number.isNaN(num) && (num < lo || num > hi);
              return (
                <div className="flex items-center justify-between mt-1 px-0.5">
                  <span className="text-[11px] text-muted-foreground">Accepted range: {label}</span>
                  {outOfBounds && (
                    <span className="text-[11px] text-destructive font-medium flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" /> Out of range
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div>
            <FloatingField id="heightCm" label="Height (Qad)" type="number" inputMode="decimal" value={heightCm} onChange={(e) => touch(setHeightCm)(e.target.value)} endAdornment={unitAdornment("cm")} />
            {(() => {
              const h = parseFloat(heightCm);
              return !Number.isNaN(h) && h > 0 ? (
                <div className="mt-1 px-0.5">
                  <span className="text-[11px] text-muted-foreground">≈ {cmToFeetInches(h)}</span>
                </div>
              ) : null;
            })()}
          </div>
          <div>
            <FloatingField id="weightKg" label="Weight (Wazan)" type="number" inputMode="decimal" value={weightKg} onChange={(e) => touch(setWeightKg)(e.target.value)} endAdornment={unitAdornment("kg")} />
            {(() => {
              const bmi = calculateBmi(parseFloat(heightCm) || null, parseFloat(weightKg) || null);
              const band = bmiBand(bmi);
              return bmi != null && band ? (
                <div className="flex items-center justify-between mt-1 px-0.5">
                  <span className="text-[11px] text-muted-foreground">BMI: {bmi.toFixed(1)}</span>
                  <span className={cn("text-[11px] font-medium", band.tint)}>{band.label}</span>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button size="lg" onClick={save} disabled={saving || locked}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Vitals
          </Button>
        </div>
        </fieldset>
      </Card>
    </div>
  );
}
