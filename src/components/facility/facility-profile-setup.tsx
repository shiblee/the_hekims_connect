"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";
import { useUrlParam } from "@/hooks/use-url-param";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { FloatingField, FieldError, FloatingMultiSelect } from "@/components/shared/floating-field";
import { FloatingCombobox } from "@/components/shared/combobox";
import {
  Building2, MapPin, MapPinned, Clock, Stethoscope, Sparkles, LogOut, ChevronLeft,
  ChevronRight, CheckCircle2, Loader2, Hospital, HeartPulse, Hash, Calendar,
  Phone, Globe, Landmark, BedDouble, Users, Siren, Ambulance, Gift, Lock,
  Microscope, Baby, Leaf, ListChecks,
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

// ABDM Health Facility Registry ID format: "IN" followed by 10 digits (e.g. IN0123456789).
const HFR_PATTERN = /^IN\d{10}$/i;

const STEPS = ["Facility", "Location", "Capacity", "Services", "Plan"];
/** Each step has its own address: /facility/profile-setup?step=location … (step 1 has none). */
const STEP_KEYS = ["facility", "location", "capacity", "services", "plan", "review"] as const;
type StepKey = (typeof STEP_KEYS)[number];

const FACILITY_TYPE_ICONS: Record<string, any> = {
  Hospital, Clinic: Stethoscope, "Nursing Home": HeartPulse, "Health Centre": Building2,
};
/** Shown as tiles; every other facility type is in the searchable "More facility types" field. */
const COMMON_TYPES = ["Clinic", "Hospital", "Nursing Home", "Health Centre"];

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
  open2: string;
  close2: string;
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
  dailyOpdCount: string;
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
  for (const d of DAYS) hours[d.value] = { open: "09:00", close: "17:00", open2: "", close2: "" };
  return hours;
}

function StepHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/20">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <h2 className="font-serif text-xl font-bold">{title}</h2>
        {subtitle && <p className="text-[15px] font-medium text-muted-foreground mt-0.5">{subtitle}</p>}
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
        "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
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
          <p className="text-[15px] font-semibold">{title}</p>
          {subtitle && <p className="text-xs font-medium text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface PickGroup { key: string; label: string; options: string[]; selected: string[]; toggle: (v: string) => void; setAll: (vals: string[], on: boolean) => void }
/** The question shown above each group's field (same style as the other steps' questions). */
const GROUP_QUESTION: Record<string, string> = {
  specialization: "Which medical specializations are available?",
  service_diagnostic: "Which diagnostic & examination services do you offer?",
  service_emergency: "Which emergency services do you offer?",
  service_maternal_child: "Which maternal & child health services do you offer?",
  service_other: "Which other Unani services do you offer?",
};
const GROUP_ICON: Record<string, typeof Stethoscope> = {
  specialization: Stethoscope, service_diagnostic: Microscope, service_emergency: Siren, service_maternal_child: Baby, service_other: Leaf,
};

/** One search-and-pick field per group (same field as allergies / chief complaints): type or click to see options, chosen ones show as chips. */
function GroupMultiSelect({ group, error }: { group: PickGroup; error: boolean }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const Icon = GROUP_ICON[group.key] ?? ListChecks;
  const results = group.options.filter((o) => !group.selected.includes(o) && (!q || o.toLowerCase().includes(q))).map((o) => ({ id: o, label: o }));
  const chosen = group.options.filter((o) => group.selected.includes(o));
  return (
    <FloatingMultiSelect
      id={`pick-${group.key}`}
      label={chosen.length ? `${chosen.length} selected` : "Search and select"}
      labelIcon={Icon}
      error={error}
      selected={chosen.map((o) => ({ id: o, label: o }))}
      onRemove={(id) => group.toggle(id)}
      query={query}
      onQueryChange={setQuery}
      results={results}
      onPick={(id) => { group.toggle(id); setQuery(""); }}
      openOnFocus
      emptyHint={results.length ? `${results.length} option${results.length === 1 ? "" : "s"} — type to narrow` : "All options chosen"}
      placeholder="Type to search…"
    />
  );
}

const DAY_SHORT: Record<number, string> = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
const time12 = (t: string) => { if (!t) return ""; const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
/** "Mon–Sat · 9:00 AM–5:00 PM", or the days alone when hours differ from day to day. */
function hoursSummary(f: WizardForm): string {
  if (f.is24x7) return "Open 24×7";
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => f.operatingDays.includes(d));
  if (!order.length) return "No opening days set";
  const runs: number[][] = [];
  for (const d of order) { const last = runs.at(-1); const prev = last?.at(-1); if (last && prev !== undefined && [1, 2, 3, 4, 5, 6, 0].indexOf(d) === [1, 2, 3, 4, 5, 6, 0].indexOf(prev) + 1) last.push(d); else runs.push([d]); }
  const days = runs.map((r) => (r.length > 2 ? `${DAY_SHORT[r[0]]}–${DAY_SHORT[r.at(-1)!]}` : r.map((d) => DAY_SHORT[d]).join(", "))).join(", ");
  const slots = order.map((d) => { const h = f.hours[d]; return h ? `${time12(h.open)}–${time12(h.close)}${h.open2 && h.close2 ? `, ${time12(h.open2)}–${time12(h.close2)}` : ""}` : ""; });
  return new Set(slots).size === 1 && slots[0] ? `${days} · ${slots[0]}` : days;
}

/** One summary card on the Review step, with a jump back to its step. */
function ReviewCard({ icon: Icon, title, onEdit, children }: { icon: typeof Building2; title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-input bg-background/60 p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-primary hover:underline">Edit</button>
      </div>
      <dl className="space-y-1.5 text-sm">{children}</dl>
    </section>
  );
}
function ReviewRow({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("grid gap-2", wide ? "grid-cols-[7.5rem_1fr]" : "grid-cols-[5.25rem_1fr]")}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value || <span className="font-normal text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function FacilityProfileSetup() {
  const router = useRouter();
  const facility = useAppStore((s) => s.facility);
  const setFacility = useAppStore((s) => s.setFacility);
  const logout = useAppStore((s) => s.logout);
  const onLogout = () => { logout(); router.push("/"); };

  // Answers are kept on this device if the page is refreshed or closed part-way.
  const draftKey = `hekim-profile-setup:${facility?.id ?? "anon"}`;
  const readDraft = (): { form?: Partial<WizardForm> } => {
    try { return JSON.parse(localStorage.getItem(draftKey) || "{}"); } catch { return {}; }
  };
  const [stepKey, setStepKey] = useUrlParam<StepKey>("step", "facility", STEP_KEYS);
  // HFR numbers are unique across facilities — check as soon as the number is complete.
  const [hfrTaken, setHfrTaken] = useState<{ hfr: string; taken: boolean } | null>(null);
  const requestedStep = STEP_KEYS.indexOf(stepKey);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
    dailyOpdCount: "",
    operatingDays: DEFAULT_OPEN_DAYS,
    is24x7: false,
    hours: defaultHours(),
    specializations: [],
    services: [],
    emergencyServices: false,
    ambulanceAvailable: false,
    ...readDraft().form,
  }));
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify({ form })); } catch { /* private mode — nothing kept */ }
  }, [draftKey, form]);
  useEffect(() => {
    const hfr = form.hfrNumber.trim().toUpperCase();
    if (!HFR_PATTERN.test(hfr)) return;
    let alive = true;
    const t = setTimeout(() => {
      api.get<{ valid: boolean; available: boolean }>(`/api/facility/profile/hfr-check?hfr=${encodeURIComponent(hfr)}`)
        .then((r) => { if (alive) setHfrTaken({ hfr, taken: r.valid && !r.available }); })
        .catch(() => {});
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [form.hfrNumber]);
  const hfrIsTaken = !!hfrTaken && hfrTaken.taken && hfrTaken.hfr === form.hfrNumber.trim().toUpperCase();

  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => (e[key as string] ? { ...e, [key]: "" } : e));
  };

  const toggleInList = (key: "specializations" | "services" | "operatingDays", value: any) => {
    setForm((f) => {
      const list = f[key] as any[];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...f, [key]: next };
    });
    setFieldErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
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

  // Any hospital-type facility (Hospital, Unani Hospital, Teaching Hospital…) must give its bed capacity.
  const isHospital = /hospital/i.test(form.facilityType);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const validateStep = (i: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (i === 0) {
      if (!form.facilityName) errs.facilityName = "Facility Name is required";
      if (!form.facilityType) errs.facilityType = "Please select a Facility Type";
      if (!form.hfrNumber) errs.hfrNumber = "HFR Number is required";
      else if (!HFR_PATTERN.test(form.hfrNumber)) errs.hfrNumber = "Should be IN followed by 10 digits (e.g. IN0123456789)";
      else if (hfrIsTaken) errs.hfrNumber = "This HFR Number is already registered to another facility";
      if (form.establishmentDate && form.establishmentDate > currentMonth) errs.establishmentDate = "Cannot be in the future";
    } else if (i === 1) {
      if (!form.addressLine1) errs.addressLine1 = "Address is required";
      if (!form.city) errs.city = "City is required";
      if (!form.state) errs.state = "State is required";
      if (!form.pincode) errs.pincode = "PIN Code is required";
    } else if (i === 2) {
      if (isHospital && !form.bedCapacity) errs.bedCapacity = "Required for a Hospital";
      if (!form.dailyOpdCount) errs.dailyOpdCount = "Average Daily OPD is required";
    } else if (i === 3) {
      if (form.specializations.length === 0) errs.specializations = "Select at least one Specialization";
      if (form.services.length === 0) errs.services = "Select at least one Service";
    }
    return errs;
  };

  // A later step's link opens the first unfinished step instead, so nothing is skipped.
  const firstUnfinished = [0, 1, 2, 3].find((i) => Object.keys(validateStep(i)).length > 0) ?? 5;
  const step = Math.min(requestedStep, firstUnfinished);
  useEffect(() => {
    if (step === requestedStep) return;
    const url = new URL(window.location.href);
    if (step === 0) url.searchParams.delete("step"); else url.searchParams.set("step", STEP_KEYS[step]);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event("url-param-change"));
  }, [step, requestedStep]);
  const setStep = (v: number | ((s: number) => number)) => setStepKey(STEP_KEYS[typeof v === "function" ? v(step) : v]);

  if (!facility) return null;

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setStep((s) => Math.min(s + 1, 5));
  };
  const goBack = () => { setFieldErrors({}); setStep((s) => Math.max(s - 1, 0)); };

  const submit = async () => {
    for (let i = 0; i <= 3; i++) {
      const errs = validateStep(i);
      if (Object.keys(errs).length) { setFieldErrors(errs); setStep(i); return; }
    }
    setFieldErrors({});
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
        bedCapacity: form.bedCapacity || null,
        dailyOpdCount: form.dailyOpdCount,
        is24x7: form.is24x7,
        operatingHours: DAYS.map((d) => ({
          dayOfWeek: d.value,
          isOpen: form.operatingDays.includes(d.value),
          openingTime: form.hours[d.value]?.open,
          closingTime: form.hours[d.value]?.close,
          openingTime2: form.hours[d.value]?.open2,
          closingTime2: form.hours[d.value]?.close2,
        })),
        specializations: form.specializations,
        services: form.services,
        emergencyServices: form.emergencyServices,
        ambulanceAvailable: form.ambulanceAvailable,
      });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      setFacility(res.facility);
      setFlash({ tone: "success", title: "Facility profile completed", detail: "Welcome aboard — your facility is ready. You can update these details any time under Profile." });
      router.push("/facility/dashboard");
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
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 mr-1.5" /> Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-0 py-6 flex items-start justify-center">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-7">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Complete Your Facility Profile</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">About 3 minutes · you can change any of this later in Facility Profile.</p>
            </div>

            {(
              <div className="flex items-center justify-center gap-1 mb-7 overflow-x-auto overflow-y-visible py-2 px-2">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex items-center shrink-0">
                    <button
                      type="button"
                      disabled={i >= step}
                      onClick={() => { setFieldErrors({}); setStep(i); }}
                      title={i < step ? `Back to ${label}` : undefined}
                      className="group flex flex-col items-center gap-1.5 disabled:cursor-default"
                    >
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
                      <span className={cn("text-[11px] whitespace-nowrap", i === step ? "font-semibold text-foreground" : i < step ? "text-primary group-hover:underline" : "text-muted-foreground")}>{label}</span>
                    </button>
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
                <div
                  onKeyDown={(e) => {
                    const t = e.target as HTMLElement;
                    if (e.key === "Enter" && step < 5 && t.tagName === "INPUT" && (t as HTMLInputElement).type !== "checkbox") { e.preventDefault(); goNext(); }
                  }}
                >
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
                          <StepHeader icon={Building2} title="About Your Facility" />
                          <div className="space-y-5">
                            <div>
                              <FloatingField
                                id="facilityName"
                                label="Facility Name"
                                icon={Building2}
                                maxLength={150}
                                error={!!fieldErrors.facilityName}
                                value={form.facilityName}
                                onChange={(e) => set("facilityName", e.target.value)}
                              />
                              <FieldError message={fieldErrors.facilityName} />
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold mb-2">What type of facility is this?</p>
                              <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl", fieldErrors.facilityType && "ring-2 ring-destructive/50 p-2 -mx-2 -mt-2 mb-1")}>
                                {facilityTypes.filter((t) => COMMON_TYPES.includes(t)).map((t) => {
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
                                      <span className="flex-1">{t}</span>
                                      {active && <CheckCircle2 className="h-4 w-4 shrink-0" />}
                                    </motion.button>
                                  );
                                })}
                              </div>
                              {facilityTypes.some((t) => !COMMON_TYPES.includes(t)) && (
                                <div className="mt-2">
                                  <FloatingCombobox
                                    id="moreFacilityTypes"
                                    label={COMMON_TYPES.includes(form.facilityType) || !form.facilityType ? "More facility types" : "Facility type"}
                                    value={COMMON_TYPES.includes(form.facilityType) ? "" : form.facilityType}
                                    onValueChange={(v) => set("facilityType", v)}
                                    options={facilityTypes.filter((t) => !COMMON_TYPES.includes(t))}
                                    placeholder="Search other types — e.g. Polyclinic, Wellness Centre"
                                  />
                                </div>
                              )}
                              <FieldError message={fieldErrors.facilityType} />
                            </div>
                            <div>
                              <FloatingField
                                id="hfrNumber"
                                label="HFR Number"
                                icon={Hash}
                                maxLength={12}
                                error={!!fieldErrors.hfrNumber}
                                value={form.hfrNumber}
                                onChange={(e) => set("hfrNumber", e.target.value.toUpperCase())}
                              />
                              {fieldErrors.hfrNumber ? (
                                <FieldError message={fieldErrors.hfrNumber} />
                              ) : hfrIsTaken ? (
                                <FieldError message="This HFR Number is already registered to another facility. Check the number, or contact support if it is yours." />
                              ) : HFR_PATTERN.test(form.hfrNumber) ? (
                                <p className="mt-1.5 ml-1 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Valid format</p>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                                  IN followed by 10 digits, e.g. IN0123456789 ·{" "}
                                  <a href="https://facility.abdm.gov.in/" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">What&apos;s this?</a>{" "}
                                  — your Health Facility Registry ID from ABDM
                                </p>
                              )}
                            </div>
                            <div>
                              <FloatingField
                                id="establishmentDate"
                                label="When was this facility established? (month & year)"
                                icon={Calendar}
                                type="month"
                                max={new Date().toISOString().slice(0, 7)}
                                error={!!fieldErrors.establishmentDate}
                                value={form.establishmentDate}
                                onChange={(e) => set("establishmentDate", e.target.value)}
                              />
                              <FieldError message={fieldErrors.establishmentDate} />
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 1 && (
                        <div>
                          <StepHeader icon={MapPin} title="Where Are You Located?" />
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <FloatingField id="addressLine1" label="Address Line 1" icon={MapPin} error={!!fieldErrors.addressLine1} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
                                <FieldError message={fieldErrors.addressLine1} />
                              </div>
                              <div className="sm:col-span-2">
                                <FloatingField id="addressLine2" label="Address Line 2" icon={MapPin} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
                              </div>
                              <FloatingField id="locality" label="Locality" icon={MapPinned} value={form.locality} onChange={(e) => set("locality", e.target.value)} />
                              <div>
                                <FloatingField id="city" label="City" icon={Landmark} error={!!fieldErrors.city} value={form.city} onChange={(e) => set("city", e.target.value)} />
                                <FieldError message={fieldErrors.city} />
                              </div>
                              <FloatingField id="district" label="District" icon={Landmark} value={form.district} onChange={(e) => set("district", e.target.value)} />
                              <div>
                                <FloatingField id="state" label="State" icon={Landmark} error={!!fieldErrors.state} value={form.state} onChange={(e) => set("state", e.target.value)} />
                                <FieldError message={fieldErrors.state} />
                              </div>
                              <FloatingField id="country" label="Country" icon={Globe} value={form.country} onChange={(e) => set("country", e.target.value)} />
                              <div>
                                <FloatingField id="pincode" label="PIN Code" icon={Hash} error={!!fieldErrors.pincode} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
                                <FieldError message={fieldErrors.pincode} />
                              </div>
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
                          <StepHeader icon={Clock} title="Capacity & Schedule" />
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <FloatingField id="bedCapacity" label="Total Bed Capacity" icon={BedDouble} type="number" min={0} error={!!fieldErrors.bedCapacity} value={form.bedCapacity} onChange={(e) => set("bedCapacity", e.target.value)} />
                                <FieldError message={fieldErrors.bedCapacity} />
                              </div>
                              <div>
                                <FloatingField id="dailyOpd" label="Average Daily OPD Patients" icon={Users} type="number" min={0} error={!!fieldErrors.dailyOpdCount} value={form.dailyOpdCount} onChange={(e) => set("dailyOpdCount", e.target.value)} />
                                <FieldError message={fieldErrors.dailyOpdCount} />
                              </div>
                            </div>

                            <ToggleRow icon={Clock} title="Operational 24×7?" checked={form.is24x7} onCheckedChange={(v) => set("is24x7", v)} />

                            {!form.is24x7 && (
                              <div>
                                <p className="text-[15px] font-semibold mb-2">Which days is the facility operational?</p>
                                <div className="flex flex-wrap gap-2">
                                  {DAYS.map((d) => (
                                    <ToggleChip key={d.value} active={form.operatingDays.includes(d.value)} onClick={() => toggleInList("operatingDays", d.value)}>
                                      {d.label.slice(0, 3)}
                                    </ToggleChip>
                                  ))}
                                </div>

                                <div className="mt-3 border border-border/60 rounded-xl overflow-hidden">
                                  <table className="w-full table-fixed text-sm">
                                    <thead>
                                      <tr className="border-b border-border/50 text-left text-muted-foreground bg-background/40">
                                        <th className="w-12 px-1.5 py-2 font-medium" rowSpan={2}>Day</th>
                                        <th className="px-1 py-2 font-medium text-center" colSpan={2}>Shift 1</th>
                                        <th className="px-1 py-2 font-medium text-center" colSpan={2}>Shift 2 (optional)</th>
                                      </tr>
                                      <tr className="border-b border-border/50 text-left text-muted-foreground bg-background/40">
                                        <th className="px-1 py-1.5 font-medium text-[11px]">Open</th>
                                        <th className="px-1 py-1.5 font-medium text-[11px]">Close</th>
                                        <th className="px-1 py-1.5 font-medium text-[11px]">Open</th>
                                        <th className="px-1 py-1.5 font-medium text-[11px]">Close</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {DAYS.map((d) => {
                                        const open = form.operatingDays.includes(d.value);
                                        return (
                                          <tr key={d.value} className="border-b border-border/30 last:border-0">
                                            <td className="px-1.5 py-2 whitespace-nowrap">{d.label.slice(0, 3)}</td>
                                            <td className="px-1 py-2">
                                              <input
                                                type="time"
                                                disabled={!open}
                                                className="h-8 w-full rounded-md border border-input bg-background/60 px-1 text-xs disabled:opacity-40"
                                                value={form.hours[d.value]?.open || ""}
                                                onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.value]: { ...f.hours[d.value], open: e.target.value } } }))}
                                              />
                                            </td>
                                            <td className="px-1 py-2">
                                              <input
                                                type="time"
                                                disabled={!open}
                                                className="h-8 w-full rounded-md border border-input bg-background/60 px-1 text-xs disabled:opacity-40"
                                                value={form.hours[d.value]?.close || ""}
                                                onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.value]: { ...f.hours[d.value], close: e.target.value } } }))}
                                              />
                                            </td>
                                            <td className="px-1 py-2">
                                              <input
                                                type="time"
                                                disabled={!open}
                                                className="h-8 w-full rounded-md border border-input bg-background/60 px-1 text-xs disabled:opacity-40"
                                                value={form.hours[d.value]?.open2 || ""}
                                                onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.value]: { ...f.hours[d.value], open2: e.target.value } } }))}
                                              />
                                            </td>
                                            <td className="px-1 py-2">
                                              <input
                                                type="time"
                                                disabled={!open}
                                                className="h-8 w-full rounded-md border border-input bg-background/60 px-1 text-xs disabled:opacity-40"
                                                value={form.hours[d.value]?.close2 || ""}
                                                onChange={(e) => setForm((f) => ({ ...f, hours: { ...f.hours, [d.value]: { ...f.hours[d.value], close2: e.target.value } } }))}
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
                          <StepHeader icon={Stethoscope} title="Services & Specialization" />
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              <b className="text-foreground">{form.specializations.length}</b> specialization{form.specializations.length === 1 ? "" : "s"} · <b className="text-foreground">{form.services.length}</b> service{form.services.length === 1 ? "" : "s"} selected
                            </p>
                            <div className="space-y-5">
                            {([
                                {
                                  key: "specialization", label: "Major medical specializations", options: specializationOptions, selected: form.specializations,
                                  toggle: (v) => toggleInList("specializations", v),
                                  setAll: (vals, on) => set("specializations", on ? [...new Set([...form.specializations, ...vals])] : form.specializations.filter((x) => !vals.includes(x))),
                                },
                                ...serviceGroups.map(([key, group]) => ({
                                  key, label: group.label, options: group.options, selected: form.services,
                                  toggle: (v: string) => toggleInList("services", v),
                                  setAll: (vals: string[], on: boolean) => set("services", on ? [...new Set([...form.services, ...vals])] : form.services.filter((x) => !vals.includes(x))),
                                })),
                              ] as PickGroup[]).map((g) => (
                                <div key={g.key}>
                                  <p className="text-[15px] font-semibold mb-3.5">{GROUP_QUESTION[g.key] ?? `Which ${g.label.toLowerCase()} do you offer?`}</p>
                                  <GroupMultiSelect group={g} error={g.key === "specialization" ? !!fieldErrors.specializations : !!fieldErrors.services && form.services.length === 0} />
                                </div>
                              ))}
                            </div>
                            <FieldError message={fieldErrors.specializations || fieldErrors.services} />
                            <div>
                            <p className="text-[15px] font-semibold mb-2">Do you provide emergency care or an ambulance?</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <ToggleRow icon={Siren} title="Emergency services" subtitle="Patients can come in an emergency" checked={form.emergencyServices} onCheckedChange={(v) => set("emergencyServices", v)} />
                              <ToggleRow icon={Ambulance} title="Ambulance" subtitle="The facility runs an ambulance" checked={form.ambulanceAvailable} onCheckedChange={(v) => set("ambulanceAvailable", v)} />
                            </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 4 && (() => {
                        const months = meta?.subscription.trialMonths ?? 3;
                        const cur = meta?.subscription.currency ?? "INR";
                        const money = (n: number) => (cur === "INR" ? `₹${n.toLocaleString("en-IN")}` : `${cur} ${n.toLocaleString()}`);
                        const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                        const included = ["Patient registration & reception desk", "Full Unani assessment — Mizaj to Tashkhees", "Prescriptions, payments & receipts", "Staff, permissions & activity log"];
                        return (
                          <div>
                            <StepHeader icon={Sparkles} title="Your Service Plan" />
                            <div className="grid gap-3 sm:grid-cols-[1.25fr_1fr]">
                              {/* Free trial — what the clinic gets now */}
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
                                className="relative flex flex-col rounded-2xl border-2 border-primary bg-primary/[0.06] p-5">
                                <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">Your plan now</span>
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Gift className="h-4 w-4" /> Free trial</div>
                                <p className="mt-2 flex items-baseline gap-1.5"><span className="text-3xl font-bold tabular-nums">{money(0)}</span><span className="text-sm text-muted-foreground">for {months} months</span></p>
                                {/* Trial timeline: today → end date */}
                                <div className="mt-4">
                                  <div className="relative h-1.5 rounded-full bg-primary/20">
                                    <span className="absolute left-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background" />
                                    <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
                                  </div>
                                  <div className="mt-1.5 flex justify-between text-xs">
                                    <span><b className="font-semibold">Today</b><span className="block text-muted-foreground">{fmt(planDates.start)}</span></span>
                                    <span className="text-right"><b className="font-semibold">Trial ends</b><span className="block text-muted-foreground">{fmt(planDates.end)}</span></span>
                                  </div>
                                </div>
                                <ul className="mt-4 space-y-1.5 text-sm">
                                  {included.map((f) => <li key={f} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}
                                </ul>
                              </motion.div>

                              {/* Premium — what follows */}
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.08 }}
                                className="flex flex-col rounded-2xl border border-input bg-card p-5">
                                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Sparkles className="h-4 w-4" /> Premium</div>
                                <p className="mt-2 flex items-baseline gap-1.5"><span className="text-3xl font-bold tabular-nums">{money(meta?.subscription.price ?? 0)}</span><span className="text-sm text-muted-foreground">/ month</span></p>
                                <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs">From <b className="font-semibold">{fmt(planDates.end)}</b>, after your trial</p>
                                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />Everything in the trial</li>
                                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />No interruption — your data stays as it is</li>
                                </ul>
                              </motion.div>
                            </div>
                            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> No payment details needed now. You can choose to continue when the trial ends.</p>
                          </div>
                        );
                      })()}

                      {step === 5 && (() => {
                        const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
                        const est = form.establishmentDate ? new Date(`${form.establishmentDate}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "";
                        const place = [form.locality, form.city, form.district !== form.city ? form.district : "", form.state].filter(Boolean).join(", ");
                        const chips = (list: string[], max = 8) => list.length === 0 ? null : (
                          <span className="flex flex-wrap gap-1">
                            {list.slice(0, max).map((x) => <span key={x} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{x}</span>)}
                            {list.length > max && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{list.length - max} more</span>}
                          </span>
                        );
                        const cur = meta?.subscription.currency ?? "INR";
                        const price = cur === "INR" ? `₹${(meta?.subscription.price ?? 0).toLocaleString("en-IN")}` : `${cur} ${meta?.subscription.price}`;
                        return (
                          <div>
                            <StepHeader icon={CheckCircle2} title="Review Facility Profile" />
                            {/* Identity banner — how the clinic will appear */}
                            <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
                              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary font-serif text-xl font-bold text-primary-foreground shadow-sm">
                                {form.facilityName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-serif text-xl font-bold">{form.facilityName}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">{form.facilityType}</span>
                                  {form.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{form.city}{form.state ? `, ${form.state}` : ""}</span>}
                                  <span className="font-mono text-xs">{form.hfrNumber}</span>
                                </p>
                              </div>
                              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> All 5 steps complete</span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <ReviewCard icon={Building2} title="Facility" onEdit={() => setStep(0)}>
                                <ReviewRow label="Name" value={form.facilityName} />
                                <ReviewRow label="Type" value={form.facilityType} />
                                <ReviewRow label="HFR number" value={<span className="font-mono">{form.hfrNumber}</span>} />
                                <ReviewRow label="Established" value={est} />
                              </ReviewCard>
                              <ReviewCard icon={MapPin} title="Location" onEdit={() => setStep(1)}>
                                <ReviewRow label="Address" value={[form.addressLine1, form.addressLine2].filter(Boolean).join(", ")} />
                                <ReviewRow label="Area" value={place} />
                                <ReviewRow label="PIN code" value={form.pincode} />
                                <ReviewRow label="Contact" value={[facility.phone || facility.email, form.alternateContactNumber].filter(Boolean).join(" · ")} />
                              </ReviewCard>
                              <ReviewCard icon={Clock} title="Capacity & hours" onEdit={() => setStep(2)}>
                                {(isHospital || form.bedCapacity) && <ReviewRow label="Beds" value={form.bedCapacity} />}
                                <ReviewRow label="Daily OPD" value={form.dailyOpdCount ? `${form.dailyOpdCount} patients` : ""} />
                                <ReviewRow label="Open" value={hoursSummary(form)} />
                              </ReviewCard>
                              <ReviewCard icon={Sparkles} title="Plan" onEdit={() => setStep(4)}>
                                <ReviewRow label="Now" value={`Free trial · ${meta?.subscription.trialMonths ?? 3} months`} />
                                <ReviewRow label="Trial ends" value={fmt(planDates.end)} />
                                <ReviewRow label="Then" value={`Premium · ${price} / month`} />
                              </ReviewCard>
                              <div className="sm:col-span-2">
                                <ReviewCard icon={Stethoscope} title="Services & specialization" onEdit={() => setStep(3)}>
                                  <ReviewRow wide label="Specializations" value={chips(form.specializations)} />
                                  <ReviewRow wide label="Services" value={chips(form.services, 12)} />
                                  <ReviewRow wide label="Emergency" value={form.emergencyServices ? "Yes" : "No"} />
                                  <ReviewRow wide label="Ambulance" value={form.ambulanceAvailable ? "Yes" : "No"} />
                                </ReviewCard>
                              </div>
                            </div>
                            <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
                              <p className="text-sm font-semibold">What happens when you complete</p>
                              <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-3">
                                <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Your free trial starts today</li>
                                <li className="flex items-start gap-2"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Your dashboard opens, ready for patients</li>
                                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{facility.email ? <>A confirmation goes to <b className="font-medium text-foreground">{facility.email}</b></> : "Everything stays editable in Facility Profile"}</li>
                              </ul>
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  </AnimatePresence>

                  <FieldError message={error || undefined} />

                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-input">
                    {step > 0 ? (
                      <Button variant="outline" size="lg" onClick={goBack} disabled={submitting}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                      </Button>
                    ) : <span />}
                    {step < 5 ? (
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                        <Button onClick={goNext} size="lg" className="h-12 px-8 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25">
                          {step === 4 ? "Review" : "Continue"} <ChevronRight className="h-5 w-5 ml-1" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                        <Button onClick={submit} disabled={submitting} size="lg" className="h-12 px-8 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25">
                          {submitting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-1.5" />}
                          Complete profile
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </main>

        <footer className="px-4 pb-6 pt-2 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} The Hekim&apos;s Connect. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
