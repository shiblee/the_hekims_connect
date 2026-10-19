"use client";

import { useCallback, useEffect, useState } from "react";
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
  new: { label: "Not started", icon: CircleDashed, cls: "text-muted-foreground" },
  in_progress: { label: "In progress", icon: StepForward, cls: "text-sky-600 dark:text-sky-400" },
  completed: { label: "Finished", icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  skipped: { label: "Skipped", icon: SkipForward, cls: "text-amber-600 dark:text-amber-400" },
};

/** Profile → Learning & tutorials: every tour and tutorial this user may use, with restart / resume. */
export function LearningCenter({ isOwner = false }: { isOwner?: boolean }) {
  const g = useGuidance();
  const client = g?.client;
  const [data, setData] = useState<Catalog | null>(null);
  const [clinic, setClinic] = useState<ClinicGuidance | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);

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
      toast.success(`${r.reset} tour${r.reset === 1 ? "" : "s"} reset — they'll start again as you visit each page`);
      setConfirmAll(false); await load(); g.refresh();
    } catch { toast.error("Couldn't reset the tours"); }
    finally { setBusy(false); }
  };
  const toggleClinic = async (enabled: boolean) => {
    setClinic((c) => c && { ...c, enabled });
    try { await client.patch("/api/facility/guidance", { enabled }); }
    catch { toast.error("Not saved"); load(); return; }
    toast.success(enabled ? "Guided tours and tutorials are on for your clinic" : "Guided tours and tutorials are off for your clinic");
    await load(); g.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-xl font-bold"><GraduationCap className="h-5 w-5 text-primary" /> Learning &amp; tutorials</h2>
          <p className="text-sm text-muted-foreground">Guided tours and tutorials for the parts of the app you use. Restarting a tour only resets your tour progress — never any record.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Language</span>
          <div className="rounded-lg border border-border"><LanguageSelector /></div>
        </div>
      </div>

      {isOwner && clinic && (
        <Card className="gap-3 border-border bg-card/60 p-4">
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block font-semibold">Guidance in your clinic</span>
              <span className="block text-xs text-muted-foreground">Switch tours and tutorials on or off for you and your staff. The app works the same either way.{!clinic.platformOn && " (Currently switched off for the whole platform by the administrator.)"}</span>
            </span>
            <Switch checked={clinic.enabled} onCheckedChange={toggleClinic} />
          </label>
          {clinic.staff.length > 0 && clinic.publishedTours > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/40 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-3 py-2">Staff</th><th className="px-3 py-2">Finished</th><th className="px-3 py-2">In progress</th><th className="px-3 py-2">Skipped</th><th className="px-3 py-2">Last activity</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clinic.staff.map((s) => (
                    <tr key={s.id} className={cn(!s.active && "opacity-50")}>
                      <td className="px-3 py-2"><p className="font-medium">{s.name}</p><p className="text-xs text-muted-foreground">{s.role ?? "—"}</p></td>
                      <td className="px-3 py-2 tabular-nums">{s.completed}</td>
                      <td className="px-3 py-2 tabular-nums">{s.inProgress}</td>
                      <td className="px-3 py-2 tabular-nums">{s.skipped}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.lastAt ? formatDateTime(s.lastAt) : "Not started"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!data ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : !data.on ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{data.clinicOff ? "Guided tours and tutorials are switched off for your clinic." : "Guided tours and tutorials are switched off at the moment."}</p>
      ) : data.modules.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No tours or tutorials are available for your account yet.</p>
      ) : (
        <>
          {tours.length > 0 && (
            <Card className="gap-2 border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm"><span className="font-semibold tabular-nums">{done}</span> of <span className="tabular-nums">{tours.length}</span> tour{tours.length === 1 ? "" : "s"} finished</p>
                <Button size="sm" variant="outline" disabled={!touched} onClick={() => setConfirmAll(true)}><RotateCcw className="h-3.5 w-3.5" /> Restart all tours</Button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(done / Math.max(1, tours.length)) * 100}%` }} /></div>
            </Card>
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            {data.modules.map((m) => (
              <Card key={m.key} className="gap-3 border-border bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{m.name}</p>
                  {m.doc && <Button size="sm" variant="ghost" className="h-8 text-primary" onClick={() => g.openHelp(m.key)}><BookOpen className="h-3.5 w-3.5" /> Tutorial</Button>}
                </div>
                {m.tours.map((t) => {
                  const st = STATE[t.state];
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium"><Map className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate">{t.title}</span></span>
                        <span className={cn("flex items-center gap-1 text-xs", st.cls)}><st.icon className="h-3 w-3" />{st.label}{t.state === "in_progress" && ` · step ${t.step + 1} of ${t.steps}`}{t.outdated && " · updated since"}<span className="text-muted-foreground">&nbsp;· {t.steps} step{t.steps === 1 ? "" : "s"}</span></span>
                      </span>
                      <span className="flex gap-1.5">
                        {t.state === "in_progress" && <Button size="sm" onClick={() => g.openTour(t.id, t.firstRoute, true)}><StepForward className="h-3.5 w-3.5" /> Resume</Button>}
                        {t.state === "new"
                          ? <Button size="sm" onClick={() => g.openTour(t.id, t.firstRoute)}><Play className="h-3.5 w-3.5" /> Start</Button>
                          : <Button size="sm" variant="outline" onClick={() => restart(t)}><RotateCcw className="h-3.5 w-3.5" /> Restart</Button>}
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
            <AlertDialogTitle>Restart all tours?</AlertDialogTitle>
            <AlertDialogDescription>Your progress for {touched} tour{touched === 1 ? "" : "s"} is cleared, so they start again as you open each page. Only tour progress is affected — no patient, payment or other record changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); restartAll(); }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Restart all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
