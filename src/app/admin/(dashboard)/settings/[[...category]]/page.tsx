"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FloatingField } from "@/components/shared/floating-field";
import { CatalogAssistantControls, CatalogAssistantLog, type CatalogAssistantConfig } from "@/components/admin/catalog-assistant-panel";
import { SupplementProfilesStatus } from "@/components/admin/supplement-profile-dialog";
import { cn } from "@/lib/utils";
import { VITALS_RANGE_FIELDS, type VitalsRangeField } from "@/lib/vitals-ranges";

interface SettingRow { id: string; category: string; key: string; value: string; updatedAt: string }

// Scheduled catalog assistants — each is a Settings category with its own
// enable/interval controls plus a generated-entries log and run history.
const ASSISTANTS: Record<string, CatalogAssistantConfig> = {
  chief_complaint_assistant: {
    label: "Unani Complaint Assistant",
    description: "Scheduled discovery of new Unani-relevant chief complaints — new entries publish automatically on this schedule, with a full log below of everything it has generated.",
    apiBase: "/api/admin/chief-complaint-bot",
    itemNoun: { singular: "complaint", plural: "complaints" },
    intervalDescription: "How often, while enabled above, this assistant automatically checks for and publishes new Unani-relevant chief complaints.",
    logTitle: "Generated Complaints Log",
    logDescription: "Every chief complaint generated here, in order — publishes automatically, nothing here is hidden after the fact.",
    groupKey: "category",
    reviewable: true,
    reviewApprovedToast: "Added to the Chief Complaint catalog",
  },
  allergy_assistant: {
    label: "Unani Allergy Assistant",
    description: "Scheduled discovery of allergens relevant to Unani practice — Mufradat, herbs, oils, foods and common allergens. New entries are added to Meta → Patient → Allergies automatically and appear in patient registration straight away.",
    apiBase: "/api/admin/allergy-assistant",
    itemNoun: { singular: "allergy", plural: "allergies" },
    intervalDescription: "How often, while enabled above, this assistant automatically checks for and adds new Unani-relevant allergens.",
    logTitle: "Generated Allergies Log",
    logDescription: "Every allergen added here, in order — publishes automatically, nothing here is hidden after the fact.",
    groupKey: "allergenType",
  },
  supplement_assistant: {
    label: "Unani Supplement & Herb Assistant",
    description: "Scheduled discovery of Unani herbs and preparations — single drugs (Mufradat) and classical formulations (Murakkabat). New entries are added to Meta → Supplements & Herbs automatically and appear in patient registration straight away.",
    apiBase: "/api/admin/supplement-assistant",
    itemNoun: { singular: "item", plural: "items" },
    intervalDescription: "How often, while enabled above, this assistant automatically checks for and adds new Unani herbs and preparations.",
    logTitle: "Generated Supplements & Herbs Log",
    logDescription: "Every supplement or herb added here, in order — publishes automatically, nothing here is hidden after the fact.",
    groupKey: "herbType",
  },
  medication_assistant: {
    label: "Allopathic Medication Assistant",
    description: "Scheduled discovery of commonly taken allopathic medicines, by generic name and therapeutic class. New entries are added to Meta → Medications automatically and appear in patient registration straight away, so the Hakim can see what a patient already takes.",
    apiBase: "/api/admin/medication-assistant",
    itemNoun: { singular: "medicine", plural: "medicines" },
    intervalDescription: "How often, while enabled above, this assistant automatically checks for and adds new commonly taken allopathic medicines.",
    logTitle: "Generated Medications Log",
    logDescription: "Every medicine added here, in order — publishes automatically, nothing here is hidden after the fact.",
    groupKey: "drugClass",
  },
};

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  general: { label: "General", description: "Portal identity, report wording, registration, verification, subscription, patient defaults, vitals and an overview of the engines." },
  report: { label: "Clinical Report", description: "Branding and wording printed on the patient assessment report." },
  vitals_validation: { label: "Vitals Validation", description: "" },
  registration: { label: "Registration", description: "Control who can register on the portal." },
  verification: { label: "Verification", description: "OTP expiry, resend and attempt limits." },
  subscription: { label: "Subscription", description: "Free trial length and paid plan pricing for Facility accounts." },
  patient_defaults: { label: "Patient Defaults", description: "Default address values pre-filled when registering a new patient." },
  vitals: { label: "Vitals", description: "Rules for how long a recorded vitals assessment stays editable." },
  ...Object.fromEntries(Object.entries(ASSISTANTS).map(([k, a]) => [k, { label: a.label, description: a.description }])),
};

