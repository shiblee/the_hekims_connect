"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { FloatingField, FieldError } from "@/components/shared/floating-field";
import {
  Building2, MapPin, MapPinned, Clock, Stethoscope, Sparkles, LogOut, ChevronLeft,
  ChevronRight, CheckCircle2, Loader2, Hospital, HeartPulse, Hash, Calendar,
  Phone, Globe, Landmark, BedDouble, Users, Activity, Siren, Ambulance,
} from "lucide-react";

const DAYS: { value: number; label: string }[] = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];
const DEFAULT_OPEN_DAYS = [1, 2, 3, 4, 5, 6];

const STEPS = ["Facility", "Location", "Capacity", "Services", "Plan"];
const STEP_INTROS = [
  "Let's start with some basic information about your facility.",
  "This helps patients find you and powers facility mapping.",
  "Tell us your scale and when you're open for patients.",
  "What specialties and services does this facility provide?",
  "Your free plan is already on us — no action needed.",
];

const FACILITY_TYPE_ICONS: Record<string, any> = {
  Hospital, Clinic: Stethoscope, "Nursing Home": HeartPulse, "Health Centre": Building2,
};
function facilityTypeIcon(type: string) {
  return FACILITY_TYPE_ICONS[type] || Sparkles;
}

interface MetaSection { label: string; options: string[] }
interface Metadata {
  sections: Record<string, MetaSection>;
  subscription: { trialMonths: number; price: number; currency: string };
}

interface HourRow {
  open: string;
  close: string;
}

interface WizardForm {
  facilityName: string;
  facilityType: string;
  hfrNumber: string;
  establishmentDate: string;
  addressLine1: string;
  addressLine2: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  alternateContactNumber: string;
  bedCapacity: string;
  isOperational: boolean;
  dailyOpdCount: string;
  dailyAdmissions: string;
  operatingDays: number[];
  is24x7: boolean;
  hours: Record<number, HourRow>;
  specializations: string[];
  services: string[];
  emergencyServices: boolean;
  ambulanceAvailable: boolean;
}

function defaultHours(): Record<number, HourRow> {
  const hours: Record<number, HourRow> = {};
  for (const d of DAYS) hours[d.value] = { open: "09:00", close: "17:00" };
  return hours;
}

function StepHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="font-serif text-xl font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm border transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-background/60 border-border/60 text-muted-foreground hover:border-primary/50"
      )}
    >
      {children}
    </motion.button>
  );
}

