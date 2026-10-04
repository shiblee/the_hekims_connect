"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { avatarGradient, initials } from "@/lib/avatar";
import { formatAge, daysAgo } from "@/lib/age";
import { VITAL_RANGES, TEMP_RANGE_F, isOutOfRange } from "@/lib/vitals-ranges";
import { calculateBmi, bmiBand } from "@/lib/bmi";
import { cmToFeetInches } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SelectItem } from "@/components/ui/select";
import { FloatingField, FloatingSelect, FloatingSplitField } from "@/components/shared/floating-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, Loader2, Save, AlertTriangle, History, IdCard, Wallet, HelpCircle } from "lucide-react";

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
  spo2: number | null; spo2Context: string | null; oxygenLitres: number | null;
  temperatureF: number | null; temperatureC: number | null; respiratoryRate: number | null;
  consciousnessLevel: string | null; mood: string | null; heightCm: number | null; weightKg: number | null;
  waistCm: number | null; hipCm: number | null; wristCm: number | null; neckCm: number | null; updatedAt?: string;
}

interface Previous extends Vitals { visitCode: string; visitDate: string }

const RANGES = VITAL_RANGES;

const MOOD_STYLES: Record<string, { emoji: string; ring: string; bg: string }> = {
  "Very Good": { emoji: "😄", ring: "ring-emerald-500", bg: "bg-emerald-500/10" },
  "Good": { emoji: "🙂", ring: "ring-lime-500", bg: "bg-lime-500/10" },
  "Neutral": { emoji: "😐", ring: "ring-amber-400", bg: "bg-amber-400/10" },
  "Bad": { emoji: "🙁", ring: "ring-orange-500", bg: "bg-orange-500/10" },
  "Very Bad": { emoji: "😣", ring: "ring-destructive", bg: "bg-destructive/10" },
};

function RangeHint({ field, value }: { field: string; value: string }) {
  const range = RANGES[field];
  if (!range) return null;
  const num = parseFloat(value);
  const outOfRange = value !== "" && !Number.isNaN(num) && (num < range[0] || num > range[1]);
  return (
    <div className="flex items-center justify-between mt-1 px-0.5">
      <span className="text-[11px] text-muted-foreground">Range: {range[0]}–{range[1]}</span>
      {outOfRange && (
        <span className="text-[11px] text-destructive font-medium flex items-center gap-0.5">
          <AlertTriangle className="h-3 w-3" /> Please verify
        </span>
      )}
    </div>
  );
}

function unitAdornment(unit: string) {
  return <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">{unit}</span>;
}

function measurementAdornment(hint: string) {
  return (
    <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground">
      cm
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="pointer-events-auto hover:text-foreground transition-colors">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-center">{hint}</TooltipContent>
      </Tooltip>
    </span>
  );
}

const MEASURE_HINTS: Record<string, string> = {
  waist: "Measure around the narrowest part of the torso, at the level of the navel.",
  hip: "Measure around the widest part of the hips and buttocks.",
  wrist: "Measure around the wrist bone, where the tape sits naturally.",
  neck: "Measure around the base of the neck, just below the Adam's apple.",
};

