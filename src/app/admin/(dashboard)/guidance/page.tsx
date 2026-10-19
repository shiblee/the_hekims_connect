"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, GraduationCap, Loader2, Map, Plus, Save, Settings2, Users } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FloatingCombobox } from "@/components/shared/combobox";
import { STATE_LABEL, type GuideLang, type TranslationState } from "@/lib/guidance/content";
import { LangDots, StatusPill, STATE_DOT } from "@/components/guidance/admin-bits";

interface Item { id: string; name: string; status: string; version: number; dirty: boolean; publishedAt: string | null; updatedAt: string; trigger?: string; steps?: number; languages: Record<GuideLang, TranslationState>; progress?: Record<string, number> }
interface Mod { key: string; app: "clinic" | "admin"; name: string; route: string; enabled: boolean; permission: string[]; ownerOnly: boolean; tours: Item[]; docs: Item[] }
interface Settings { enabled: boolean; toursEnabled: boolean; docsEnabled: boolean; loginTours: boolean; firstVisitTours: boolean; reofferUpdated: boolean; defaultLanguage: string; fallbackLanguage: string }

const TRIGGER: Record<string, string> = { first_login: "First sign-in", first_visit: "First visit to the page", manual: "Started by the user" };

function ItemRow({ kind, item }: { kind: "tours" | "docs"; item: Item }) {
  const done = item.progress?.completed ?? 0, skipped = item.progress?.skipped ?? 0;
  return (
    <Link href={`/admin/guidance/${kind}/${item.id}`} className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm transition-colors hover:border-primary/40">
      {kind === "tours" ? <Map className="h-3.5 w-3.5 text-primary" /> : <BookOpen className="h-3.5 w-3.5 text-primary" />}
      <span className="min-w-0 flex-1 truncate font-medium group-hover:text-primary">{item.name}</span>
      {kind === "tours" && <span className="text-xs text-muted-foreground">{item.steps} step{item.steps === 1 ? "" : "s"} · {TRIGGER[item.trigger ?? "manual"]}{done + skipped ? ` · ${done} finished, ${skipped} skipped` : ""}</span>}
      <LangDots languages={item.languages} />
      <StatusPill status={item.status} dirty={item.dirty} version={item.version} />
    </Link>
  );
}

