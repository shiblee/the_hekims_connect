"use client";

import { useState, type ReactNode } from "react";
import { useDateLocale, useListFormat, useValueLabel } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
import { formatAge, daysAgo } from "@/lib/age";
import { calculateBmi, bmiBand } from "@/lib/bmi";
import { isOutOfRange } from "@/lib/vitals-ranges";
import { useVitalsRangeConfig } from "@/lib/use-vitals-ranges";
import { findLatestWithField, type VisitVitals, type VisitWithVitals } from "@/lib/vitals-trend";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/shared/entity-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera, IdCard, Phone, Mail, AlertTriangle, ShieldAlert, ShieldQuestion, Activity, Copy, Check, MapPin, Contact,
  CalendarClock, Stethoscope, ChevronDown, Pill, Leaf, NotebookText, Droplet, Accessibility,
} from "lucide-react";

export interface SignaturePatient {
  name: string; patientCode: string | null; gender: string | null; dob: string | null;
  email: string | null; phone: string | null; allergies: string | null;
  photo: string | null; avatarColor: string;
  // Optional extras — shown when the caller's patient object has them.
  dobApprox?: boolean; maritalStatus?: string | null; bloodGroup?: string | null; mizaj?: string | null;
  address?: string | null; city?: string | null; state?: string | null; occupation?: string | null;
  emergencyContact?: string | null; emergencyContactName?: string | null; emergencyRelationship?: string | null;
  chronicConditions?: string | null; currentMedications?: string | null; medicalHistory?: string | null;
  surgicalHistory?: string | null; familyHistory?: string | null; lifestyle?: string | null;
}

/** The bits of a visit the card reads (latest visit first). */
export interface SignatureVisit {
  visitCode?: string; visitDate: string;
  doctor?: { name: string } | null;
  intake?: { chiefComplaints?: string; allergies?: string; medications?: string; onsetTimeline?: string | null; mobility?: string | null } | null;
}

const parseList = <T,>(raw: string | null | undefined): T[] => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const ONSET: Record<string, string> = { "<24h": "onset_24h", "1-7d": "onset_7d", ">1m": "onset_1m" };

/** Small copy button with an in-place "Copied" confirmation. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("clinic.signature");
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
      aria-label={t("copy", { label })}
      title={t("copy", { label })}
      className="inline-flex items-center gap-1 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <><Check className="h-3 w-3 text-emerald-500" /><span className="text-[11px] text-emerald-600 dark:text-emerald-400">{t("copied")}</span></> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** One labelled fact: a small caption with an icon over the value. */
function Fact({ icon: Icon, label, children, className }: { icon: typeof Phone; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" />{label}</p>
      <div className="text-sm font-medium text-foreground leading-snug mt-0.5">{children}</div>
    </div>
  );
}

/**
 * The patient's "signature" header shared by the clinical stages: identity
 * with the facts staff look up most (contact,
 * emergency contact, address, blood group, today's visit), safety alerts
 * (allergies, referrals, wheelchair), today's reason for visit, and a
 * "More details" drawer for medical background. `children` renders inside
 * the card below all that (the stages show the recorded vitals there).
 */