// One "General" tab holds these sections (each keeps its own heading).
const GENERAL_GROUP = ["general", "report", "registration", "verification", "subscription", "patient_defaults", "vitals"];
// Engine settings saved by other Admin tabs — summarised read-only under General, edited where they live.
const SYSTEM: Record<string, { label: string; href?: string; summary: (v: Record<string, string>) => string }> = {
  dalail: { label: "Dala'il question engine", href: "/admin/meta/tashkhees?tab=dalail", summary: (v) => `Up to ${v.max_questions ?? "—"} questions · ordering with Hakeem Insight ${v.ranking === "off" ? "off" : "on"}` },
  tashkhees_engine: { label: "Tashkhees engine", href: "/admin/meta/tashkhees?tab=engine", summary: (v) => { try { const c = JSON.parse(v.config || "{}"); return `Up to ${c.maxOrgans ?? "—"} organs · Maddi threshold ${c.maddiThreshold ?? "—"} · ordering with Hakeem Insight ${c.ranking === false ? "off" : "on"}`; } catch { return "Custom settings"; } } },
  cds: { label: "Medicines decision support", href: "/admin/meta/tashkhees?tab=cds", summary: (v) => { try { const c = JSON.parse(v.config || "{}"); return `Pilot ${c.enabled ? "on" : "off"} · up to ${c.maxPerCategory ?? "—"} per group`; } catch { return "Custom settings"; } } },
  i18n: { label: "Translations", href: "/admin/languages", summary: (v) => `Translation version ${v.messages_version ?? "—"} — updates by itself when translations change` },
};
const tabOf = (c: string) => (GENERAL_GROUP.includes(c) || c in SYSTEM ? "general" : c);

// Explicit order for the sidebar (the settings themselves load alphabetically
// by category) so Vitals Validation sits right after General rather than
// wherever its name happens to sort.
const CATEGORY_ORDER = ["general", "report", "vitals_validation", "registration", "verification", "subscription", "patient_defaults", "vitals", "chief_complaint_assistant", "allergy_assistant", "supplement_assistant", "medication_assistant"];

const VITALS_FIELD_LABELS: Record<VitalsRangeField, string> = {
  pulse: "Pulse (bpm)",
  bpSystolic: "BP Systolic (mmHg)",
  bpDiastolic: "BP Diastolic (mmHg)",
  spo2: "SpO₂ (%)",
  temperatureF: "Temperature (°F)",
};

const KEY_LABELS: Record<string, string> = {
  website_url: "Official website URL",
  slogan: "Slogan",
  report_title: "Report title",
  report_subtitle: "Report subtitle",
  copyright_owner: "Copyright owner (legal name)",
  confidentiality: "Confidentiality notice",
  insight_disclaimer: "Hakeem Insight disclaimer",
  portal_name: "Portal name",
  support_email: "Support email",
  support_phone: "Support phone",
  facility_registration_enabled: "Allow new Facility registrations",
  patient_registration_enabled: "Allow new patient registrations",
  require_license_for_facility: "Require license number for Facility signup",
  otp_expiry_minutes: "OTP expiry (minutes)",
  otp_resend_cooldown_seconds: "Resend cooldown (seconds)",
  max_otp_attempts: "Max verification attempts",
  max_login_attempts: "Max failed password attempts",
  lockout_duration_minutes: "Account lockout duration (minutes)",
  free_trial_months: "Free trial duration (months)",
  paid_plan_price_per_month: "Paid plan price per month",
  currency: "Currency",
  default_state: "Default state",
  default_city: "Default city",
  edit_window_minutes: "Vitals edit window (minutes)",
};