export default function GuidanceAdminPage() {
  const router = useRouter();
  const [data, setData] = useState<{ settings: Settings; modules: Mod[] } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [languages, setLanguages] = useState<{ code: string; englishName: string }[]>([]);
  const [app, setApp] = useState<"clinic" | "admin">("clinic");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState("");

  const load = useCallback(async () => {
    const res = await adminApi.get<{ settings: Settings; modules: Mod[] }>("/api/admin/guidance");
    setData(res); setSettings(res.settings);
  }, []);
  useEffect(() => {
    load().catch(() => toast.error("Could not load guidance"));
    adminApi.get<{ languages: { code: string; englishName: string; enabled: boolean }[] }>("/api/admin/languages").then((r) => setLanguages(r.languages.filter((l) => l.enabled))).catch(() => {});
  }, [load]);

  const modules = useMemo(() => (data?.modules ?? []).filter((m) => m.app === app), [data, app]);
  const changed = !!(settings && data && JSON.stringify(settings) !== JSON.stringify(data.settings));

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const r = await adminApi.put<{ settings: Settings }>("/api/admin/guidance", {
        enabled: settings.enabled, tours_enabled: settings.toursEnabled, docs_enabled: settings.docsEnabled, login_tours: settings.loginTours,
        first_visit_tours: settings.firstVisitTours, reoffer_updated: settings.reofferUpdated, default_language: settings.defaultLanguage, fallback_language: settings.fallbackLanguage,
      });
      setData((d) => d && { ...d, settings: r.settings }); setSettings(r.settings);
      toast.success("Guidance settings saved");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Not saved"); }
    finally { setSaving(false); }
  };

  const toggleModule = async (m: Mod, enabled: boolean) => {
    setData((d) => d && { ...d, modules: d.modules.map((x) => x.key === m.key ? { ...x, enabled } : x) });
    try { await adminApi.patch(`/api/admin/guidance/modules/${m.key}`, { enabled }); }
    catch { toast.error("Not saved"); load(); }
  };

  const create = async (kind: "tours" | "docs", m: Mod) => {
    setCreating(`${kind}:${m.key}`);
    try {
      const r = await adminApi.post<{ id: string }>(`/api/admin/guidance/${kind}`, { moduleKey: m.key, name: `${m.name} ${kind === "tours" ? "tour" : "tutorial"}` });
      router.push(`/admin/guidance/${kind}/${r.id}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create"); setCreating(""); }
  };

  const SWITCHES: { key: keyof Settings; label: string; hint: string; needs?: keyof Settings }[] = [
    { key: "enabled", label: "User guidance", hint: "Master switch for tours, help panels and Learning & Tutorials. Off never affects the modules themselves." },
    { key: "toursEnabled", label: "Guided tours", hint: "Step-by-step tours that highlight parts of the screen.", needs: "enabled" },
    { key: "docsEnabled", label: "Module tutorials", hint: "The detailed help opened from the ? button on each page.", needs: "enabled" },
    { key: "loginTours", label: "Start tours at first sign-in", hint: "Tours set to “First sign-in” open once, after the user's first sign-in.", needs: "toursEnabled" },
    { key: "firstVisitTours", label: "Start tours on first visit", hint: "Tours set to “First visit” open once, the first time the user opens that page.", needs: "toursEnabled" },
    { key: "reofferUpdated", label: "Offer updated tours again", hint: "When a tour is republished, users who finished an older version see it once more (each tour can also opt in).", needs: "toursEnabled" },
  ];

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-10 sm:px-6 lg:px-16">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl"><GraduationCap className="h-6 w-6 text-primary" /> User guidance &amp; tutorials</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Guided tours and module tutorials for every user, in five languages. Content is shared by all clinics; each clinic owner can switch guidance off for their own clinic. Users only ever see published versions, and only for pages they're allowed to open.</p>
      </div>

      {!data || !settings ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Card data-tour="guidance.settings" className="h-fit gap-4 border-border bg-card/60 p-5 xl:sticky xl:top-6">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold"><Settings2 className="h-4 w-4 text-primary" /> Settings</h2>
            <div className="divide-y divide-border">
              {SWITCHES.map((sw) => {
                const off = !!sw.needs && (!settings[sw.needs] || (sw.needs !== "enabled" && !settings.enabled));
                return (
                  <label key={sw.key} className={cn("flex items-start justify-between gap-3 py-3 first:pt-0", off && "opacity-50")}>
                    <span><span className="block text-sm font-medium">{sw.label}</span><span className="block text-xs leading-snug text-muted-foreground">{sw.hint}</span></span>
                    <Switch checked={settings[sw.key] as boolean} disabled={off} onCheckedChange={(v) => setSettings({ ...settings, [sw.key]: v })} />
                  </label>
                );
              })}
            </div>
            <div className="grid gap-4 border-t border-border pt-4">
              <FloatingCombobox id="defLang" label="Default language" value={settings.defaultLanguage} onValueChange={(v) => setSettings({ ...settings, defaultLanguage: v })} options={languages.map((l) => ({ value: l.code, label: l.englishName }))} keepOrder />
              <FloatingCombobox id="fbLang" label="Fallback language" value={settings.fallbackLanguage} onValueChange={(v) => setSettings({ ...settings, fallbackLanguage: v })} options={languages.map((l) => ({ value: l.code, label: l.englishName }))} keepOrder />
              <p className="text-xs leading-snug text-muted-foreground">A user sees guidance in their own language once that translation is complete and reviewed; until then, in the fallback language (then English), with a note saying so.</p>
            </div>
            <div className="flex justify-end border-t border-border pt-4">
              <Button onClick={saveSettings} disabled={saving || !changed}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings</Button>
            </div>
          </Card>

          <div data-tour="guidance.modules" className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg border border-border bg-card/60 p-1">
                {(["clinic", "admin"] as const).map((a) => (
                  <button key={a} type="button" onClick={() => setApp(a)} className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", app === a ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
                    {a === "clinic" ? "Clinic app" : "Admin panel"} <span className="opacity-70">({(data.modules ?? []).filter((m) => m.app === a).length})</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                {(Object.keys(STATE_DOT) as TranslationState[]).map((s) => <span key={s} className="inline-flex items-center gap-1"><span className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[s])} />{STATE_LABEL[s]}</span>)}
              </div>
            </div>

            {modules.map((m) => (
              <Card key={m.key} className={cn("gap-3 border-border bg-card/60 p-4", !m.enabled && "opacity-60")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code className="text-[11px]">{m.route}</code>
                      {m.app === "clinic" && <> · <Users className="mb-0.5 inline h-3 w-3" /> {m.ownerOnly ? "Clinic owner only" : m.permission.length ? `Needs: ${m.permission.join(" or ")}` : "Everyone in the clinic"}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={!!creating} onClick={() => create("tours", m)}>{creating === `tours:${m.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Tour</Button>
                    {m.docs.length === 0 && <Button size="sm" variant="outline" disabled={!!creating} onClick={() => create("docs", m)}>{creating === `docs:${m.key}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Tutorial</Button>}
                    <label className="ms-1 flex items-center gap-2 text-xs text-muted-foreground">Guidance<Switch checked={m.enabled} onCheckedChange={(v) => toggleModule(m, v)} /></label>
                  </div>
                </div>
                {m.tours.length + m.docs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tour or tutorial yet.</p>
                ) : (
                  <div className="grid gap-1.5">
                    {m.tours.map((t) => <ItemRow key={t.id} kind="tours" item={t} />)}
                    {m.docs.map((d) => <ItemRow key={d.id} kind="docs" item={d} />)}
                  </div>
                )}
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">Last loaded {formatDateTime(new Date().toISOString())}. New modules appear here once they're registered in the app.</p>
          </div>
        </div>
      )}
    </div>
  );
}