export function PatientSignatureCard({
  patient, visitCount, lastReferralAt, lastAmaAt, onPhotoClick, visits, children,
}: {
  patient: SignaturePatient;
  visitCount: number;
  lastReferralAt?: string | null;
  lastAmaAt?: string | null;
  /** When set, the avatar becomes a "change photo" button. */
  onPhotoClick?: () => void;
  /** Visits, newest first — for today's visit, complaints, allergies and medicines. */
  visits?: SignatureVisit[];
  children?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("clinic.signature");
  const vl = useValueLabel();
  const list = useListFormat();
  const avatar = <EntityAvatar name={patient.name} photo={patient.photo} avatarColor={patient.avatarColor} size="md" className="h-12 w-12 text-sm" />;

  const latest = visits?.[0];
  const intake = latest?.intake;
  const complaints = parseList<string>(intake?.chiefComplaints);
  const medicines = parseList<{ label: string; kind: string }>(intake?.medications);
  // Allergies from the patient profile plus whatever was recorded at registration, de-duplicated.
  const allergies = Array.from(new Map(
    [...(patient.allergies ? patient.allergies.split(/[,;]\s*/) : []), ...parseList<string>(intake?.allergies)]
      .map((a) => a.trim()).filter(Boolean).map((a) => [a.toLowerCase(), a] as const),
  ).values());
  const wheelchair = intake?.mobility === "wheelchair";
  const age = formatAge(patient.dob);
  const place = [patient.city, patient.state].filter(Boolean).join(", ");

  const background = [
    { label: t("chronic"), value: patient.chronicConditions },
    { label: t("medical"), value: patient.medicalHistory },
    { label: t("surgical"), value: patient.surgicalHistory },
    { label: t("family"), value: patient.familyHistory },
    { label: t("lifestyle"), value: patient.lifestyle },
    { label: t("occupation"), value: patient.occupation },
  ].filter((b) => b.value && b.value.trim());
  const hasMore = background.length > 0 || medicines.length > 0 || !!patient.currentMedications || !!patient.email || !!patient.address;

  const notRecorded = <span className="text-muted-foreground font-normal">{t("not_recorded")}</span>;
  const hasRow2 = allergies.length > 0 || !!lastReferralAt || !!lastAmaAt || wheelchair || complaints.length > 0 || !!intake?.onsetTimeline || hasMore;

  return (
    <Card className="px-4 py-3 mb-6 border-border/50 bg-gradient-to-br from-card to-card/60 gap-0">
      {/* Row 1 — identity, then the facts staff look up most, side by side */}
      <div className="flex items-center gap-x-6 gap-y-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {onPhotoClick ? (
            <button type="button" onClick={onPhotoClick} className="group relative h-12 w-12 rounded-full shrink-0" aria-label={t("change_photo")}>
              {avatar}
              <span className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
              <span className="absolute -bottom-0.5 -end-0.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center ring-2 ring-card">
                <Camera className="h-2 w-2 text-primary-foreground" />
              </span>
            </button>
          ) : (
            <div className="h-12 w-12 shrink-0">{avatar}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-serif text-lg sm:text-xl font-bold tracking-tight leading-tight">{patient.name}</h1>
              {patient.patientCode && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 text-amber-700 dark:text-amber-400 border border-amber-400/30 font-mono text-xs ps-1.5 pe-1 py-0.5">
                  <IdCard className="h-3 w-3" /> {patient.patientCode}
                  <CopyButton value={patient.patientCode} label={t("patient_code")} />
                </span>
              )}
              <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border/50 text-xs font-medium">
                {visitCount <= 1 ? t("first_visit") : t("returning", { count: visitCount })}
              </Badge>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{patient.gender ? vl(patient.gender) : t("gender_none")}</span>
              <span className="text-border">·</span>
              <span>{age === "—" ? t("age_none") : `${patient.dobApprox ? "~" : ""}${age}`}</span>
              {patient.maritalStatus && <><span className="text-border">·</span><span>{vl(patient.maritalStatus)}</span></>}
              {patient.bloodGroup && <><span className="text-border">·</span><span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 font-medium"><Droplet className="h-3 w-3" />{patient.bloodGroup}</span></>}
              {patient.mizaj && <><span className="text-border">·</span><span className="font-medium text-foreground/80">{t("mizaj", { value: patient.mizaj })}</span></>}
            </p>
          </div>
        </div>

        <div className="hidden lg:block h-9 w-px bg-border/70" aria-hidden />

        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap flex-1 min-w-0">
          <Fact icon={Phone} label={t("mobile")}>
            {patient.phone ? <span className="inline-flex items-center gap-1">{patient.phone}<CopyButton value={patient.phone} label={t("mobile_number")} /></span> : notRecorded}
          </Fact>
          <Fact icon={Contact} label={t("emergency")}>
            {patient.emergencyContact || patient.emergencyContactName ? (
              <span className="whitespace-nowrap">
                {patient.emergencyContactName || t("contact")}
                {patient.emergencyRelationship && <span className="text-muted-foreground font-normal"> ({vl(patient.emergencyRelationship)})</span>}
                {patient.emergencyContact && <span className="text-muted-foreground font-normal"> · {patient.emergencyContact}</span>}
              </span>
            ) : notRecorded}
          </Fact>
          <Fact icon={MapPin} label={t("lives_in")}>
            {place || patient.address ? <span className="truncate block max-w-56">{place || patient.address}</span> : notRecorded}
          </Fact>
          <Fact icon={CalendarClock} label={t("this_visit")}>
            {latest ? (
              <span className="whitespace-nowrap">
                {daysAgo(latest.visitDate)}
                {latest.visitCode && <span className="text-muted-foreground font-normal font-mono text-[13px]"> · {latest.visitCode}</span>}
                <span className="text-muted-foreground font-normal"> · {latest.doctor?.name ? latest.doctor.name : t("any_doctor")}</span>
              </span>
            ) : <span className="text-muted-foreground font-normal">{t("no_visit")}</span>}
          </Fact>
        </div>
      </div>

      {/* Row 2 — safety alerts, today's reason for visit, and the details toggle */}
      {hasRow2 && (
        <div className="mt-2.5 pt-2.5 border-t border-border/50 flex items-center gap-x-2 gap-y-1.5 flex-wrap">
          {allergies.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[13px] font-medium text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" /> {t("allergic", { items: list(allergies) })}
            </span>
          )}
          {lastReferralAt && (
            <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[13px] font-medium text-destructive">
              <ShieldAlert className="h-3 w-3 shrink-0" /> {t("referred_out", { when: daysAgo(lastReferralAt) })}
            </span>
          )}
          {lastAmaAt && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[13px] font-medium text-amber-700 dark:text-amber-400">
              <ShieldQuestion className="h-3 w-3 shrink-0" /> {t("declined", { when: daysAgo(lastAmaAt) })}
            </span>
          )}
          {wheelchair && (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[13px] font-medium text-amber-700 dark:text-amber-400">
              <Accessibility className="h-3 w-3 shrink-0" /> {t("wheelchair")}
            </span>
          )}
          {(complaints.length > 0 || intake?.onsetTimeline) && (
            <>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 ms-1"><Stethoscope className="h-3 w-3" /> {t("came_for")}</span>
              {complaints.map((c) => (
                <span key={c} className="rounded-full bg-primary/10 border border-primary/25 text-primary px-2 py-0.5 text-[13px] font-medium">{c}</span>
              ))}
              {intake?.onsetTimeline && ONSET[intake.onsetTimeline] && (
                <span className="rounded-full bg-muted/60 text-muted-foreground px-2 py-0.5 text-[13px]">{t(ONSET[intake.onsetTimeline])}</span>
              )}
            </>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="ms-auto inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline"
            >
              {expanded ? t("fewer") : t("more")}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      {/* More details — opens in place */}
      {expanded && hasMore && (
        <div className="mt-3 pt-3 border-t border-border/50 grid sm:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {patient.address && <Fact icon={MapPin} label={t("full_address")}><span className="font-normal">{patient.address}{place && `, ${place}`}</span></Fact>}
          {patient.email && <Fact icon={Mail} label={t("email")}><a href={`mailto:${patient.email}`} className="text-primary hover:underline break-all font-normal">{patient.email}</a></Fact>}
          {(medicines.length > 0 || patient.currentMedications) && (
            <Fact icon={Pill} label={t("medicines")} className="sm:col-span-2">
              {medicines.length > 0 ? (
                <span className="flex flex-wrap gap-1 mt-0.5">
                  {medicines.map((m) => (
                    <span key={`${m.kind}:${m.label}`} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-normal",
                      m.kind === "medication" ? "bg-primary/10 border-primary/25 text-primary" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400")}>
                      {m.kind === "medication" ? <Pill className="h-3 w-3" /> : <Leaf className="h-3 w-3" />}{m.label}
                    </span>
                  ))}
                </span>
              ) : <span className="font-normal">{patient.currentMedications}</span>}
            </Fact>
          )}
          {background.map((b) => (
            <Fact key={b.label} icon={NotebookText} label={b.label}><span className="font-normal">{b.value}</span></Fact>
          ))}
        </div>
      )}

      {children && <div className="mt-3">{children}</div>}
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
  const tv = useTranslations("clinic.vitals");
  const ts = useTranslations("clinic.vital_status");
  const dl = useDateLocale();
  const BAND: Record<string, string> = { Underweight: "underweight", Normal: "normal", Overweight: "overweight", Obese: "obese" };
  const heightCm = vitals?.heightCm ?? (findLatestWithField(visits, "heightCm") as number | null);
  const weightKg = vitals?.weightKg ?? (findLatestWithField(visits, "weightKg") as number | null);
  const bmi = calculateBmi(heightCm, weightKg);
  const band = bmiBand(bmi);
  const pulse = vitals?.pulse ?? vitals?.heartRate ?? null;

  const tiles: { label: string; value: string; unit: string; flagged: boolean; note?: string; noteClass?: string }[] = [
    {
      label: tv("bp"), unit: "mmHg",
      value: vitals?.bpSystolic != null || vitals?.bpDiastolic != null ? `${vitals?.bpSystolic ?? "—"}/${vitals?.bpDiastolic ?? "—"}` : "—",
      flagged: isOutOfRange(normalRanges, "bpSystolic", vitals?.bpSystolic ?? null) || isOutOfRange(normalRanges, "bpDiastolic", vitals?.bpDiastolic ?? null),
    },
    { label: tv("pulse_nabz"), unit: "bpm", value: pulse != null ? String(pulse) : "—", flagged: isOutOfRange(normalRanges, "pulse", pulse) },
    { label: "SpO₂", unit: "%", value: vitals?.spo2 != null ? String(vitals.spo2) : "—", flagged: isOutOfRange(normalRanges, "spo2", vitals?.spo2 ?? null) },
    {
      label: tv("temperature"), unit: "°F", value: vitals?.temperatureF != null ? String(vitals.temperatureF) : "—",
      flagged: isOutOfRange(normalRanges, "temperatureF", vitals?.temperatureF ?? null),
    },
    { label: tv("height_weight_short"), unit: "cm / kg", value: heightCm != null || weightKg != null ? `${heightCm ?? "—"} / ${weightKg ?? "—"}` : "—", flagged: false },
    { label: "BMI", unit: "kg/m²", value: bmi != null ? String(bmi) : "—", flagged: false, note: band ? ts(BAND[band.label] ?? "normal") : undefined, noteClass: band?.tint },
  ];

  return (
    <div className="border-t border-border/50 pt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> {tv("recorded")}
          {vitals?.updatedAt && <span className="normal-case tracking-normal font-normal">· {new Date(vitals.updatedAt).toLocaleString(dl)}</span>}
        </p>
        {action}
      </div>
      {!vitals ? (
        <p className="text-sm text-muted-foreground">{tv("none_this_visit")}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-lg border px-3 py-2", t.flagged ? "border-destructive/40 bg-destructive/5" : "border-border/50 bg-background/40")}>
              <p className="text-xs text-muted-foreground">{t.label}</p>
              <p className={cn("text-base font-semibold leading-tight", t.flagged && "text-destructive")}>
                {t.value} <span className="text-xs font-normal text-muted-foreground">{t.value !== "—" ? t.unit : ""}</span>
              </p>
              {t.flagged && <p className="text-[11px] text-destructive">{tv("outside_range")}</p>}
              {t.note && <p className={cn("text-[11px]", t.noteClass)}>{t.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