function ToggleRow({ icon: Icon, title, subtitle, checked, onCheckedChange }: { icon: any; title: string; subtitle?: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className={cn(
      "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 transition-colors",
      checked ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/60"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function FacilityProfileSetup() {
  const facility = useAppStore((s) => s.facility);
  const setFacility = useAppStore((s) => s.setFacility);
  const setView = useAppStore((s) => s.setView);
  const logout = useAppStore((s) => s.logout);

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  useEffect(() => {
    api.get<Metadata>("/api/facility/metadata")
      .then(setMeta)
      .catch(() => setError("Could not load facility options. Please refresh the page."))
      .finally(() => setMetaLoading(false));
  }, []);

  const [form, setForm] = useState<WizardForm>(() => ({
    facilityName: facility?.facilityName || "",
    facilityType: "",
    hfrNumber: "",
    establishmentDate: "",
    addressLine1: "",
    addressLine2: "",
    locality: "",
    city: "",
    district: "",
    state: "",
    country: "India",
    pincode: "",
    alternateContactNumber: "",
    bedCapacity: "",
    isOperational: true,
    dailyOpdCount: "",
    dailyAdmissions: "",
    operatingDays: DEFAULT_OPEN_DAYS,
    is24x7: false,
    hours: defaultHours(),
    specializations: [],
    services: [],
    emergencyServices: false,
    ambulanceAvailable: false,
  }));

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const toggleInList = (key: "specializations" | "services" | "operatingDays", value: any) => {
    setForm((f) => {
      const list = f[key] as any[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...f, [key]: next };
    });
  };

  const planDates = useMemo(() => {
    const start = new Date();
    const end = new Date(start);
    end.setMonth(end.getMonth() + (meta?.subscription.trialMonths ?? 3));
    return { start, end };
  }, [meta?.subscription.trialMonths]);

  const facilityTypes = meta?.sections.facility_type?.options || [];
  const specializationOptions = meta?.sections.specialization?.options || [];
  const serviceGroups = useMemo(
    () => Object.entries(meta?.sections || {}).filter(([key]) => key.startsWith("service_")),
    [meta]
  );

  if (!facility) return null;

  const isHospital = form.facilityType === "Hospital";

  const stepErrors: Record<number, string | null> = {
    0: !form.facilityName ? "Facility Name is required" : !form.facilityType ? "Please select a Facility Type" : !form.hfrNumber ? "HFR Number is required" : null,
    1: !form.addressLine1 ? "Address is required" : !form.city ? "City is required" : !form.state ? "State is required" : !form.pincode ? "PIN Code is required" : null,
    2: isHospital && !form.bedCapacity ? "Bed Capacity is required for a Hospital" : !form.dailyOpdCount ? "Average Daily OPD is required" : null,
    3: form.specializations.length === 0 ? "Select at least one Specialization" : form.services.length === 0 ? "Select at least one Service" : null,
    4: null,
  };

  const goNext = () => {
    const err = stepErrors[step];
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, 5));
  };
  const goBack = () => { setError(null); setStep((s) => Math.max(s - 1, 0)); };

  const submit = async () => {
    for (let i = 0; i <= 3; i++) {
      if (stepErrors[i]) { setError(stepErrors[i]); setStep(i); return; }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ facility: any }>("/api/facility/profile/complete", {
        facilityName: form.facilityName,
        facilityType: form.facilityType,
        hfrNumber: form.hfrNumber,
        establishmentDate: form.establishmentDate || null,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        locality: form.locality,
        city: form.city,
        district: form.district,
        state: form.state,
        country: form.country,
        pincode: form.pincode,
        alternateContactNumber: form.alternateContactNumber,
        bedCapacity: isHospital ? form.bedCapacity : null,
        isOperational: form.isOperational,
        dailyOpdCount: form.dailyOpdCount,
        dailyAdmissions: form.dailyAdmissions,
        is24x7: form.is24x7,
        operatingHours: DAYS.map((d) => ({
          dayOfWeek: d.value,
          isOpen: form.operatingDays.includes(d.value),
          openingTime: form.hours[d.value]?.open,
          closingTime: form.hours[d.value]?.close,
        })),
        specializations: form.specializations,
        services: form.services,
        emergencyServices: form.emergencyServices,
        ambulanceAvailable: form.ambulanceAvailable,
      });
      setFacility(res.facility);
      setView("facility-dashboard");
      toast.success("Facility profile completed!");
    } catch (err: any) {
      setError(err.message || "Could not save your profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-primary/15 via-background to-accent/10">
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-accent/20 blur-[100px]" />
      <div className="pointer-events-none absolute inset-0 bg-background/30" />

      <div className="relative z-10 min-h-full flex flex-col">
        <header className="px-4 lg:px-0 py-5">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <BrandLogo size={32} />
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1.5" /> Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-0 py-6 flex items-start justify-center">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-7">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Complete Your Facility Profile</h1>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                Help us understand your facility. This information personalises your experience and the services available to you.
              </p>
            </div>

            {step < 5 && (
              <div className="flex items-center justify-center gap-1 mb-7 overflow-x-auto pb-1 px-2">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex items-center shrink-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <motion.div
                        animate={{ scale: i === step ? 1.1 : 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                          i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/30" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </motion.div>
                      <span className={cn("text-[11px] whitespace-nowrap", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="h-0.5 w-6 sm:w-10 mx-1 -mt-5 rounded-full bg-border overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={false}
                          animate={{ width: i < step ? "100%" : "0%" }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Card className="relative overflow-hidden p-6 sm:p-9 border-border/40 bg-card/95 backdrop-blur-sm shadow-2xl shadow-black/20 rounded-2xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
              {metaLoading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-16">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      {step === 0 && (
                        <div>
                          <StepHeader icon={Building2} title="About Your Facility" subtitle={STEP_INTROS[0]} />
                          <div className="space-y-5">
                            <FloatingField
                              id="facilityName"
                              label="Facility Name"
                              icon={Building2}
                              maxLength={150}
                              value={form.facilityName}
                              onChange={(e) => set("facilityName", e.target.value)}
                            />
                            <div>
                              <p className="text-sm font-medium mb-2">What type of facility is this?</p>
                              <div className="grid sm:grid-cols-3 gap-2">
                                {facilityTypes.map((t) => {
                                  const TypeIcon = facilityTypeIcon(t);
                                  const active = form.facilityType === t;
                                  return (
                                    <motion.button
                                      key={t}
                                      type="button"
                                      whileHover={{ y: -2 }}
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => set("facilityType", t)}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors",
                                        active ? "border-primary bg-primary/10 text-primary font-medium shadow-sm" : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/40"
                                      )}
                                    >
                                      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", active ? "bg-primary/20" : "bg-muted")}>
                                        <TypeIcon className="h-4 w-4" />
                                      </div>
                                      {t}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </div>
                            <FloatingField
                              id="hfrNumber"
                              label="HFR Number"
                              icon={Hash}
                              value={form.hfrNumber}
                              onChange={(e) => set("hfrNumber", e.target.value)}
                            />
                            <FloatingField
                              id="establishmentDate"
                              label="When was this facility established?"
                              icon={Calendar}
                              type="date"
                              value={form.establishmentDate}
                              onChange={(e) => set("establishmentDate", e.target.value)}
                            />
                          </div>
                        </div>
                      )}

                      {step === 1 && (
                        <div>
                          <StepHeader icon={MapPin} title="Where Are You Located?" subtitle={STEP_INTROS[1]} />
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <FloatingField id="addressLine1" label="Address Line 1" icon={MapPin} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
                              </div>
                              <div className="sm:col-span-2">
                                <FloatingField id="addressLine2" label="Address Line 2" icon={MapPin} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
                              </div>
                              <FloatingField id="locality" label="Locality" icon={MapPinned} value={form.locality} onChange={(e) => set("locality", e.target.value)} />
                              <FloatingField id="city" label="City" icon={Landmark} value={form.city} onChange={(e) => set("city", e.target.value)} />
                              <FloatingField id="district" label="District" icon={Landmark} value={form.district} onChange={(e) => set("district", e.target.value)} />
                              <FloatingField id="state" label="State" icon={Landmark} value={form.state} onChange={(e) => set("state", e.target.value)} />
                              <FloatingField id="country" label="Country" icon={Globe} value={form.country} onChange={(e) => set("country", e.target.value)} />
                              <FloatingField id="pincode" label="PIN Code" icon={Hash} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <FloatingField id="contactNumber" label="Facility Contact Number" icon={Phone} value={facility.phone || facility.email} disabled />
                              <FloatingField id="altContact" label="Alternate Contact Number" icon={Phone} value={form.alternateContactNumber} onChange={(e) => set("alternateContactNumber", e.target.value)} />
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 2 && (
                        <div>
                          <StepHeader icon={Clock} title="Capacity & Schedule" subtitle={STEP_INTROS[2]} />
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                              {isHospital && (
                                <FloatingField id="bedCapacity" label="Total Bed Capacity" icon={BedDouble} type="number" min={0} value={form.bedCapacity} onChange={(e) => set("bedCapacity", e.target.value)} />
                              )}
                              <FloatingField id="dailyOpd" label="Average Daily OPD Patients" icon={Users} type="number" min={0} value={form.dailyOpdCount} onChange={(e) => set("dailyOpdCount", e.target.value)} />
                              <FloatingField id="dailyAdmissions" label="Average Daily Admissions" icon={Activity} type="number" min={0} value={form.dailyAdmissions} onChange={(e) => set("dailyAdmissions", e.target.value)} />
                            </div>

                            <ToggleRow icon={CheckCircle2} title="Is the facility currently operational?" checked={form.isOperational} onCheckedChange={(v) => set("isOperational", v)} />
                            <ToggleRow icon={Clock} title="Operational 24×7?" subtitle="Turning this on skips individual day timings below." checked={form.is24x7} onCheckedChange={(v) => set("is24x7", v)} />

                            {!form.is24x7 && (
                              <div>
                                <p className="text-sm font-medium mb-2">Which days is the facility operational?</p>
                                <div className="flex flex-wrap gap-2">
                                  {DAYS.map((d) => (
                                    <ToggleChip key={d.value} active={form.operatingDays.includes(d.value)} onClick={() => toggleInList("operatingDays", d.value)}>
                                      {d.label.slice(0, 3)}
                                    </ToggleChip>
                                  ))}
                                </div>

                                <div className="mt-4 border border-border/60 rounded-xl overflow-hidden">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="border-b border-border/50 text-left text-muted-foreground bg-background/40">
                                        <th className="px-3 py-2 font-medium">Day</th>
                                        <th className="px-3 py-2 font-medium">Opening</th>
                                        <th className="px-3 py-2 font-medium">Closing</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {DAYS.map((d) => {
                                        const open = form.operatingDays.includes(d.value);
                                        return (
                                          <tr key={d.value} className="border-b border-border/30 last:border-0">
                                            <td className="px-3 py-2">{d.label}</td>
                                            <td className="px-3 py-2">
                                              <input
                                                type="time"
                                                disabled={!open}
                                                className="h-8 w-full rounded-md border border-input bg-background/60 px-2 text-sm disabled:opacity-40"
                                                value={form.hours[d.value]?.open || ""}
                                                onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.value]: { ...f.hours[d.value], open: e.target.value } } }))}
                                              />
                                            </td>
                                            <td className="px-3 py-2">
                                              <input
                                                type="time"
                                                disabled={!open}
                                                className="h-8 w-full rounded-md border border-input bg-background/60 px-2 text-sm disabled:opacity-40"
                                                value={form.hours[d.value]?.close || ""}
                                                onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.value]: { ...f.hours[d.value], close: e.target.value } } }))}
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => {
                                    const monday = form.hours[1];
                                    setForm((f) => {
                                      const hours = { ...f.hours };
                                      for (const d of DAYS) hours[d.value] = { ...monday };
                                      return { ...f, hours };
                                    });
                                  }}
                                >
                                  Copy Monday timing to all days
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {step === 3 && (
                        <div>
                          <StepHeader icon={Stethoscope} title="Services & Specialization" subtitle={STEP_INTROS[3]} />
                          <div className="space-y-6">
                            <div>
                              <p className="text-sm font-medium mb-2">Major medical specializations available</p>
                              <div className="flex flex-wrap gap-2">
                                {specializationOptions.map((s) => (
                                  <ToggleChip key={s} active={form.specializations.includes(s)} onClick={() => toggleInList("specializations", s)}>{s}</ToggleChip>
                                ))}
                              </div>
                            </div>

                            {serviceGroups.map(([key, group]) => (
                              <div key={key}>
                                <p className="text-sm font-medium mb-2">{group.label}</p>
                                <div className="grid sm:grid-cols-2 gap-2">
                                  {group.options.map((item) => {
                                    const checked = form.services.includes(item);
                                    return (
                                      <label key={item} className={cn(
                                        "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                                        checked ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background/60"
                                      )}>
                                        <Checkbox checked={checked} onCheckedChange={() => toggleInList("services", item)} />
                                        {item}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}

                            <ToggleRow icon={Siren} title="Does this facility provide emergency services?" checked={form.emergencyServices} onCheckedChange={(v) => set("emergencyServices", v)} />
                            <ToggleRow icon={Ambulance} title="Does the facility have an ambulance service?" checked={form.ambulanceAvailable} onCheckedChange={(v) => set("ambulanceAvailable", v)} />
                          </div>
                        </div>
                      )}

                      {step === 4 && (
                        <div>
                          <StepHeader icon={Sparkles} title="Your Service Plan" subtitle={STEP_INTROS[4]} />
                          <Card className="p-5 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/[0.02]">
                            <div className="flex items-center justify-between">
                              <div>
                                <Badge className="bg-primary/15 text-primary border-primary/30 mb-2">FREE — {meta?.subscription.trialMonths} Months</Badge>
                                <p className="text-sm text-muted-foreground">Get access to the basic facility services free for the first {meta?.subscription.trialMonths} months.</p>
                              </div>
                              <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                            </div>
                            <div className="mt-4 text-sm space-y-1">
                              <p><span className="text-muted-foreground">Activated:</span> {planDates.start.toLocaleDateString()}</p>
                              <p><span className="text-muted-foreground">Valid until:</span> {planDates.end.toLocaleDateString()}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-3">
                              Your free service period will automatically expire on the above date. You can renew or upgrade after expiry.
                            </p>
                          </Card>

                          <div className="mt-4">
                            <Card className="p-5 border-border/50 bg-card/60 opacity-60">
                              <p className="font-medium">Premium</p>
                              <p className="text-xs text-muted-foreground mt-1">{meta?.subscription.currency} {meta?.subscription.price} / month after your free period.</p>
                              <Button disabled size="sm" variant="outline" className="mt-3">Available after Free Period</Button>
                            </Card>
                          </div>
                        </div>
                      )}

                      {step === 5 && (
                        <div>
                          <StepHeader icon={CheckCircle2} title="Review Facility Profile" subtitle="Confirm everything looks right before you finish." />
                          <div className="space-y-5 text-sm">
                            <div>
                              <p className="font-medium mb-1.5">Facility Information</p>
                              <p className="text-muted-foreground">{form.facilityName} · {form.facilityType} · HFR {form.hfrNumber}{form.establishmentDate ? ` · Est. ${form.establishmentDate}` : ""}</p>
                            </div>
                            <div>
                              <p className="font-medium mb-1.5">Location</p>
                              <p className="text-muted-foreground">{[form.addressLine1, form.addressLine2, form.locality, form.city, form.district, form.state, form.pincode].filter(Boolean).join(", ")}</p>
                            </div>
                            <div>
                              <p className="font-medium mb-1.5">Capacity & Operations</p>
                              <p className="text-muted-foreground">
                                {isHospital && form.bedCapacity ? `${form.bedCapacity} beds · ` : ""}
                                {form.dailyOpdCount} daily OPD{form.dailyAdmissions ? ` · ${form.dailyAdmissions} daily admissions` : ""}
                                {" · "}{form.is24x7 ? "Open 24×7" : `Open ${form.operatingDays.length} day(s)/week`}
                              </p>
                            </div>
                            <div>
                              <p className="font-medium mb-1.5">Services</p>
                              <p className="text-muted-foreground">
                                {form.specializations.join(", ")}
                                <br />
                                {form.services.join(", ")}
                                {form.emergencyServices ? " · Emergency services" : ""}
                                {form.ambulanceAvailable ? " · Ambulance" : ""}
                              </p>
                            </div>
                            <div>
                              <p className="font-medium mb-1.5">Plan</p>
                              <p className="text-muted-foreground">FREE — {meta?.subscription.trialMonths} Months, valid until {planDates.end.toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  <FieldError message={error || undefined} />

                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/50">
                    <Button variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    {step < 5 ? (
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Button onClick={goNext} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          Continue <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Button onClick={submit} disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                          Complete Profile
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
