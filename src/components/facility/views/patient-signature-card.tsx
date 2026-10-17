"use client";

import type { ReactNode } from "react";
import { formatAge, daysAgo } from "@/lib/age";
import { calculateBmi, bmiBand } from "@/lib/bmi";
import { isOutOfRange } from "@/lib/vitals-ranges";
import { useVitalsRangeConfig } from "@/lib/use-vitals-ranges";
import { findLatestWithField, type VisitVitals, type VisitWithVitals } from "@/lib/vitals-trend";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, IdCard, Phone, Mail, AlertTriangle, ShieldAlert, ShieldQuestion, Activity } from "lucide-react";

export interface SignaturePatient {
  name: string; patientCode: string | null; gender: string | null; dob: string | null;
  email: string | null; phone: string | null; allergies: string | null;
  photo: string | null; avatarColor: string;
}

/**
 * The patient's "signature" header shared by the clinical stages — photo,
 * name, ID, demographics and the safety badges (referral history, declined
 * referral, allergies, visit count). `children` renders inside the card,
 * below the identity row (Stage 3 shows the recorded vitals there).
 */
export function PatientSignatureCard({
  patient, visitCount, lastReferralAt, lastAmaAt, onPhotoClick, children,
}: {
  patient: SignaturePatient;
  visitCount: number;
  lastReferralAt?: string | null;
  lastAmaAt?: string | null;
  /** When set, the avatar becomes a "change photo" button. */
  onPhotoClick?: () => void;
  children?: ReactNode;
}) {
  const avatar = <EntityAvatar name={patient.name} photo={patient.photo} avatarColor={patient.avatarColor} size="lg" className="h-16 w-16 text-lg" />;

  return (
    <Card className="p-4 sm:p-5 mb-6 border-border/50 bg-gradient-to-br from-card to-card/60 gap-4">
      <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          {onPhotoClick ? (
            <button type="button" onClick={onPhotoClick} className="group relative h-16 w-16 rounded-full shrink-0" aria-label="Change patient photo">
              {avatar}
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-card">
                <Camera className="h-2.5 w-2.5 text-primary-foreground" />
              </span>
            </button>
          ) : (
            <div className="h-16 w-16 shrink-0">{avatar}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight">{patient.name}</h1>
              {patient.patientCode && (
                <Badge className="bg-amber-400/15 text-amber-600 dark:text-amber-400 border-amber-400/30 font-mono text-[10px] flex items-center gap-1">
                  <IdCard className="h-3 w-3" /> {patient.patientCode}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{patient.gender || "—"}</span>
              <span className="text-border">·</span>
              <span>{formatAge(patient.dob)}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{patient.email || "No email"}</span>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone || "No phone"}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {lastReferralAt && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs font-medium flex items-center gap-1.5 px-2.5 py-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Last referred {daysAgo(lastReferralAt)}
            </Badge>
          )}
          {lastAmaAt && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-medium flex items-center gap-1.5 px-2.5 py-1.5">
              <ShieldQuestion className="h-3.5 w-3.5 shrink-0" /> Declined referral {daysAgo(lastAmaAt)}
            </Badge>
          )}
          {patient.allergies && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs font-medium flex items-center gap-1.5 px-2.5 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Allergies: {patient.allergies}
            </Badge>
          )}
          <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border/50 text-xs font-medium px-2.5 py-1.5">
            {visitCount <= 1 ? "First Unani Visit" : `Returning Patient · ${visitCount} Visits`}
          </Badge>
        </div>
      </div>
      {children}
    </Card>
  );
}

/**
 * Read-only summary of the vitals recorded at Stage 2 (Acute Vitals &
 * Intake) for this visit. Out-of-range readings use the admin-configured
 * normal ranges, same as the Vitals panel. Height/weight fall back to the
 * most recent visit that recorded them, since they aren't taken every visit.
 */
export function RecordedVitalsStrip({ vitals, visits, action }: {
  vitals: VisitVitals | null;
  /** All visits, newest first — for the height/weight fallback. */
  visits: VisitWithVitals[];
  action?: ReactNode;
}) {
  const { normalRanges } = useVitalsRangeConfig();
  const heightCm = vitals?.heightCm ?? (findLatestWithField(visits, "heightCm") as number | null);
  const weightKg = vitals?.weightKg ?? (findLatestWithField(visits, "weightKg") as number | null);
  const bmi = calculateBmi(heightCm, weightKg);
  const band = bmiBand(bmi);
  const pulse = vitals?.pulse ?? vitals?.heartRate ?? null;

  const tiles: { label: string; value: string; unit: string; flagged: boolean; note?: string; noteClass?: string }[] = [
    {
      label: "Blood Pressure", unit: "mmHg",
      value: vitals?.bpSystolic != null || vitals?.bpDiastolic != null ? `${vitals?.bpSystolic ?? "—"}/${vitals?.bpDiastolic ?? "—"}` : "—",
      flagged: isOutOfRange(normalRanges, "bpSystolic", vitals?.bpSystolic ?? null) || isOutOfRange(normalRanges, "bpDiastolic", vitals?.bpDiastolic ?? null),
    },
    { label: "Pulse (Nabz)", unit: "bpm", value: pulse != null ? String(pulse) : "—", flagged: isOutOfRange(normalRanges, "pulse", pulse) },
    { label: "SpO₂", unit: "%", value: vitals?.spo2 != null ? String(vitals.spo2) : "—", flagged: isOutOfRange(normalRanges, "spo2", vitals?.spo2 ?? null) },
    {
      label: "Temperature", unit: "°F", value: vitals?.temperatureF != null ? String(vitals.temperatureF) : "—",
      flagged: isOutOfRange(normalRanges, "temperatureF", vitals?.temperatureF ?? null),
    },
    { label: "Height / Weight", unit: "cm / kg", value: heightCm != null || weightKg != null ? `${heightCm ?? "—"} / ${weightKg ?? "—"}` : "—", flagged: false },
    { label: "BMI", unit: "kg/m²", value: bmi != null ? String(bmi) : "—", flagged: false, note: band?.label, noteClass: band?.tint },
  ];

  return (
    <div className="border-t border-border/50 pt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Recorded Vitals
          {vitals?.updatedAt && <span className="normal-case tracking-normal font-normal">· {new Date(vitals.updatedAt).toLocaleString()}</span>}
        </p>
        {action}
      </div>
      {!vitals ? (
        <p className="text-sm text-muted-foreground">No vitals recorded for this visit yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-lg border px-3 py-2", t.flagged ? "border-destructive/40 bg-destructive/5" : "border-border/50 bg-background/40")}>
              <p className="text-[11px] text-muted-foreground">{t.label}</p>
              <p className={cn("text-base font-semibold leading-tight", t.flagged && "text-destructive")}>
                {t.value} <span className="text-[11px] font-normal text-muted-foreground">{t.value !== "—" ? t.unit : ""}</span>
              </p>
              {t.flagged && <p className="text-[10px] text-destructive">Outside normal range</p>}
              {t.note && <p className={cn("text-[10px]", t.noteClass)}>{t.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
