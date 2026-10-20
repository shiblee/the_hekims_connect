"use client";

import { useEffect, useMemo, useState } from "react";
import { LogoutConfirm } from "@/components/shared/logout-confirm";
import { useDateLocale } from "@/lib/i18n/use-date-locale";
import { useTranslations } from "next-intl";
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

const STEPS = ["facility", "location", "capacity", "services", "plan"];
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
const GROUP_ICON: Record<string, typeof Stethoscope> = {
  specialization: Stethoscope, service_diagnostic: Microscope, service_emergency: Siren, service_maternal_child: Baby, service_other: Leaf,
};

/** One search-and-pick field per group (same field as allergies / chief complaints): type or click to see options, chosen ones show as chips. */
function GroupMultiSelect({ group, error }: { group: PickGroup; error: boolean }) {
  const t = useTranslations("clinic.setup");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const Icon = GROUP_ICON[group.key] ?? ListChecks;
  const results = group.options.filter((o) => !group.selected.includes(o) && (!q || o.toLowerCase().includes(q))).map((o) => ({ id: o, label: o }));
  const chosen = group.options.filter((o) => group.selected.includes(o));
  return (
    <FloatingMultiSelect
      id={`pick-${group.key}`}
      label={chosen.length ? t("n_selected", { count: chosen.length }) : t("search_select")}
      labelIcon={Icon}
      error={error}
      selected={chosen.map((o) => ({ id: o, label: o }))}
      onRemove={(id) => group.toggle(id)}
      query={query}
      onQueryChange={setQuery}
      results={results}
      onPick={(id) => { group.toggle(id); setQuery(""); }}
      openOnFocus
      emptyHint={results.length ? t("n_options", { count: results.length }) : t("all_chosen")}
      placeholder={t("type_search")}
    />
  );
}

/** Weekday name in the viewer's language (7 Jan 2024 was a Sunday, so day d is 7 + d). */
const dayName = (d: number, locale: string, width: "short" | "long" = "short") => new Date(2024, 0, 7 + d).toLocaleDateString(locale, { weekday: width });
const time12 = (time: string, locale: string) => { if (!time) return ""; const [h, m] = time.split(":").map(Number); return new Date(2024, 0, 1, h, m).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" }); };
/** "Mon–Sat · 9:00 AM–5:00 PM", or the days alone when hours differ from day to day. */
function hoursSummary(f: WizardForm, t: (key: string) => string, locale: string): string {
  if (f.is24x7) return t("open_247");
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => f.operatingDays.includes(d));
  if (!order.length) return t("no_days");
  const DAY_SHORT = (d: number) => dayName(d, locale);
  const runs: number[][] = [];
  for (const d of order) { const last = runs.at(-1); const prev = last?.at(-1); if (last && prev !== undefined && [1, 2, 3, 4, 5, 6, 0].indexOf(d) === [1, 2, 3, 4, 5, 6, 0].indexOf(prev) + 1) last.push(d); else runs.push([d]); }
  const days = runs.map((r) => (r.length > 2 ? `${DAY_SHORT(r[0])}–${DAY_SHORT(r.at(-1)!)}` : r.map((d) => DAY_SHORT(d)).join(", "))).join(", ");
  const slots = order.map((d) => { const h = f.hours[d]; return h ? `${time12(h.open, locale)}–${time12(h.close, locale)}${h.open2 && h.close2 ? `, ${time12(h.open2, locale)}–${time12(h.close2, locale)}` : ""}` : ""; });
  return new Set(slots).size === 1 && slots[0] ? `${days} · ${slots[0]}` : days;
}