export function VitalSignsForm({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [meta, setMeta] = useState<MetaSections>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visit, setVisit] = useState<VisitInfo | null>(null);
  const [previous, setPrevious] = useState<Previous | null>(null);

  const [pulse, setPulse] = useState("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [spo2, setSpo2] = useState("");
  const [temperatureValue, setTemperatureValue] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState("°F");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [consciousnessLevel, setConsciousnessLevel] = useState("Alert (A)");
  const [mood, setMood] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [wristCm, setWristCm] = useState("");
  const [neckCm, setNeckCm] = useState("");

  const [paymentMode, setPaymentMode] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentSaving, setPaymentSaving] = useState(false);

  useEffect(() => {
    api.get<{ sections: MetaSections }>("/api/facility/metadata")
      .then((res) => setMeta(res.sections || {}))
      .catch(() => {});

    api.get<{ visit: VisitInfo; vitals: Vitals | null; previous: Previous | null }>(`/api/facility/visits/${visitId}/vitals`)
      .then((res) => {
        setVisit(res.visit);
        setPrevious(res.previous);
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
          setRespiratoryRate(res.vitals.respiratoryRate?.toString() ?? "");
          setConsciousnessLevel(res.vitals.consciousnessLevel ?? "Alert (A)");
          setMood(res.vitals.mood ?? "");
        }
        // Height/weight don't change often — prefill from this visit's own saved
        // reading if it has one, otherwise fall back to the most recent prior
        // visit's reading, so the nurse only has to re-enter it when it's actually
        // changed. Every other field always starts blank for a fresh assessment.
        const lastHeight = res.vitals?.heightCm ?? res.previous?.heightCm;
        const lastWeight = res.vitals?.weightKg ?? res.previous?.weightKg;
        const lastWaist = res.vitals?.waistCm ?? res.previous?.waistCm;
        const lastHip = res.vitals?.hipCm ?? res.previous?.hipCm;
        const lastWrist = res.vitals?.wristCm ?? res.previous?.wristCm;
        const lastNeck = res.vitals?.neckCm ?? res.previous?.neckCm;
        setHeightCm(lastHeight?.toString() ?? "");
        setWeightKg(lastWeight?.toString() ?? "");
        setWaistCm(lastWaist?.toString() ?? "");
        setHipCm(lastHip?.toString() ?? "");
        setWristCm(lastWrist?.toString() ?? "");
        setNeckCm(lastNeck?.toString() ?? "");
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
    setSaving(true);
    try {
      const temp = temperatureValue === "" ? null : parseFloat(temperatureValue);
      const temperatureF = temp === null ? "" : (temperatureUnit === "°F" ? temp : (temp * 9) / 5 + 32).toFixed(1);
      const temperatureC = temp === null ? "" : (temperatureUnit === "°C" ? temp : ((temp - 32) * 5) / 9).toFixed(1);
      await api.post(`/api/facility/visits/${visitId}/vitals`, {
        pulse, bpSystolic, bpDiastolic, spo2,
        temperatureF, temperatureC, respiratoryRate, consciousnessLevel, mood,
        heightCm, weightKg, waistCm, hipCm, wristCm, neckCm,
      });
      toast.success("Vitals saved");
      if (visit) router.push(`/facility/patients/${visit.patient.id}`);
    } catch (e: any) {
      toast.error(e.message || "Could not save vitals");
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    if (!paymentAmount || !paymentMode) {
      toast.error("Enter an amount and payment mode");
      return;
    }
    setPaymentSaving(true);
    try {
      await api.post("/api/facility/payments", { visitId, amount: paymentAmount, mode: paymentMode, status: "paid" });
      toast.success("Payment recorded");
      setPaymentAmount(""); setPaymentMode("");
    } catch (e: any) {
      toast.error(e.message || "Could not record payment");
    } finally {
      setPaymentSaving(false);
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
        const bpOut = isOutOfRange("bpSystolic", previous.bpSystolic) || isOutOfRange("bpDiastolic", previous.bpDiastolic);
        const tempOut = previous.temperatureF != null && (previous.temperatureF < TEMP_RANGE_F[0] || previous.temperatureF > TEMP_RANGE_F[1]);
        return (
          <Card className="p-3 mb-5 border-border/50 bg-card/60 flex flex-row items-center flex-wrap gap-x-5 gap-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 shrink-0">
              <History className="h-3 w-3" /> Previous Visit — {daysAgo(previous.visitDate)}
            </p>
            <p className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              {previous.pulse != null && <span className={cn(isOutOfRange("pulse", previous.pulse) && "text-destructive font-semibold")}>Pulse: {previous.pulse} bpm</span>}
              {(previous.bpSystolic != null || previous.bpDiastolic != null) && <span className={cn(bpOut && "text-destructive font-semibold")}>BP: {previous.bpSystolic ?? "—"}/{previous.bpDiastolic ?? "—"} mmHg</span>}
              {previous.spo2 != null && <span className={cn(isOutOfRange("spo2", previous.spo2) && "text-destructive font-semibold")}>SpO₂: {previous.spo2}%</span>}
              {previous.temperatureF != null && <span className={cn(tempOut && "text-destructive font-semibold")}>Temp: {previous.temperatureF}°F</span>}
              {previous.respiratoryRate != null && <span className={cn(isOutOfRange("respiratoryRate", previous.respiratoryRate) && "text-destructive font-semibold")}>RR: {previous.respiratoryRate}/min</span>}
            </p>
          </Card>
        );
      })()}

      <Card className="relative overflow-hidden p-6 sm:p-8 border-border/40 bg-card/95 shadow-xl shadow-black/5 rounded-2xl space-y-6">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <FloatingField id="pulse" label="Pulse (Nabz)" type="number" inputMode="decimal" value={pulse} onChange={(e) => touch(setPulse)(e.target.value)} endAdornment={unitAdornment("bpm")} />
            <RangeHint field="pulse" value={pulse} />
          </div>
          <div>
            <FloatingField id="bpSystolic" label="BP Systolic (Dabao-e-Khoon)" type="number" inputMode="decimal" value={bpSystolic} onChange={(e) => touch(setBpSystolic)(e.target.value)} endAdornment={unitAdornment("mmHg")} />
            <RangeHint field="bpSystolic" value={bpSystolic} />
          </div>
          <div>
            <FloatingField id="bpDiastolic" label="BP Diastolic (Dabao-e-Khoon)" type="number" inputMode="decimal" value={bpDiastolic} onChange={(e) => touch(setBpDiastolic)(e.target.value)} endAdornment={unitAdornment("mmHg")} />
            <RangeHint field="bpDiastolic" value={bpDiastolic} />
          </div>

          <div>
            <FloatingField id="spo2" label="SpO₂ (Oxygen)" type="number" inputMode="decimal" value={spo2} onChange={(e) => touch(setSpo2)(e.target.value)} endAdornment={unitAdornment("%")} />
            <RangeHint field="spo2" value={spo2} />
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
            <div className="flex items-center justify-between mt-1 px-0.5">
              <span className="text-[11px] text-muted-foreground">Range: {temperatureUnit === "°F" ? "97–98.6" : "36–37"}</span>
              {temperatureValue !== "" && !Number.isNaN(parseFloat(temperatureValue)) && (
                (temperatureUnit === "°F"
                  ? (parseFloat(temperatureValue) < 97 || parseFloat(temperatureValue) > 98.6)
                  : (parseFloat(temperatureValue) < 36 || parseFloat(temperatureValue) > 37)
                ) && (
                  <span className="text-[11px] text-destructive font-medium flex items-center gap-0.5">
                    <AlertTriangle className="h-3 w-3" /> Please verify
                  </span>
                )
              )}
            </div>
          </div>
          <div>
            <FloatingField id="respiratoryRate" label="Respiratory Rate (Tanaffus)" type="number" inputMode="decimal" value={respiratoryRate} onChange={(e) => touch(setRespiratoryRate)(e.target.value)} endAdornment={unitAdornment("/min")} />
            <RangeHint field="respiratoryRate" value={respiratoryRate} />
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

          <div>
            <FloatingField id="waistCm" label="Waist (Kamar)" type="number" inputMode="decimal" value={waistCm} onChange={(e) => touch(setWaistCm)(e.target.value)} endAdornment={measurementAdornment(MEASURE_HINTS.waist)} />
          </div>
          <div>
            <FloatingField id="hipCm" label="Hip (Sareen)" type="number" inputMode="decimal" value={hipCm} onChange={(e) => touch(setHipCm)(e.target.value)} endAdornment={measurementAdornment(MEASURE_HINTS.hip)} />
          </div>
          <div>
            <FloatingField id="wristCm" label="Wrist (Kalai)" type="number" inputMode="decimal" value={wristCm} onChange={(e) => touch(setWristCm)(e.target.value)} endAdornment={measurementAdornment(MEASURE_HINTS.wrist)} />
          </div>
          <div>
            <FloatingField id="neckCm" label="Neck (Gardan)" type="number" inputMode="decimal" value={neckCm} onChange={(e) => touch(setNeckCm)(e.target.value)} endAdornment={measurementAdornment(MEASURE_HINTS.neck)} />
          </div>

          {meta.consciousness_level && (
            <FloatingSelect id="consciousnessLevel" label="Level of Consciousness (Hosh)" value={consciousnessLevel} onValueChange={touch(setConsciousnessLevel)} placeholder="Select">
              {meta.consciousness_level.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </FloatingSelect>
          )}
        </div>

        {meta.mood && (
          <div className="pt-4 mt-2 border-t border-border/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">How are you feeling today? (Kaifiyat)</p>
            <div className="flex items-center gap-3 flex-wrap">
              {meta.mood.options.map((o) => {
                const style = MOOD_STYLES[o];
                const selected = mood === o;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => touch(setMood)(o)}
                    title={o}
                    className={cn(
                      "h-12 w-12 rounded-full flex items-center justify-center text-2xl transition-all",
                      style?.bg || "bg-muted",
                      selected ? cn("ring-2 ring-offset-2 ring-offset-card scale-110", style?.ring || "ring-primary") : "opacity-70 hover:opacity-100"
                    )}
                  >
                    {style?.emoji || "🙂"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button size="lg" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Vitals
          </Button>
        </div>
      </Card>

      <Card className="p-4 mt-5 border-border/40 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
          <Wallet className="h-3.5 w-3.5" /> Record Payment
        </p>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <FloatingField id="paymentAmount" label="Amount (₹)" type="number" inputMode="decimal" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          {meta.payment_mode ? (
            <FloatingSelect id="paymentMode" label="Payment Mode" value={paymentMode} onValueChange={setPaymentMode} placeholder="Select">
              {meta.payment_mode.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </FloatingSelect>
          ) : (
            <FloatingField id="paymentMode" label="Payment Mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} />
          )}
          <Button onClick={savePayment} disabled={paymentSaving} className="h-11">
            {paymentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Payment
          </Button>
        </div>
      </Card>
    </div>
  );
}
