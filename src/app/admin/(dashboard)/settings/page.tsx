"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FloatingField } from "@/components/shared/floating-field";
import { cn } from "@/lib/utils";

interface SettingRow { id: string; category: string; key: string; value: string; updatedAt: string }

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  general: { label: "General", description: "Portal identity and support contact information." },
  registration: { label: "Registration", description: "Control who can register on the portal." },
  verification: { label: "Verification", description: "OTP expiry, resend and attempt limits." },
  subscription: { label: "Subscription", description: "Free trial length and paid plan pricing for Facility accounts." },
};

const KEY_LABELS: Record<string, string> = {
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
};

const BOOLEAN_KEYS = new Set([
  "facility_registration_enabled", "patient_registration_enabled", "require_license_for_facility",
]);

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    adminApi.get<{ settings: SettingRow[] }>("/api/admin/settings")
      .then((res) => {
        setSettings(res.settings);
        setDraft(Object.fromEntries(res.settings.map((s) => [`${s.category}.${s.key}`, s.value])));
        const cats = Array.from(new Set(res.settings.map((s) => s.category)));
        if (cats.length) setSelected(cats[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Set(settings.map((s) => s.category)));

  const saveCategory = async (category: string) => {
    const updates = settings
      .filter((s) => s.category === category)
      .map((s) => ({ category, key: s.key, value: draft[`${category}.${s.key}`] ?? s.value }))
      .filter((u) => u.value !== settings.find((s) => s.category === category && s.key === u.key)?.value);

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
                onClick={() => setSelected(c)}
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

        <Card className="p-6 border-border/50 bg-card/60">
          {!selected ? (
            <p className="text-muted-foreground text-sm">Select a section to manage its settings.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <SettingsIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-semibold">{CATEGORY_META[selected]?.label || selected}</h2>
                </div>
              </div>
              <div className="space-y-4">
                {settings.filter((s) => s.category === selected).map((s) => {
                  const draftKey = `${s.category}.${s.key}`;
                  const isBoolean = BOOLEAN_KEYS.has(s.key);
                  if (isBoolean) {
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
                })}
              </div>
              <Button
                className="self-start h-11 px-6 rounded-xl font-semibold shadow-lg shadow-primary/25 disabled:shadow-none"
                disabled={saving === selected}
                onClick={() => saveCategory(selected)}
              >
                {saving === selected ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
