"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, CheckCircle2, CircleDashed, GraduationCap, Loader2, Map, Play, RotateCcw, SkipForward, StepForward } from "lucide-react";
import { toast } from "sonner";
import { cn, formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LanguageSelector } from "@/components/shared/language-selector";
import { useGuidance } from "./guidance-provider";

interface Tour { id: string; title: string; steps: number; firstRoute: string; state: "new" | "in_progress" | "completed" | "skipped"; step: number; outdated: boolean; completedAt: string | null }
interface Mod { key: string; name: string; route: string; doc: { title: string } | null; tours: Tour[] }
interface Catalog { on: boolean; clinicOff?: boolean; modules: Mod[] }
interface ClinicGuidance { enabled: boolean; platformOn: boolean; publishedTours: number; staff: { id: string; name: string; role: string | null; active: boolean; completed: number; skipped: number; inProgress: number; lastAt: string | null }[] }

const STATE: Record<Tour["state"], { label: string; icon: typeof CheckCircle2; cls: string }> = {
  new: { label: "st_new", icon: CircleDashed, cls: "text-muted-foreground" },
  in_progress: { label: "st_progress", icon: StepForward, cls: "text-sky-600 dark:text-sky-400" },
  completed: { label: "st_done", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  skipped: { label: "st_skipped", icon: SkipForward, cls: "text-amber-600 dark:text-amber-400" },
};

/** Profile → Learning & tutorials: every tour and tutorial this user may use, with restart / resume. */
export function LearningCenter({ isOwner = false }: { isOwner?: boolean }) {
  const g = useGuidance();
  const client = g?.client;
  const [data, setData] = useState<Catalog | null>(null);
  const [clinic, setClinic] = useState<ClinicGuidance | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("common.learning");
  const tc = useTranslations("common");

  const load = useCallback(async () => {
    if (!client) return;
    const [cat, cl] = await Promise.all([
      client.get<Catalog>("/api/guidance/catalog").catch(() => ({ on: false, modules: [] }) as Catalog),
      isOwner ? client.get<ClinicGuidance>("/api/facility/guidance").catch(() => null) : Promise.resolve(null),
    ]);
    setData(cat); setClinic(cl);
  }, [client, isOwner]);
  useEffect(() => { let off = false; Promise.resolve().then(() => { if (!off) load(); }); return () => { off = true; }; }, [load]);

  if (!g || !client) return null;
  const tours = (data?.modules ?? []).flatMap((m) => m.tours);
  const done = tours.filter((t) => t.state === "completed").length;
  const touched = tours.filter((t) => t.state !== "new").length;

  const restart = async (t: Tour) => {
    await client.post("/api/guidance/progress", { reset: true, tourId: t.id }).catch(() => {});
    g.openTour(t.id, t.firstRoute);
  };
  const restartAll = async () => {
    setBusy(true);
    try {
      const r = await client.post<{ reset: number }>("/api/guidance/progress", { reset: true });
      toast.success(t("reset_done", { count: r.reset }));
      setConfirmAll(false); await load(); g.refresh();
    } catch { toast.error(t("reset_failed")); }
    finally { setBusy(false); }
  };
  const toggleClinic = async (enabled: boolean) => {
    setClinic((c) => c && { ...c, enabled });
    try { await client.patch("/api/facility/guidance", { enabled }); }
    catch { toast.error(t("not_saved")); load(); return; }
    toast.success(enabled ? t("on") : t("off"));
    await load(); g.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-bold"><GraduationCap className="h-5 w-5 text-primary" /> {t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("language")}</span>
          <div className="rounded-lg border border-border"><LanguageSelector /></div>
        </div>
      </div>

      {isOwner && clinic && (
        <Card className="gap-3 border-border bg-card/60 p-4">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-semibold">{t("clinic")}</span>
              <span className="block text-xs text-muted-foreground">{t("clinic_hint")}{!clinic.platformOn && t("platform_off")}</span>
            </span>
            <Switch checked={clinic.enabled} onCheckedChange={toggleClinic} />
          </label>
          {clinic.staff.length > 0 && clinic.publishedTours > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-3 py-2">{t("staff")}</th><th className="px-3 py-2">{t("st_done")}</th><th className="px-3 py-2">{t("st_progress")}</th><th className="px-3 py-2">{t("st_skipped")}</th><th className="px-3 py-2">{t("last")}</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clinic.staff.map((s) => (
                    <tr key={s.id} className={cn(!s.active && "opacity-50")}>
                      <td className="px-3 py-2"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.role ?? "—"}</p></td>
                      <td className="px-3 py-2 tabular-nums">{s.completed}</td>
                      <td className="px-3 py-2 tabular-nums">{s.inProgress}</td>
                      <td className="px-3 py-2 tabular-nums">{s.skipped}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.lastAt ? formatDateTime(s.lastAt) : t("st_new")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!data ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {tc("loading")}</div>
      ) : !data.on ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{data.clinicOff ? t("clinic_off") : t("all_off")}</p>
      ) : data.modules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("none")}</p>
      ) : (
        <>
          {tours.length > 0 && (
            <Card className="gap-2 border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">{t.rich("finished_n", { done, count: tours.length, b: (c) => <span className="font-semibold tabular-nums">{c}</span> })}</p>
                <Button size="sm" variant="outline" disabled={!touched} onClick={() => setConfirmAll(true)}><RotateCcw className="h-3.5 w-3.5" /> {t("restart_all")}</Button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / Math.max(1, tours.length)) * 100}%` }} /></div>
            </Card>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {data.modules.map((m) => (
              <Card key={m.key} className="gap-3 border-border bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{m.name}</p>
                  {m.doc && <Button size="sm" variant="ghost" className="h-8 text-primary" onClick={() => g.openHelp(m.key)}><BookOpen className="h-3.5 w-3.5" /> {t("tutorial")}</Button>}
                </div>
                {m.tours.map((tour) => {
                  const st = STATE[tour.state];
                  return (
                    <div key={tour.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium"><Map className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{tour.title}</span></span>
                        <span className={cn("flex items-center gap-1 text-xs", st.cls)}><st.icon className="h-3 w-3" />{t(st.label)}{tour.state === "in_progress" && t("step_of", { n: tour.step + 1, total: tour.steps })}{tour.outdated && t("updated_since")}<span className="text-muted-foreground">&nbsp;· {t("n_steps", { count: tour.steps })}</span></span>
                      </span>
                      <span className="flex gap-1.5">
                        {tour.state === "in_progress" && <Button size="sm" onClick={() => g.openTour(tour.id, tour.firstRoute, true)}><StepForward className="h-3.5 w-3.5" /> {t("resume")}</Button>}
                        {tour.state === "new"
                          ? <Button size="sm" onClick={() => g.openTour(tour.id, tour.firstRoute)}><Play className="h-3.5 w-3.5" /> {t("start")}</Button>
                          : <Button size="sm" variant="outline" onClick={() => restart(tour)}><RotateCcw className="h-3.5 w-3.5" /> {t("restart")}</Button>}
                      </span>
                    </div>
                  );
                })}
              </Card>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirm_text", { count: touched })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); restartAll(); }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("restart_all_btn")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