/** One section of the Review summary sheet: title on the left, Edit on the right, thin divider between sections. */
function ReviewSection({ icon: Icon, title, onEdit, children }: { icon: typeof Building2; title: string; onEdit: () => void; children: React.ReactNode }) {
  const t = useTranslations("clinic.setup");
  return (
    <section className="grid items-start gap-x-6 gap-y-2 border-t border-border py-4 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr_auto]">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      <dl className="min-w-0 space-y-1.5 text-sm">{children}</dl>
      <button type="button" onClick={onEdit} className="justify-self-start text-xs font-medium text-primary hover:underline sm:justify-self-end">{t("edit")}</button>
    </section>
  );
}
function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
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
  const [logoutOpen, setLogoutOpen] = useState(false);
  const onLogout = () => { logout(); router.push("/"); };
  const t = useTranslations("clinic.setup");
  const tp = useTranslations("clinic.profile");
  const tc = useTranslations("common");
  const dl = useDateLocale();
  const groupQuestion = (key: string, label: string) => (tp.has(`q_${key}`) ? tp(`q_${key}`) : tp("q_generic", { label: label.toLowerCase() }));

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
      .catch(() => setError(t("load_failed")))
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
      if (!form.facilityName) errs.facilityName = t("e_name");
      if (!form.facilityType) errs.facilityType = t("e_type");
      if (!form.hfrNumber) errs.hfrNumber = t("e_hfr");
      else if (!HFR_PATTERN.test(form.hfrNumber)) errs.hfrNumber = t("e_hfr_format");
      else if (hfrIsTaken) errs.hfrNumber = t("e_hfr_taken");
      if (form.establishmentDate && form.establishmentDate > currentMonth) errs.establishmentDate = t("e_future");
    } else if (i === 1) {
      if (!form.addressLine1) errs.addressLine1 = t("e_address");
      if (!form.city) errs.city = t("e_city");
      if (!form.state) errs.state = t("e_state");
      if (!form.pincode) errs.pincode = t("e_pin");
    } else if (i === 2) {
      if (isHospital && !form.bedCapacity) errs.bedCapacity = t("e_beds");
      if (!form.dailyOpdCount) errs.dailyOpdCount = t("e_opd");
    } else if (i === 3) {
      if (form.specializations.length === 0) errs.specializations = t("e_spec");
      if (form.services.length === 0) errs.services = t("e_service");
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
      setFlash({ tone: "success", title: t("done"), detail: t("done_hint") });
      router.push("/facility/dashboard");
    } catch (err: any) {
      setError(err.message || t("save_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-br from-primary/15 via-background to-accent/10">
      <div className="pointer-events-none absolute -top-32 -start-32 h-96 w-96 rounded-full bg-primary/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -end-24 h-96 w-96 rounded-full bg-accent/20 blur-[100px]" />
      <div className="pointer-events-none absolute inset-0 bg-background/30" />

      <div className="relative z-10 min-h-full flex flex-col">
        <header className="px-4 lg:px-0 py-5">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <BrandLogo size={32} />
            <Button variant="ghost" size="sm" onClick={() => setLogoutOpen(true)} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4 me-1.5" /> {t("logout")}
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 lg:px-0 py-6 flex items-start justify-center">
          <div className="w-full max-w-2xl">
            <div className="text-center mb-7">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">{t("title")}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{t("subtitle")}</p>
            </div>

            {(
              <div data-tour="setup.steps" className="flex items-center justify-center gap-1 mb-7 overflow-x-auto overflow-y-visible py-2 px-2">
                {STEPS.map((label, i) => (
                  <div key={label} className="flex items-center shrink-0">
                    <button
                      type="button"
                      disabled={i >= step}
                      onClick={() => { setFieldErrors({}); setStep(i); }}
                      title={i < step ? t("back_to", { label: t(`s_${label}`) }) : undefined}
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
                      <span className={cn("text-[11px] whitespace-nowrap", i === step ? "font-semibold text-foreground" : i < step ? "text-primary group-hover:underline" : "text-muted-foreground")}>{t(`s_${label}`)}</span>
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
              <div className="absolute top-0 start-0 end-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />
              {metaLoading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-16">
                  <Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}
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
                          <StepHeader icon={Building2} title={t("about")} />
                          <div className="space-y-5">
                            <div>
                              <FloatingField
                                id="facilityName"
                                label={t("name")}
                                icon={Building2}
                                maxLength={150}
                                error={!!fieldErrors.facilityName}
                                value={form.facilityName}
                                onChange={(e) => set("facilityName", e.target.value)}
                              />
                              <FieldError message={fieldErrors.facilityName} />
                            </div>
                            <div>
                              <p className="text-[15px] font-semibold mb-2">{t("type_q")}</p>
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
                                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-start transition-colors",
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
                                    label={COMMON_TYPES.includes(form.facilityType) || !form.facilityType ? t("more_types") : t("type")}
                                    value={COMMON_TYPES.includes(form.facilityType) ? "" : form.facilityType}
                                    onValueChange={(v) => set("facilityType", v)}
                                    options={facilityTypes.filter((t) => !COMMON_TYPES.includes(t))}
                                    placeholder={t("type_ph")}
                                  />
                                </div>
                              )}
                              <FieldError message={fieldErrors.facilityType} />
                            </div>
                            <div>
                              <FloatingField
                                id="hfrNumber"
                                label={t("hfr")}
                                icon={Hash}
                                maxLength={12}
                                error={!!fieldErrors.hfrNumber}
                                value={form.hfrNumber}
                                onChange={(e) => set("hfrNumber", e.target.value.toUpperCase())}
                              />
                              {fieldErrors.hfrNumber ? (
                                <FieldError message={fieldErrors.hfrNumber} />
                              ) : hfrIsTaken ? (
                                <FieldError message={t("hfr_taken_long")} />
                              ) : HFR_PATTERN.test(form.hfrNumber) ? (
                                <p className="mt-1.5 ms-1 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> {t("valid")}</p>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1.5 ms-1">
                                  {t.rich("hfr_hint", { link: (c) => <a href="https://facility.abdm.gov.in/" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{c}</a> })}
                                </p>
                              )}
                            </div>
                            <div>
                              <FloatingField
                                id="establishmentDate"
                                label={t("established")}
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
                          <StepHeader icon={MapPin} title={t("where")} />
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <FloatingField id="addressLine1" label={tp("address1")} icon={MapPin} error={!!fieldErrors.addressLine1} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} />
                                <FieldError message={fieldErrors.addressLine1} />
                              </div>
                              <div className="sm:col-span-2">
                                <FloatingField id="addressLine2" label={tp("address2")} icon={MapPin} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} />
                              </div>
                              <FloatingField id="locality" label={tp("locality")} icon={MapPinned} value={form.locality} onChange={(e) => set("locality", e.target.value)} />
                              <div>
                                <FloatingField id="city" label={tp("city")} icon={Landmark} error={!!fieldErrors.city} value={form.city} onChange={(e) => set("city", e.target.value)} />
                                <FieldError message={fieldErrors.city} />
                              </div>
                              <FloatingField id="district" label={tp("district")} icon={Landmark} value={form.district} onChange={(e) => set("district", e.target.value)} />
                              <div>
                                <FloatingField id="state" label={tp("state")} icon={Landmark} error={!!fieldErrors.state} value={form.state} onChange={(e) => set("state", e.target.value)} />
                                <FieldError message={fieldErrors.state} />
                              </div>
                              <FloatingField id="country" label={tp("country")} icon={Globe} value={form.country} onChange={(e) => set("country", e.target.value)} />
                              <div>
                                <FloatingField id="pincode" label={tp("pincode")} icon={Hash} error={!!fieldErrors.pincode} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
                                <FieldError message={fieldErrors.pincode} />
                              </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-4">
                              <FloatingField id="contactNumber" label={t("contact")} icon={Phone} value={facility.phone || facility.email} disabled />
                              <FloatingField id="altContact" label={tp("alt_contact")} icon={Phone} value={form.alternateContactNumber} onChange={(e) => set("alternateContactNumber", e.target.value)} />
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 2 && (
                        <div>
                          <StepHeader icon={Clock} title={t("capacity_title")} />
                          <div className="space-y-5">
                            <div className="grid sm:grid-cols-2 gap-4">
                              <div>
                                <FloatingField id="bedCapacity" label={t("beds")} icon={BedDouble} type="number" min={0} error={!!fieldErrors.bedCapacity} value={form.bedCapacity} onChange={(e) => set("bedCapacity", e.target.value)} />
                                <FieldError message={fieldErrors.bedCapacity} />
                              </div>
                              <div>
                                <FloatingField id="dailyOpd" label={t("opd")} icon={Users} type="number" min={0} error={!!fieldErrors.dailyOpdCount} value={form.dailyOpdCount} onChange={(e) => set("dailyOpdCount", e.target.value)} />
                                <FieldError message={fieldErrors.dailyOpdCount} />
                              </div>
                            </div>

                            <ToggleRow icon={Clock} title={t("is_247")} checked={form.is24x7} onCheckedChange={(v) => set("is24x7", v)} />

                            {!form.is24x7 && (
                              <div>
                                <p className="text-[15px] font-semibold mb-2">{t("which_days")}</p>
                                <div className="flex flex-wrap gap-2">
                                  {DAYS.map((d) => (
                                    <ToggleChip key={d.value} active={form.operatingDays.includes(d.value)} onClick={() => toggleInList("operatingDays", d.value)}>
                                      {dayName(d.value, dl)}
                                    </ToggleChip>
                                  ))}
                                </div>

                                <div className="mt-3 border border-border/60 rounded-xl overflow-hidden">
                                  <table className="w-full table-fixed text-sm">
                                    <thead>
                                      <tr className="border-b border-border/50 text-start text-muted-foreground bg-background/40">
                                        <th className="w-12 px-1.5 py-2 font-medium" rowSpan={2}>{t("day")}</th>
                                        <th className="px-1 py-2 font-medium text-center" colSpan={2}>{t("shift1")}</th>
                                        <th className="px-1 py-2 font-medium text-center" colSpan={2}>{t("shift2")}</th>
                                      </tr>
                                      <tr className="border-b border-border/50 text-start text-muted-foreground bg-background/40">
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
                                            <td className="px-1.5 py-2 whitespace-nowrap">{dayName(d.value, dl)}</td>
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
                                  {t("copy_monday")}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {step === 3 && (
                        <div>
                          <StepHeader icon={Stethoscope} title={t("services_title")} />
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              {t.rich("counts", { spec: form.specializations.length, svc: form.services.length, b: (c) => <b className="text-foreground">{c}</b> })}
                            </p>
                            <div className="space-y-5">
                            {([
                                {
                                  key: "specialization", label: t("major_spec"), options: specializationOptions, selected: form.specializations,
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
                                  <p className="text-[15px] font-semibold mb-3.5">{groupQuestion(g.key, g.label)}</p>
                                  <GroupMultiSelect group={g} error={g.key === "specialization" ? !!fieldErrors.specializations : !!fieldErrors.services && form.services.length === 0} />
                                </div>
                              ))}
                            </div>
                            <FieldError message={fieldErrors.specializations || fieldErrors.services} />
                            <div>
                            <p className="text-[15px] font-semibold mb-2">{tp("q_emergency")}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <ToggleRow icon={Siren} title={t("emergency")} subtitle={t("emergency_sub")} checked={form.emergencyServices} onCheckedChange={(v) => set("emergencyServices", v)} />
                              <ToggleRow icon={Ambulance} title={t("ambulance")} subtitle={t("ambulance_sub")} checked={form.ambulanceAvailable} onCheckedChange={(v) => set("ambulanceAvailable", v)} />
                            </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {step === 4 && (() => {
                        const months = meta?.subscription.trialMonths ?? 3;
                        const cur = meta?.subscription.currency ?? "INR";
                        const money = (n: number) => (cur === "INR" ? `₹${n.toLocaleString(dl)}` : `${cur} ${n.toLocaleString(dl)}`);
                        const fmt = (d: Date) => d.toLocaleDateString(dl, { day: "numeric", month: "short", year: "numeric" });
                        const included = [t("inc_reg"), t("inc_assess"), t("inc_rx"), t("inc_staff")];
                        return (
                          <div>
                            <StepHeader icon={Sparkles} title={t("plan_title")} />
                            <div className="grid gap-3 sm:grid-cols-[1.25fr_1fr]">
                              {/* Free trial — what the clinic gets now */}
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}
                                className="relative flex flex-col rounded-2xl border-2 border-primary bg-primary/[0.06] p-5">
                                <span className="absolute -top-2.5 start-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{t("plan_now")}</span>
                                <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Gift className="h-4 w-4" /> {t("free_trial")}</div>
                                <p className="mt-2 flex items-baseline gap-1.5"><span className="text-3xl font-bold tabular-nums">{money(0)}</span><span className="text-sm text-muted-foreground">{t("for_months", { count: months })}</span></p>
                                {/* Trial timeline: today → end date */}
                                <div className="mt-4">
                                  <div className="relative h-1.5 rounded-full bg-primary/20">
                                    <span className="absolute start-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background" />
                                    <span className="absolute end-0 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
                                  </div>
                                  <div className="mt-1.5 flex justify-between text-xs">
                                    <span><b className="font-semibold">{t("today")}</b><span className="block text-muted-foreground">{fmt(planDates.start)}</span></span>
                                    <span className="text-end"><b className="font-semibold">{t("trial_ends")}</b><span className="block text-muted-foreground">{fmt(planDates.end)}</span></span>
                                  </div>
                                </div>
                                <ul className="mt-4 space-y-1.5 text-sm">
                                  {included.map((f) => <li key={f} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}
                                </ul>
                              </motion.div>

                              {/* Premium — what follows */}
                              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 24, delay: 0.08 }}
                                className="flex flex-col rounded-2xl border border-input bg-card p-5">
                                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Sparkles className="h-4 w-4" /> {t("premium")}</div>
                                <p className="mt-2 flex items-baseline gap-1.5"><span className="text-3xl font-bold tabular-nums">{money(meta?.subscription.price ?? 0)}</span><span className="text-sm text-muted-foreground">{t("per_month")}</span></p>
                                <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs">{t.rich("from_after", { date: fmt(planDates.end), b: (c) => <b className="font-semibold">{c}</b> })}</p>
                                <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{t("everything")}</li>
                                  <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{t("no_interrupt")}</li>
                                </ul>
                              </motion.div>
                            </div>
                            <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> {t("no_payment")}</p>
                          </div>
                        );
                      })()}

                      {step === 5 && (() => {
                        const fmt = (d: Date) => d.toLocaleDateString(dl, { day: "numeric", month: "short", year: "numeric" });
                        const est = form.establishmentDate ? new Date(`${form.establishmentDate}-01T00:00:00`).toLocaleDateString(dl, { month: "short", year: "numeric" }) : "";
                        const place = [form.locality, form.city, form.district !== form.city ? form.district : "", form.state].filter(Boolean).join(", ");
                        const chips = (list: string[], max = 10) => list.length === 0 ? null : (
                          <span className="flex flex-wrap gap-1">
                            {list.slice(0, max).map((x) => <span key={x} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{x}</span>)}
                            {list.length > max && <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("more", { count: list.length - max })}</span>}
                          </span>
                        );
                        const cur = meta?.subscription.currency ?? "INR";
                        const price = cur === "INR" ? `₹${(meta?.subscription.price ?? 0).toLocaleString(dl)}` : `${cur} ${meta?.subscription.price}`;
                        return (
                          <div>
                            <StepHeader icon={CheckCircle2} title={t("review_title")} />
                            {/* Identity — the facility as it will appear */}
                            <div className="mb-5 flex items-start gap-4 rounded-xl bg-muted/50 p-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary font-serif text-lg font-bold text-primary-foreground">
                                {form.facilityName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 truncate font-serif text-lg font-bold leading-tight">{form.facilityName}</p>
                                  <button type="button" onClick={() => setStep(0)} className="shrink-0 text-xs font-medium text-primary hover:underline">{t("edit")}</button>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {[form.facilityType, form.hfrNumber && t("hfr_short", { value: form.hfrNumber }), est && t("est", { date: est })].filter(Boolean).join("  ·  ")}
                                </p>
                              </div>
                            </div>

                            <div>
                              <ReviewSection icon={MapPin} title={t("r_location")} onEdit={() => setStep(1)}>
                                <ReviewRow label={t("r_address")} value={[form.addressLine1, form.addressLine2].filter(Boolean).join(", ")} />
                                <ReviewRow label={t("r_area")} value={[place, form.pincode].filter(Boolean).join(" – ")} />
                                <ReviewRow label={t("r_contact")} value={[facility.phone || facility.email, form.alternateContactNumber].filter(Boolean).join("  ·  ")} />
                              </ReviewSection>
                              <ReviewSection icon={Clock} title={t("r_capacity")} onEdit={() => setStep(2)}>
                                <ReviewRow label={t("r_open")} value={hoursSummary(form, t, dl)} />
                                <ReviewRow label={t("r_opd")} value={form.dailyOpdCount ? t("r_opd_value", { count: form.dailyOpdCount }) : ""} />
                                {(isHospital || form.bedCapacity) && <ReviewRow label={t("r_beds")} value={form.bedCapacity} />}
                              </ReviewSection>
                              <ReviewSection icon={Stethoscope} title={t("r_services")} onEdit={() => setStep(3)}>
                                <ReviewRow label={t("r_spec")} value={chips(form.specializations)} />
                                <ReviewRow label={t("r_services")} value={chips(form.services, 12)} />
                                <ReviewRow label={t("r_emergency")} value={[form.emergencyServices ? t("emergency") : "", form.ambulanceAvailable ? t("ambulance") : ""].filter(Boolean).join("  ·  ") || t("none")} />
                              </ReviewSection>
                              <ReviewSection icon={Sparkles} title={t("r_plan")} onEdit={() => setStep(4)}>
                                <ReviewRow label={t("free_trial")} value={t("r_trial_value", { count: meta?.subscription.trialMonths ?? 3, date: fmt(planDates.end) })} />
                                <ReviewRow label={t("r_then")} value={t("r_then_value", { price })} />
                              </ReviewSection>
                            </div>

                            <p className="mt-2 flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
                              <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-primary" />
                              <span>{facility.email ? t.rich("complete_note_email", { email: facility.email, b: (c) => <b className="font-medium text-foreground">{c}</b> }) : t("complete_note")}</span>
                            </p>
                          </div>
                        );
                      })()}
                    </motion.div>
                  </AnimatePresence>

                  <FieldError message={error || undefined} />

                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-input">
                    {step > 0 ? (
                      <Button variant="outline" size="lg" onClick={goBack} disabled={submitting}>
                        <ChevronLeft className="h-4 w-4 me-1" /> {t("back")}
                      </Button>
                    ) : <span />}
                    {step < 5 ? (
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                        <Button data-tour="setup.continue" onClick={goNext} size="lg" className="h-12 px-8 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25">
                          {step === 4 ? t("review") : t("continue")} <ChevronRight className="h-5 w-5 ms-1" />
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.96 }}>
                        <Button onClick={submit} disabled={submitting} size="lg" className="h-12 px-8 text-base font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25">
                          {submitting ? <Loader2 className="h-4 w-4 me-1.5 animate-spin" /> : <CheckCircle2 className="h-5 w-5 me-1.5" />}
                          {t("complete")}
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
          {t("rights", { year: new Date().getFullYear() })}
        </footer>
      </div>
      <LogoutConfirm open={logoutOpen} onOpenChange={setLogoutOpen} onConfirm={onLogout} who={facility.facilityName} />
    </div>
  );
}
