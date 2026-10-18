"use client";

import { useState, type ReactNode } from "react";
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
  CalendarClock, Stethoscope, ChevronDown, Pill, Leaf, NotebookText, Droplet, MessageCircle, Accessibility,
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
const ONSET: Record<string, string> = { "<24h": "Onset under 24 hours", "1-7d": "Onset 1–7 days ago", ">1m": "Long-term · 1 month +" };

/** Small copy button with an in-place "Copied" confirmation. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <><Check className="h-3 w-3 text-emerald-500" /><span className="text-[10px] text-emerald-600 dark:text-emerald-400">Copied</span></> : <Copy className="h-3 w-3" />}
    </button>
  );
}

/** One labelled fact in the details grid. */
function Fact({ icon: Icon, label, children, className }: { icon: typeof Phone; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 min-w-0", className)}>
      <span className="h-8 w-8 rounded-lg bg-muted/60 text-muted-foreground flex items-center justify-center shrink-0"><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground leading-snug">{children}</div>
      </div>
    </div>
  );
}

/**
 * The patient's "signature" header shared by the clinical stages: identity
 * with quick contact actions, the facts staff look up most (contact,
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
  const avatar = <EntityAvatar name={patient.name} photo={patient.photo} avatarColor={patient.avatarColor} size="lg" className="h-16 w-16 text-lg" />;

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
    { label: "Chronic conditions", value: patient.chronicConditions },
    { label: "Medical history", value: patient.medicalHistory },
    { label: "Surgical history", value: patient.surgicalHistory },
    { label: "Family history", value: patient.familyHistory },
    { label: "Lifestyle", value: patient.lifestyle },
    { label: "Occupation", value: patient.occupation },
  ].filter((b) => b.value && b.value.trim());
  const hasMore = background.length > 0 || medicines.length > 0 || !!patient.currentMedications || !!patient.email || !!patient.address;

  return (
    <Card className="p-4 sm:p-5 mb-6 border-border/50 bg-gradient-to-br from-card to-card/60 gap-4">
      {/* Identity + quick actions */}
      <div className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
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
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/15 text-amber-700 dark:text-amber-400 border border-amber-400/30 font-mono text-[11px] pl-1.5 pr-1 py-0.5">
                  <IdCard className="h-3 w-3" /> {patient.patientCode}
                  <CopyButton value={patient.patientCode} label="patient code" />
                </span>
              )}
              <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border/50 text-[11px] font-medium">
                {visitCount <= 1 ? "First visit" : `Returning · ${visitCount} visits`}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
              <span>{patient.gender || "Gender not recorded"}</span>
              <span className="text-border">·</span>
              <span>{age === "—" ? "Age not recorded" : `${patient.dobApprox ? "~" : ""}${age}`}</span>
              {patient.maritalStatus && <><span className="text-border">·</span><span>{patient.maritalStatus}</span></>}
              {patient.bloodGroup && <><span className="text-border">·</span><span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium"><Droplet className="h-3 w-3" />{patient.bloodGroup}</span></>}
              {patient.mizaj && <><span className="text-border">·</span><span className="font-medium text-foreground/80">Mizaj: {patient.mizaj}</span></>}
            </p>
          </div>
        </div>

        {patient.phone && (
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={`tel:${patient.phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </a>
            <a
              href={`https://wa.me/91${patient.phone.replace(/\D/g, "").slice(-10)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 text-sm font-medium hover:border-emerald-500/50 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>
        )}
      </div>

      {/* Safety alerts — always first in line of sight */}
      {(allergies.length > 0 || lastReferralAt || lastAmaAt || wheelchair) && (
        <div className="flex items-center gap-2 flex-wrap">
          {allergies.length > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Allergic to: {allergies.join(", ")}
            </span>
          )}
          {lastReferralAt && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Referred out {daysAgo(lastReferralAt)}
            </span>
          )}
          {lastAmaAt && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <ShieldQuestion className="h-3.5 w-3.5 shrink-0" /> Declined referral {daysAgo(lastAmaAt)}
            </span>
          )}
          {wheelchair && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <Accessibility className="h-3.5 w-3.5 shrink-0" /> Needs a wheelchair
            </span>
          )}
        </div>
      )}

      {/* Key facts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-5 gap-y-3 rounded-xl border border-border/50 bg-background/40 p-3.5">
        <Fact icon={Phone} label="Mobile">
          {patient.phone ? <span className="inline-flex items-center gap-1">{patient.phone}<CopyButton value={patient.phone} label="mobile number" /></span> : <span className="text-muted-foreground font-normal">Not recorded</span>}
        </Fact>
        <Fact icon={Contact} label="Emergency contact">
          {patient.emergencyContact || patient.emergencyContactName ? (
            <span>
              {patient.emergencyContactName || "Contact"}
              {patient.emergencyRelationship && <span className="text-muted-foreground font-normal"> ({patient.emergencyRelationship})</span>}
              {patient.emergencyContact && (
                <a href={`tel:${patient.emergencyContact}`} className="block text-primary hover:underline font-normal">{patient.emergencyContact}</a>
              )}
            </span>
          ) : <span className="text-muted-foreground font-normal">Not recorded</span>}
        </Fact>
        <Fact icon={MapPin} label="Lives in">
          {place || patient.address ? <span className="line-clamp-2">{place || patient.address}</span> : <span className="text-muted-foreground font-normal">Not recorded</span>}
        </Fact>
        <Fact icon={CalendarClock} label={latest ? "This visit" : "Visits"}>
          {latest ? (
            <span>
              {daysAgo(latest.visitDate)}
              {latest.visitCode && <span className="text-muted-foreground font-normal font-mono text-xs"> · {latest.visitCode}</span>}
              <span className="block text-muted-foreground font-normal text-xs">{latest.doctor?.name ? `With ${latest.doctor.name}` : "Any available doctor"}</span>
            </span>
          ) : <span className="text-muted-foreground font-normal">No visit yet</span>}
        </Fact>
      </div>

      {/* Today's reason for visit */}
      {(complaints.length > 0 || intake?.onsetTimeline) && (
        <div className="flex items-start gap-2.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1 flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" /> Came in for</span>
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {complaints.map((c) => (
              <span key={c} className="rounded-full bg-primary/10 border border-primary/25 text-primary px-2.5 py-0.5 text-xs font-medium">{c}</span>
            ))}
            {intake?.onsetTimeline && ONSET[intake.onsetTimeline] && (
              <span className="rounded-full bg-muted/60 text-muted-foreground px-2.5 py-0.5 text-xs">{ONSET[intake.onsetTimeline]}</span>
            )}
          </div>
        </div>
      )}

      {/* More details drawer */}
      {hasMore && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
            {expanded ? "Fewer details" : "More details"}
          </button>
          {expanded && (
            <div className="mt-3 grid sm:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {patient.address && <Fact icon={MapPin} label="Full address">{patient.address}{place && <span className="block text-muted-foreground font-normal text-xs">{place}</span>}</Fact>}
              {patient.email && <Fact icon={Mail} label="Email"><a href={`mailto:${patient.email}`} className="text-primary hover:underline break-all">{patient.email}</a></Fact>}
              {(medicines.length > 0 || patient.currentMedications) && (
                <Fact icon={Pill} label="Current medicines & herbs" className="sm:col-span-2 xl:col-span-1">
                  {medicines.length > 0 ? (
                    <span className="flex flex-wrap gap-1 mt-0.5">
                      {medicines.map((m) => (
                        <span key={`${m.kind}:${m.label}`} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-normal",
                          m.kind === "medication" ? "bg-primary/10 border-primary/25 text-primary" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400")}>
                          {m.kind === "medication" ? <Pill className="h-3 w-3" /> : <Leaf className="h-3 w-3" />}{m.label}
                        </span>
                      ))}
                    </span>
                  ) : patient.currentMedications}
                </Fact>
              )}
              {background.map((b) => (
                <Fact key={b.label} icon={NotebookText} label={b.label}><span className="font-normal">{b.value}</span></Fact>
              ))}
            </div>
          )}
        </div>
      )}

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
