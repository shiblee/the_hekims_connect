"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/lib/admin-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SettingRow { id: string; category: string; key: string; value: string; updatedAt: string }

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  general: { label: "General", description: "Portal identity and support contact information." },
  registration: { label: "Registration", description: "Control who can register on the portal." },
  verification: { label: "Verification", description: "OTP expiry, resend and attempt limits." },
};

const KEY_LABELS: Record<string, string> = {
  portal_name: "Portal name",
  support_email: "Support email",
  support_phone: "Support phone",
  hakim_registration_enabled: "Allow new Hakim registrations",
  patient_registration_enabled: "Allow new patient registrations",
  require_license_for_hakim: "Require license number for Hakim signup",
  otp_expiry_minutes: "OTP expiry (minutes)",
  otp_resend_cooldown_seconds: "Resend cooldown (seconds)",
  max_otp_attempts: "Max verification attempts",
};

const BOOLEAN_KEYS = new Set([
  "hakim_registration_enabled", "patient_registration_enabled", "require_license_for_hakim",
]);

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    adminApi.get<{ settings: SettingRow[] }>("/api/admin/settings")
      .then((res) => {
        setSettings(res.settings);
        setDraft(Object.fromEntries(res.settings.map((s) => [`${s.category}.${s.key}`, s.value])));
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
        <p className="text-muted-foreground mt-1.5">System-level configuration for the portal.</p>
      </div>

      <Tabs defaultValue={categories[0]} className="max-w-2xl">
        <TabsList className="mb-6">
          {categories.map((c) => (
            <TabsTrigger key={c} value={c}>{CATEGORY_META[c]?.label || c}</TabsTrigger>
          ))}
        </TabsList>
        {categories.map((c) => (
          <TabsContent key={c} value={c}>
            <Card className="p-6 border-border/50 bg-card/60">
              <div className="flex items-start gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                  <SettingsIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-semibold">{CATEGORY_META[c]?.label || c}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{CATEGORY_META[c]?.description || ""}</p>
                </div>
              </div>
              <div className="space-y-4">
                {settings.filter((s) => s.category === c).map((s) => {
                  const draftKey = `${s.category}.${s.key}`;
                  const isBoolean = BOOLEAN_KEYS.has(s.key);
                  return (
                    <div key={s.id} className={isBoolean ? "flex items-center justify-between" : "space-y-1.5"}>
                      <Label>{KEY_LABELS[s.key] || s.key}</Label>
                      {isBoolean ? (
                        <Switch
                          checked={draft[draftKey] === "true"}
                          onCheckedChange={(checked) => setDraft((d) => ({ ...d, [draftKey]: checked ? "true" : "false" }))}
                        />
                      ) : (
                        <Input
                          className="h-11 bg-background/60"
                          value={draft[draftKey] ?? s.value}
                          onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <Button size="sm" className="mt-6" disabled={saving === c} onClick={() => saveCategory(c)}>
                {saving === c ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save changes
              </Button>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