const BOOLEAN_KEYS = new Set([
  "facility_registration_enabled", "patient_registration_enabled", "require_license_for_facility",
]);

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  // Each tab has its own URL (/admin/settings/<category>) — the path is the
  // source of truth for which one is selected, so links and refreshes land
  // on the right tab and Back/Forward move between tabs.
  const pathname = usePathname();
  const urlCategory = pathname.split("/")[3] || null;

  const sortCategories = (cats: string[]) =>
    [...cats].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

  useEffect(() => {
    adminApi.get<{ settings: SettingRow[] }>("/api/admin/settings")
      .then((res) => {
        setSettings(res.settings);
        setDraft(Object.fromEntries(res.settings.map((s) => [`${s.category}.${s.key}`, s.value])));
        const cats = sortCategories(Array.from(new Set(res.settings.map((s) => tabOf(s.category)))));
        // Old links to a merged section (e.g. /admin/settings/registration) open General at that section.
        if (urlCategory && tabOf(urlCategory) === "general" && urlCategory !== "general") {
          window.history.replaceState(null, "", `/admin/settings/general#${urlCategory}`);
          setTimeout(() => document.getElementById(`section-${urlCategory}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
        } else if (cats.length && (!urlCategory || !cats.includes(urlCategory))) {
          // Bare /admin/settings, or an unknown tab → the first tab, without adding a history entry.
          window.history.replaceState(null, "", `/admin/settings/${cats[0]}`);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = sortCategories(Array.from(new Set(settings.map((s) => tabOf(s.category)))));
  const selected = urlCategory && categories.includes(urlCategory) ? urlCategory : null;
  // pushState (synced by Next.js into usePathname) switches tabs without
  // remounting the page, so unsaved edits on other tabs aren't lost.
  const selectTab = (c: string) => {
    if (c !== selected) window.history.pushState(null, "", `/admin/settings/${c}`);
  };

  const saveCategory = async (category: string) => {
    // General saves all of its sections at once.
    const cats = category === "general" ? GENERAL_GROUP : [category];
    const updates = settings
      .filter((s) => cats.includes(s.category))
      .map((s) => ({ category: s.category, key: s.key, value: draft[`${s.category}.${s.key}`] ?? s.value }))
      .filter((u) => u.value !== settings.find((s) => s.category === u.category && s.key === u.key)?.value);

    if (updates.length === 0) {
      toast.info("No changes to save");
      return;
    }
    setSaving(category);
    try {
      const res = await adminApi.put<{ settings: SettingRow[] }>("/api/admin/settings", { updates });
      setSettings(res.settings);
      toast.success(`${CATEGORY_META[category]?.label || category} settings saved`);
    } catch (err: any) {
      toast.error(err.message || "Could not save settings");
    } finally {
      setSaving(null);
    }
  };

  const assistant = selected ? ASSISTANTS[selected] : undefined;
  const settingValue = (draftKey: string, fallback: string) =>
    draft[draftKey] ?? settings.find((s) => `${s.category}.${s.key}` === draftKey)?.value ?? fallback;

  const renderField = (s: SettingRow) => {
    const draftKey = `${s.category}.${s.key}`;
    if (BOOLEAN_KEYS.has(s.key)) {
      return (
        <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3.5">
          <p className="text-sm font-medium">{KEY_LABELS[s.key] || s.key}</p>
          <Switch
            checked={draft[draftKey] === "true"}
            onCheckedChange={(checked) => setDraft((d) => ({ ...d, [draftKey]: checked ? "true" : "false" }))}
          />
        </div>
      );
    }
    return (
      <FloatingField
        key={s.id}
        id={draftKey}
        label={KEY_LABELS[s.key] || s.key}
        value={draft[draftKey] ?? s.value}
        onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
      />
    );
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
        <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1680px] px-4 sm:px-6 lg:px-16 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <Card className="p-2 border-border/50 bg-card/60 h-fit">
          <div className="space-y-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => selectTab(c)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors",
                  selected === c ? "bg-primary text-primary-foreground font-medium" : "text-foreground hover:bg-background/60"
                )}
              >
                <SettingsIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{CATEGORY_META[c]?.label || c}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-6 gap-4 border-border/50 bg-card/60">
          {!selected ? (
            <p className="text-muted-foreground text-sm">Select a section to manage its settings.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <SettingsIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-semibold">{CATEGORY_META[selected]?.label || selected}</h2>
                  {CATEGORY_META[selected]?.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_META[selected].description}</p>
                  )}
                </div>
              </div>
              <div className={selected === "vitals_validation" ? "divide-y divide-border/50" : "space-y-4 pt-2"}>
                {assistant ? (
                  <CatalogAssistantControls
                    config={assistant}
                    enabled={settingValue(`${selected}.enabled`, "false") === "true"}
                    interval={settingValue(`${selected}.interval_minutes`, "1440")}
                    onEnabledChange={(checked) => setDraft((d) => ({ ...d, [`${selected}.enabled`]: checked ? "true" : "false" }))}
                    onIntervalChange={(v) => setDraft((d) => ({ ...d, [`${selected}.interval_minutes`]: v }))}
                  />
                ) : selected === "vitals_validation" ? (
                  VITALS_RANGE_FIELDS.map((field) => {
                    const keys = {
                      normalMin: `vitals_validation.${field}_normal_min`,
                      normalMax: `vitals_validation.${field}_normal_max`,
                      entryMin: `vitals_validation.${field}_entry_min`,
                      entryMax: `vitals_validation.${field}_entry_max`,
                    };
                    const valueFor = (draftKey: string) => {
                      const row = settings.find((s) => `${s.category}.${s.key}` === draftKey);
                      return draft[draftKey] ?? row?.value ?? "";
                    };
                    return (
                      <div key={field} className="grid grid-cols-2 lg:grid-cols-[150px_repeat(4,minmax(0,1fr))] items-center gap-x-3 gap-y-4 py-4 first:pt-2">
                        <p className="col-span-2 lg:col-span-1 text-sm font-semibold">{VITALS_FIELD_LABELS[field]}</p>
                          <FloatingField id={keys.normalMin} type="number" step="any" label="Normal min" value={valueFor(keys.normalMin)} onChange={(e) => setDraft((d) => ({ ...d, [keys.normalMin]: e.target.value }))} />
                          <FloatingField id={keys.normalMax} type="number" step="any" label="Normal max" value={valueFor(keys.normalMax)} onChange={(e) => setDraft((d) => ({ ...d, [keys.normalMax]: e.target.value }))} />
                          <FloatingField id={keys.entryMin} type="number" step="any" label="Entry limit min" value={valueFor(keys.entryMin)} onChange={(e) => setDraft((d) => ({ ...d, [keys.entryMin]: e.target.value }))} />
                          <FloatingField id={keys.entryMax} type="number" step="any" label="Entry limit max" value={valueFor(keys.entryMax)} onChange={(e) => setDraft((d) => ({ ...d, [keys.entryMax]: e.target.value }))} />
                      </div>
                    );
                  })
                ) : selected === "general" ? (
                  <div className="space-y-8">
                    {GENERAL_GROUP.filter((c) => settings.some((s) => s.category === c)).map((c) => (
                      <section key={c} id={`section-${c}`} className="scroll-mt-24 space-y-3">
                        {c !== "general" && (
                          <div className="border-t border-border/50 pt-5 pb-2">
                            <h3 className="font-serif text-base font-semibold">{CATEGORY_META[c]?.label || c}</h3>
                            {CATEGORY_META[c]?.description && <p className="text-xs text-muted-foreground mt-0.5">{CATEGORY_META[c].description}</p>}
                          </div>
                        )}
                        {settings.filter((s) => s.category === c).map(renderField)}
                      </section>
                    ))}
                    {Object.keys(SYSTEM).some((c) => settings.some((s) => s.category === c)) && (
                      <section id="section-engines" className="scroll-mt-24 space-y-3">
                        <div className="border-t border-border/50 pt-5 pb-2">
                          <h3 className="font-serif text-base font-semibold">Engines & system</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">Set on their own Admin tabs — shown here for reference.</p>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {Object.entries(SYSTEM).filter(([c]) => settings.some((s) => s.category === c)).map(([c, m]) => {
                            const values = Object.fromEntries(settings.filter((s) => s.category === c).map((s) => [s.key, s.value]));
                            return (
                              <div key={c} id={`section-${c}`} className="scroll-mt-24 flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/60 px-4 py-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{m.label}</p>
                                  <p className="text-xs text-muted-foreground">{m.summary(values)}</p>
                                </div>
                                {m.href && <Link href={m.href} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Manage <ArrowUpRight className="h-3 w-3" /></Link>}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                ) : settings.filter((s) => s.category === selected).map(renderField)}
              </div>
              <Button
                className="self-end h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25 disabled:shadow-none"
                disabled={saving === selected}
                onClick={() => saveCategory(selected)}
              >
                {saving === selected ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
              </Button>

              {selected === "supplement_assistant" && <SupplementProfilesStatus key="supplement" kind="supplement" />}
              {selected === "medication_assistant" && <SupplementProfilesStatus key="medication" kind="medication" />}
              {assistant && <CatalogAssistantLog key={selected} config={assistant} />}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
